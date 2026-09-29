/**
 * Outbox pesan (Kandidat 02): satu tabel `notifikasi_outbox` di balik satu interface untuk Klinik
 * (tiket) dan pengingat kegiatan. Pemanggil hanya menyerahkan pesan; module ini memegang invarian:
 *
 *   1. `enqueue` berjalan di transaksi pemanggil: mutasi domain dan pesan commit/rollback bersama.
 *   2. `kunci` unik: enqueue ulang tidak menambah baris; tanpa `consent` tidak ada baris.
 *   3. `dispatch` hanya mengklaim baris yang kanalnya punya adapter, sehingga baris tanpa adapter
 *      tidak menghabiskan slot klaim (tanpa starvation) dan tidak memakai jatah percobaan.
 *   4. Klaim memakai FOR UPDATE SKIP LOCKED dengan lease; aman untuk banyak instance/dispatch paralel.
 *   5. `max_attempts` dengan backoff; kegagalan `permanen` langsung `gagal`.
 *   6. Adapter `butuhResi`: 2xx hanya `terkirim`; `diterima` hanya lewat `terapkanResi`.
 *   7. Baris yang melewati `kedaluwarsaPada` menjadi `batal` (`alasan='kedaluwarsa'`), tidak dikirim.
 *   8. PII tidak masuk log: hanya `jenis`, `attempts`, dan kode error.
 *
 *   pending ──claim──▶ mengirim ──2xx──▶ terkirim ──resi──▶ diterima
 *                          └── gagal/retry ──▶ pending (backoff) ──▶ gagal
 *
 * Port adapter: `{ kanal, butuhResi, kirim({ tujuan, template, pesan }) }` dengan hasil
 * `{ ok, messageId?, provider?, providerStatus?, receipt?, final?, error?, permanen? }`.
 * `final: true` berarti bukti penerimaan sudah lengkap (mis. SMTP) dan hanya dihormati bila
 * adapter tidak `butuhResi`.
 */
import { rows } from "../utils/http.js";
import { receiptStatus } from "../whatsapp.js";

export const MAX_ATTEMPTS = 5;
/** Jeda retry per nomor percobaan, dalam milidetik. */
export const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
/** Klaim yang lebih tua dari ini dicoba ulang: prosesnya mungkin mati di tengah kirim. */
export const CLAIM_LEASE_MS = 5 * 60_000;

export const STATUS_LABEL = {
  pending: "Menunggu dikirim",
  mengirim: "Sedang dikirim",
  terkirim: "Terkirim ke provider, menunggu resi",
  diterima: "Diterima",
  gagal: "Gagal dikirim",
  batal: "Tidak dikirim",
};
const LABEL_MENUNGGU_GATEWAY = "Menunggu gateway";
const LABEL_SMTP = "Terkirim (SMTP)";

const KOLOM_SUMBER = { tiket: "tiket", pengingat: "pengingat" };

function backoff(attempts) {
  return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
}

function kolomSumber(sumber) {
  const kunci = Object.keys(KOLOM_SUMBER).filter((nama) => sumber?.[nama] != null);
  if (kunci.length !== 1) throw new Error("sumber harus berisi tepat satu dari { tiket } atau { pengingat }");
  return { kolom: KOLOM_SUMBER[kunci[0]], id: sumber[kunci[0]] };
}

const potong = (nilai, panjang) => String(nilai ?? "unknown").slice(0, panjang);

/**
 * @param {object} deps
 * @param {{ raw: Function }} deps.database  knex; `enqueue`/`batalkan` menerima transaksi sendiri.
 * @param {object} [deps.logger]
 * @param {Array} [deps.adapters]  adapter terpasang; kanal tanpa adapter tidak pernah diklaim.
 * @param {() => Date} [deps.now]  jam yang dapat disuntik agar backoff/lease bisa diuji.
 */
export function buatOutbox({ database, logger = {}, adapters = [], now = () => new Date() }) {
  const perKanal = new Map(adapters.filter(Boolean).map((adapter) => [adapter.kanal, adapter]));

  async function kedaluwarsakan() {
    await database.raw(
      `UPDATE notifikasi_outbox
          SET status = 'batal', alasan = 'kedaluwarsa', date_updated = ?::timestamptz
        WHERE kedaluwarsa_pada IS NOT NULL AND kedaluwarsa_pada <= ?::timestamptz
          AND (status = 'pending'
            OR (status = 'mengirim' AND date_updated < ?::timestamptz - (?::bigint * INTERVAL '1 millisecond')))`,
      [now(), now(), now(), CLAIM_LEASE_MS],
    );
  }

  async function klaim(limit, kanal) {
    const waktu = now();
    const hasil = await database.raw(
      `UPDATE notifikasi_outbox n
          SET status = 'mengirim', attempts = n.attempts + 1, date_updated = ?::timestamptz
         FROM (
           SELECT id FROM notifikasi_outbox
            WHERE consent AND kanal = ANY(?::text[])
              AND (kedaluwarsa_pada IS NULL OR kedaluwarsa_pada > ?::timestamptz)
              AND ((status = 'pending' AND next_attempt_at <= ?::timestamptz)
                OR (status = 'mengirim' AND date_updated < ?::timestamptz - (?::bigint * INTERVAL '1 millisecond')))
            ORDER BY next_attempt_at
            LIMIT ?
            FOR UPDATE SKIP LOCKED
         ) AS due
        WHERE n.id = due.id
        RETURNING n.id, n.kanal, n.jenis, n.tujuan, n.template, n.payload, n.attempts, n.max_attempts`,
      [waktu, kanal, waktu, waktu, waktu, CLAIM_LEASE_MS, limit],
    );
    return rows(hasil);
  }

  async function selesai(pesan, adapter, hasil) {
    if (hasil.ok) {
      const diterima = !adapter.butuhResi && hasil.final === true;
      await database.raw(
        `UPDATE notifikasi_outbox
            SET status = ?, provider = COALESCE(?, provider), provider_message_id = COALESCE(?, provider_message_id),
                provider_status = ?, provider_receipt = ?::jsonb, terkirim_at = ?::timestamptz,
                diterima_at = CASE WHEN ? THEN ?::timestamptz ELSE diterima_at END,
                last_error = NULL, date_updated = ?::timestamptz
          WHERE id = ?`,
        [
          diterima ? "diterima" : "terkirim",
          hasil.provider ?? null,
          hasil.messageId ?? null,
          hasil.providerStatus ?? null,
          JSON.stringify(hasil.receipt ?? null),
          now(),
          diterima,
          now(),
          now(),
          pesan.id,
        ],
      );
      return true;
    }
    const habis = hasil.permanen === true || pesan.attempts >= pesan.max_attempts;
    await database.raw(
      `UPDATE notifikasi_outbox
          SET status = ?, last_error = ?, provider = COALESCE(?, provider),
              next_attempt_at = ?::timestamptz + (?::bigint * INTERVAL '1 millisecond'), date_updated = ?::timestamptz
        WHERE id = ?`,
      [habis ? "gagal" : "pending", potong(hasil.error, 120), hasil.provider ?? null, now(), habis ? 0 : backoff(pesan.attempts), now(), pesan.id],
    );
    logger.warn?.(
      { event: "outbox.gagal", jenis: pesan.jenis, attempts: pesan.attempts, error: potong(hasil.error, 60) },
      "Outbox message failed",
    );
    return false;
  }

  async function kirimSatu(pesan) {
    const adapter = perKanal.get(pesan.kanal);
    // Tidak terjangkau lewat klaim (hanya kanal ber-adapter), tetapi kanal tak dikenal tetap gagal permanen.
    if (!adapter) {
      await selesai(pesan, { butuhResi: false }, { ok: false, error: "kanal_tidak_dikenal", permanen: true });
      return false;
    }
    let hasil;
    try {
      hasil = await adapter.kirim({ tujuan: pesan.tujuan, template: pesan.template, pesan: pesan.payload ?? {} });
    } catch (error) {
      hasil = { ok: false, error: error?.code ?? "adapter_error" };
    }
    return selesai(pesan, adapter, hasil ?? { ok: false, error: "adapter_error" });
  }

  return {
    /**
     * Mengantre satu pesan di `trx`. Mengembalikan baris, atau null bila tanpa consent atau kunci
     * sudah pernah dipakai.
     */
    async enqueue(trx, { kunci, jenis, kanal = "whatsapp", tujuan, template, pesan, consent, tujuanTerverifikasi = false, sumber, kirimPada, kedaluwarsaPada }) {
      if (!consent) return null;
      const { kolom, id } = kolomSumber(sumber);
      const hasil = await trx.raw(
        `INSERT INTO notifikasi_outbox
           (${kolom}, kanal, jenis, tujuan, tujuan_terverifikasi, consent, template, payload,
            idempotency_key, next_attempt_at, kedaluwarsa_pada)
         VALUES (?, ?, ?, ?, ?, TRUE, ?, ?::jsonb, ?, ?::timestamptz, ?::timestamptz)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id, jenis, kanal, status, template, tujuan`,
        [id, kanal, jenis, tujuan, tujuanTerverifikasi, template, JSON.stringify(pesan ?? {}), kunci, kirimPada ?? now(), kedaluwarsaPada ?? null],
      );
      return rows(hasil)[0] ?? null;
    },

    /** Membatalkan pesan `pending` milik sumber; mengembalikan jumlah baris yang dibatalkan. */
    async batalkan(trx, sumber, alasan = "dibatalkan") {
      const { kolom, id } = kolomSumber(sumber);
      const hasil = await trx.raw(
        `UPDATE notifikasi_outbox
            SET status = 'batal', alasan = ?, date_updated = ?::timestamptz
          WHERE ${kolom} = ? AND status = 'pending'
          RETURNING id`,
        [alasan, now(), id],
      );
      return rows(hasil).length;
    },

    /** Mengirim pesan yang jatuh tempo satu kali. Kanal tanpa adapter dihitung `dilewati`. */
    async dispatch({ limit = 10 } = {}) {
      await kedaluwarsakan();
      const kanal = [...perKanal.keys()];
      const diklaim = kanal.length ? await klaim(limit, kanal) : [];
      let terkirim = 0;
      let gagal = 0;
      for (const pesan of diklaim) {
        if (await kirimSatu(pesan)) terkirim += 1;
        else gagal += 1;
      }
      const tertunda = await database.raw(
        `SELECT count(*)::int AS jumlah FROM notifikasi_outbox
          WHERE status = 'pending' AND consent AND next_attempt_at <= ?::timestamptz AND NOT (kanal = ANY(?::text[]))`,
        [now(), kanal],
      );
      return { terkirim, gagal, dilewati: Number(rows(tertunda)[0]?.jumlah ?? 0) };
    },

    /**
     * Resi provider: satu-satunya jalan menuju `diterima`. Status tak dikenal mengembalikan null.
     * `id` dan `providerMessageId` yang keduanya diberikan harus menunjuk pesan yang sama, dan resi
     * terlambat tidak mengubah pesan yang sudah `batal`/`gagal`/`diterima`.
     */
    async terapkanResi({ id, providerMessageId, status, receipt }) {
      const hasil = receiptStatus(status);
      if (!hasil) return null;
      const baris = await database.raw(
        `UPDATE notifikasi_outbox
            SET status = CASE WHEN ? = 'diterima' THEN 'diterima' ELSE 'gagal' END,
                provider_status = ?, provider_receipt = ?::jsonb,
                diterima_at = CASE WHEN ? = 'diterima' THEN ?::timestamptz ELSE diterima_at END,
                last_error = CASE WHEN ? = 'gagal' THEN 'provider_receipt' ELSE last_error END,
                date_updated = ?::timestamptz
          WHERE (?::uuid IS NULL OR id = ?::uuid)
            AND (?::text IS NULL OR provider_message_id = ?::text)
            AND (?::uuid IS NOT NULL OR ?::text IS NOT NULL)
            AND status IN ('mengirim', 'terkirim')
          RETURNING id, tiket, pengingat, jenis, status`,
        [
          hasil, potong(status, 64), JSON.stringify(receipt ?? null), hasil, now(), hasil, now(),
          id ?? null, id ?? null, providerMessageId ?? null, providerMessageId ?? null, id ?? null, providerMessageId ?? null,
        ],
      );
      return rows(baris)[0] ?? null;
    },

    /**
     * Status pesan terbaru milik sumber, dengan label. `pending` pada kanal tanpa adapter dilaporkan
     * `menunggu_gateway`; email yang final lewat SMTP berlabel "Terkirim (SMTP)".
     */
    async statusUntuk(sumber) {
      const { kolom, id } = kolomSumber(sumber);
      const baris = rows(
        await database.raw(
          `SELECT status, kanal FROM notifikasi_outbox WHERE ${kolom} = ? ORDER BY date_created DESC, id LIMIT 1`,
          [id],
        ),
      )[0];
      if (!baris) return null;
      if (baris.status === "pending" && !perKanal.has(baris.kanal)) return { status: "menunggu_gateway", label: LABEL_MENUNGGU_GATEWAY };
      if (baris.status === "diterima" && baris.kanal === "email") return { status: "diterima", label: LABEL_SMTP };
      return { status: baris.status, label: STATUS_LABEL[baris.status] ?? baris.status };
    },
  };
}

/**
 * Halaman depan klinik (R04, N7-04): statistik layanan, direktori konsultan beserta ketersediaannya,
 * dan jawaban CSAT pemohon. Semua keluaran publik adalah DTO allowlist: tidak ada id akun, kontak,
 * atau data tiket individual; CSAT hanya keluar sebagai agregat dari jawaban ber-consent.
 */
import { ProgramError, rows } from "../../lib/utils/http.js";
import { objectBody } from "../../lib/validate.js";
import {
  AFILIASI, HARI, HORIZON_DIREKTORI, LABEL_AFILIASI, MAX_HARI_KE_DEPAN, NOMOR_TIKET, SLOTS, ketersediaanKonsultan, nilaiDikenal,
  normalisasiTelepon, tanggalDapatDipesan,
} from "./rules.js";

const notFound = () => new ProgramError(404, "TIKET_TIDAK_DITEMUKAN", "The ticket was not found.");
const bulatkan = (nilai, desimal) => Math.round(nilai * 10 ** desimal) / 10 ** desimal;

/**
 * Definisi angka yang tampil di halaman depan, satu sumber untuk server, UI, dan dokumen:
 *  - total selesai   = tiket berstatus `selesai` (semua waktu);
 *  - waktu respons   = dari `konsultasi_tiket.date_created` (pemohon mengirim tiket) sampai transisi status
 *                      pertama ke status selain `batal` di `konsultasi_tiket_audit` (petugas memproses tiket).
 *                      Penyebut = tiket yang sudah punya transisi itu; tiket yang masih "Tiket Masuk" belum
 *                      direspons dan tidak dihitung. Jam kalender, bukan jam kerja;
 *  - CSAT            = rata-rata nilai 1–5 dari jawaban ber-`consent = true`. Penyebut = jumlah jawaban itu;
 *                      sampel nol memberi `null`, bukan angka.
 */
export const DEFINISI_STATISTIK = {
  totalSelesai: "Jumlah tiket berstatus Selesai.",
  respons: "Rata-rata jam kalender dari tiket dikirim sampai petugas pertama kali memprosesnya (status berpindah selain Dibatalkan). Tiket yang belum diproses tidak dihitung.",
  csat: "Rata-rata nilai 1–5 dari jawaban pemohon yang menyetujui penilaiannya dihitung. Belum ada jawaban berarti belum ada nilai.",
};

export function createDirektori({ db, captcha, clock = () => new Date() }) {
  return { statistik, konsultan, jawabCsat };

  /** Statistik layanan publik. Satu query; nilai kosong ditandai `null`, tidak pernah 0 yang menyesatkan. */
  async function statistik() {
    const row = rows(
      await db.raw(`
        WITH respons AS (
          SELECT t.id, GREATEST(EXTRACT(EPOCH FROM (MIN(a.date_created) - t.date_created)), 0) AS detik
            FROM konsultasi_tiket t
            JOIN konsultasi_tiket_audit a ON a.tiket = t.id AND a.aksi = 'transisi' AND a.status_ke <> 'batal'
           GROUP BY t.id, t.date_created
        ),
        csat AS (SELECT COUNT(*)::int AS n, AVG(nilai) AS rata FROM konsultasi_tiket_csat WHERE consent)
        SELECT (SELECT COUNT(*)::int FROM konsultasi_tiket WHERE status = 'selesai') AS "totalSelesai",
               (SELECT COUNT(*)::int FROM respons) AS "responsSampel",
               (SELECT AVG(detik) FROM respons) AS "responsDetik",
               (SELECT n FROM csat) AS "csatSampel",
               (SELECT rata FROM csat) AS "csatRata"`),
    )[0];
    const responsSampel = Number(row.responsSampel);
    const csatSampel = Number(row.csatSampel);
    return {
      totalSelesai: Number(row.totalSelesai),
      respons: {
        rataRataJam: responsSampel ? bulatkan(Number(row.responsDetik) / 3600, 1) : null,
        sampel: responsSampel,
        targetJam: 24,
      },
      csat: {
        rataRata: csatSampel ? bulatkan(Number(row.csatRata), 2) : null,
        sampel: csatSampel,
        skalaMaks: 5,
      },
      definisi: DEFINISI_STATISTIK,
      dihitungPada: clock().toISOString(),
    };
  }

  /**
   * Direktori konsultan aktif + slot bebas `hari` hari ke depan (default 14, maks 30). "Bebas" =
   * jadwal mingguan konsultan dikurangi slot poli yang sudah dipesan tiket aktif dan slot pendamping yang
   * sudah memegang tiket lain (lihat `ketersediaanKonsultan`). Dua query tetap berapa pun jumlah konsultan.
   */
  async function konsultan(query = {}) {
    const hari = query.hari === undefined ? HORIZON_DIREKTORI : Number(query.hari);
    if (!Number.isInteger(hari) || hari < 1 || hari > MAX_HARI_KE_DEPAN) {
      throw new ProgramError(400, "HORIZON_TIDAK_VALID", `The field "hari" must be 1-${MAX_HARI_KE_DEPAN}.`);
    }
    const daftar = rows(
      await db.raw(
        `SELECT k.id, k.nama, k.poli, po.kode AS "poliKode", po.nama AS "poliNama", k.afiliasi, k.hari, k.slot, k.pendamping
           FROM klinik_konsultan k
           JOIN konsultasi_poli po ON po.id = k.poli
          WHERE k.aktif AND po.aktif
          ORDER BY k.sort NULLS LAST, k.nama, k.id`,
      ),
    );
    const tanggalList = tanggalDapatDipesan(clock(), hari);
    const terpakaiPoli = new Set();
    const terpakaiPendamping = new Set();
    if (daftar.length && tanggalList.length) {
      const terpakai = rows(
        await db.raw(
          `SELECT poli, pendamping, jadwal_tanggal::text AS tanggal, jadwal_slot AS slot
             FROM konsultasi_tiket
            WHERE status <> 'batal' AND jadwal_tanggal BETWEEN ? AND ?`,
          [tanggalList[0], tanggalList.at(-1)],
        ),
      );
      for (const tiket of terpakai) {
        terpakaiPoli.add(`${tiket.poli}|${tiket.tanggal}|${tiket.slot}`);
        if (tiket.pendamping) terpakaiPendamping.add(`${tiket.pendamping}|${tiket.tanggal}|${tiket.slot}`);
      }
    }
    return {
      rentang: { dari: tanggalList[0] ?? null, sampai: tanggalList.at(-1) ?? null },
      konsultan: daftar.map((row) => {
        const ketersediaan = ketersediaanKonsultan(
          { poli: row.poli, pendamping: row.pendamping, hari: nilaiDikenal(row.hari, HARI), slot: nilaiDikenal(row.slot, SLOTS) },
          tanggalList,
          { terpakaiPoli, terpakaiPendamping },
        );
        return {
          id: row.id,
          nama: row.nama,
          poli: { id: row.poli, kode: row.poliKode, nama: row.poliNama },
          afiliasi: AFILIASI.includes(row.afiliasi) ? row.afiliasi : null,
          afiliasiLabel: LABEL_AFILIASI[row.afiliasi] ?? null,
          hari: nilaiDikenal(row.hari, HARI),
          slot: nilaiDikenal(row.slot, SLOTS),
          ketersediaan,
          totalSlotBebas: ketersediaan.reduce((total, hariItu) => total + hariItu.slot.length, 0),
        };
      }),
    };
  }

  /**
   * Jawaban CSAT pemohon. Kunci yang sama dengan lacak tiket (nomor + WhatsApp) supaya tidak bisa dipakai
   * menyisir tiket orang lain; hanya tiket `selesai`; satu jawaban per tiket (PK = tiket, jadi dua kiriman
   * serentak menghasilkan satu baris dan satu 409). Jawaban tanpa consent tetap tersimpan tetapi tak dihitung.
   */
  async function jawabCsat(body) {
    const data = objectBody({ body });
    const nomor = String(data.nomor ?? "").trim().toUpperCase();
    if (!NOMOR_TIKET.test(nomor)) throw notFound();
    const whatsapp = normalisasiTelepon(data.whatsapp);
    const nilai = Number(data.nilai);
    if (!Number.isInteger(nilai) || nilai < 1 || nilai > 5) throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "nilai" must be 1-5.');
    if (typeof data.consent !== "boolean") throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "consent" is not valid.');
    await captcha(data.captcha);
    const tiket = rows(await db.raw(`SELECT id, status, whatsapp FROM konsultasi_tiket WHERE nomor = ?`, [nomor]))[0];
    if (!tiket || !whatsapp || normalisasiTelepon(tiket.whatsapp) !== whatsapp) throw notFound();
    if (tiket.status !== "selesai") throw new ProgramError(409, "TIKET_BELUM_SELESAI", "Only a completed ticket can be rated.");
    const simpan = rows(
      await db.raw(
        `INSERT INTO konsultasi_tiket_csat (tiket, nilai, consent) VALUES (?, ?, ?) ON CONFLICT (tiket) DO NOTHING RETURNING tiket`,
        [tiket.id, nilai, data.consent],
      ),
    );
    if (!simpan.length) throw new ProgramError(409, "CSAT_SUDAH_ADA", "This ticket has already been rated.");
    return { nomor, tersimpan: true, dihitung: data.consent };
  }
}

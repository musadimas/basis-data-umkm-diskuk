import { ProgramError, rows } from "../../lib/utils/http.js";
import { objectBody, oneOf, optionalText, uuidParam } from "../../lib/validate.js";
import { STATUS_LABEL } from "../../lib/outbox/index.js";
import { assertTransisi, assertVersi, cakupanPetugas, catatAudit } from "./penugasan.js";
import {
  ASPEK_DIAGNOSIS, NOMOR_TIKET, PRIORITAS, RUJUKAN, SLOTS, STATUS, bolehUbah, kunciPesan, nomorTiket, normalisasiTelepon, pesanPembatalan,
  pesanStatusBerubah, pesanTiket, sniffType, statusLabel, tanggalTidakValid, transisiUntuk,
} from "./rules.js";

/** Private Directus folder for ticket attachments (migration 20260926N). */
export const LAMPIRAN_FOLDER_ID = "0b8f2d4c-7a13-4c55-9e6d-3f1a2b9c8d70";
export const MAX_LAMPIRAN = 3;
export const MAX_LAMPIRAN_BYTES = 5 * 1024 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isStaff = (pemanggil) =>
  Boolean(pemanggil?.admin) || ["provinsi", "kabkota", "pendamping"].includes(pemanggil?.peran);
const notFound = () => new ProgramError(404, "TIKET_TIDAK_DITEMUKAN", "The ticket was not found.");

/** Galat batas multipart dengan kode domain klinik (dipasang adapter HTTP pada `readMultipart`). */
export const galatLampiran = {
  terlaluBesar: () => new ProgramError(400, "LAMPIRAN_TERLALU_BESAR", "Each attachment may be at most 5 MB."),
  terlaluBanyak: () => new ProgramError(400, "LAMPIRAN_TERLALU_BANYAK", "At most 3 attachments."),
};

/**
 * Usaha dan id pemohon untuk formulir publik (01): sesi yang tidak terbaca
 * diperlakukan sebagai anonim (usaha/id null), tidak pernah sebagai staf.
 * Berbeda dengan `muatPemanggil` yang menolak baris tak terbaca dengan 401 —
 * di sini penolakan itu akan mengunci pengunjung tanpa akun.
 */
async function pemohonKlinik(database, akun) {
  if (!akun?.user) return { id: null, usahaId: null };
  if (akun.admin) return { id: akun.user, usahaId: null };
  const row = rows(await database.raw(`SELECT id, usaha FROM directus_users WHERE id = ?`, [akun.user]))[0];
  if (!row) return { id: null, usahaId: null };
  return { id: row.id, usahaId: row.usaha ?? null };
}

/** Templat `rules.js` memakai `payload`; port Outbox menamainya `pesan`. */
const untukOutbox = ({ template, payload }) => ({ template, pesan: payload });

/** Validates the JSON payload of the booking form. `usaha` comes from the session, never the body. */
function parseTiket(payload, usaha, now) {
  let body;
  try {
    body = JSON.parse(payload ?? "");
  } catch {
    throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "payload" must be JSON.');
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ProgramError(400, "INVALID_PAYLOAD", "Invalid payload.");
  const invalid = (field) => new ProgramError(400, "INVALID_PAYLOAD", `The field "${field}" is not valid.`);
  const namaKontak = optionalText(body, "namaKontak", 120);
  const email = optionalText(body, "email", 160);
  const deskripsi = optionalText(body, "deskripsi", 3000);
  const whatsapp = normalisasiTelepon(body.whatsapp);
  const poli = Number(body.poli);
  const namaUsaha = usaha ? null : optionalText(body, "namaUsaha", 255);
  if (!usaha && !namaUsaha) throw invalid("namaUsaha");
  if (!namaKontak) throw invalid("namaKontak");
  if (!whatsapp) throw invalid("whatsapp");
  if (email && !EMAIL.test(email)) throw invalid("email");
  if (!deskripsi || deskripsi.length < 20) throw invalid("deskripsi");
  if (!Number.isInteger(poli) || poli < 1) throw invalid("poli");
  if (typeof body.consent !== "boolean") throw invalid("consent");
  const moda = oneOf(body, "moda", ["daring", "luring"]);
  const slot = oneOf(body, "slot", SLOTS);
  const tanggal = String(body.tanggal ?? "");
  const reason = tanggalTidakValid(tanggal, now);
  if (reason) throw new ProgramError(400, reason, "The date cannot be booked.");
  return { namaUsaha, namaKontak, whatsapp, email, deskripsi, poli, moda, slot, tanggal, consent: body.consent };
}

const TIKET_SELECT = `
  SELECT t.id, t.nomor, t.usaha, t.nama_usaha AS "namaUsaha", t.nama_kontak AS "namaKontak", t.whatsapp, t.email,
         t.poli, po.nama AS "poliNama", t.deskripsi, t.moda, t.jadwal_tanggal::text AS "jadwalTanggal",
         t.jadwal_slot AS "jadwalSlot", t.prioritas, t.status, t.pendamping, t.pemohon,
         t.sumber_identitas AS "sumberIdentitas", t.wa_consent AS "waConsent", ut.kota_id AS "kotaId",
         NULLIF(TRIM(CONCAT_WS(' ', pd.first_name, pd.last_name)), '') AS "pendampingNama",
         t.link_meet AS "linkMeet", t.diagnosis, t.action_plan AS "actionPlan", t.rujukan, t.catatan,
         t.date_created AS "dateCreated", t.date_updated AS "dateUpdated",
         -- Microsecond version the panel echoes back, so two officers cannot overwrite each other.
         to_char(t.date_updated AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS versi,
         -- Aduan PMSE mendesak (M7-13): the advocacy poli flagged as urgent.
         (po.kode = 'advokasi' AND t.prioritas = 'mendesak') AS "pmseMendesak",
         COALESCE((SELECT json_agg(json_build_object(
                          'aksi', a.aksi, 'statusDari', a.status_dari, 'statusKe', a.status_ke,
                          'perubahan', a.perubahan, 'aktorNama', a.aktor_nama, 'dateCreated', a.date_created)
                        ORDER BY a.date_created DESC, a.id DESC)
                     FROM (SELECT * FROM konsultasi_tiket_audit WHERE tiket = t.id
                            ORDER BY date_created DESC, id DESC LIMIT 20) a), '[]'::json) AS riwayat,
         COALESCE((SELECT json_agg(l.directus_files_id ORDER BY l.sort) FROM konsultasi_tiket_lampiran l
                    WHERE l.konsultasi_tiket_id = t.id), '[]'::json) AS lampiran,
         (SELECT json_build_object('status', n.status, 'jenis', n.jenis, 'template', n.template, 'attempts', n.attempts,
                                   'lastError', n.last_error, 'providerMessageId', n.provider_message_id,
                                   'terkirimAt', n.terkirim_at, 'diterimaAt', n.diterima_at)
            FROM notifikasi_outbox n WHERE n.tiket = t.id ORDER BY n.date_created DESC LIMIT 1) AS notifikasi
    FROM konsultasi_tiket t
    JOIN konsultasi_poli po ON po.id = t.poli
    LEFT JOIN usaha_tabular ut ON ut.id = t.usaha
    LEFT JOIN directus_users pd ON pd.id = t.pendamping`;

/**
 * Staff DTO of a ticket: the notification label plus what the web needs to stay rule-free, the
 * statuses this pemanggil may move it to (`transisi`) and its display label (`statusLabel`). The
 * business' kota only feeds `transisiUntuk`, so it is not sent on.
 */
function toTiketDto(pemanggil, { kotaId, ...row }) {
  return {
    ...row,
    statusLabel: statusLabel(row.status),
    transisi: transisiUntuk(pemanggil, { ...row, kotaId }),
    notifikasi: row.notifikasi ? { ...row.notifikasi, label: STATUS_LABEL[row.notifikasi.status] ?? row.notifikasi.status } : null,
  };
}

function parseUpdate(body) {
  const update = {};
  if (body.status !== undefined) update.status = oneOf(body, "status", STATUS);
  if (body.prioritas !== undefined) update.prioritas = oneOf(body, "prioritas", PRIORITAS);
  if (body.pendamping !== undefined) update.pendamping = body.pendamping === null ? null : uuidParam(body.pendamping, "INVALID_PAYLOAD");
  if (body.linkMeet !== undefined) {
    const link = optionalText(body, "linkMeet", 500);
    if (link && !/^https:\/\/\S+$/i.test(link)) throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "linkMeet" must be an https URL.');
    update.link_meet = link;
  }
  if (body.actionPlan !== undefined) update.action_plan = optionalText(body, "actionPlan", 5000);
  if (body.catatan !== undefined) update.catatan = optionalText(body, "catatan", 5000);
  if (body.diagnosis !== undefined) {
    const diagnosis = body.diagnosis;
    if (!diagnosis || typeof diagnosis !== "object" || Array.isArray(diagnosis)) throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "diagnosis" is not valid.');
    const clean = {};
    for (const [aspek, value] of Object.entries(diagnosis)) {
      if (!ASPEK_DIAGNOSIS.includes(aspek) || (value !== null && (typeof value !== "string" || value.length > 2000))) {
        throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "diagnosis" is not valid.');
      }
      if (value) clean[aspek] = value;
    }
    update.diagnosis = JSON.stringify(clean);
  }
  if (body.rujukan !== undefined) {
    if (!Array.isArray(body.rujukan) || !body.rujukan.every((item) => RUJUKAN.includes(item))) {
      throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "rujukan" is not valid.');
    }
    update.rujukan = JSON.stringify([...new Set(body.rujukan)]);
  }
  if (!Object.keys(update).length) throw new ProgramError(400, "INVALID_PAYLOAD", "Nothing to update.");
  return update;
}

/**
 * Use case Klinik Konsultasi. Validasi, transaksi, dan efek pasca-commit dimiliki di sini; adapter
 * HTTP (`index.js`) hanya memetakan request/response dan multipart.
 *
 * Dependensi:
 *  - `db`: knex.
 *  - `files`: port berkas `{ simpan({ buffer, filename, type, folder, title }) -> id, hapus(ids), baca(id) -> { stream, file } }`
 *    (adapter Directus di `index.js`; tes memakai fake in-memory).
 *  - `outbox`: outbox bersama (`lib/outbox`); `enqueue` berjalan di transaksi pemanggil.
 *  - `captcha`: `async (raw) => void`, melempar `CAPTCHA_INVALID`. Diverifikasi di sini karena
 *    urutannya bagian dari aturan: validasi -> captcha -> tulis.
 *  - `kick`: dipanggil setelah commit yang mengantre pesan (mendorong dispatcher; tidak pernah memblokir).
 *  - `clock`: sumber "sekarang" untuk rentang tanggal dan nomor tiket.
 *
 * `pemanggil` petugas = `{ id, admin, peran, kotaId, usahaId }`. Formulir publik menerima
 * `akun` (`accountability` Directus atau null) karena sesi yang tak terbaca harus dianggap anonim.
 */
export function createKlinik({ db, files, outbox, captcha, kick = () => {}, clock = () => new Date() }) {
  return { poli, prefill, slots, buatTiket, lacakTiket, listTiket, ubahStatusTiket, bacaLampiran };

  /** Meja konsultasi aktif dan topiknya (tanpa PII). */
  async function poli() {
    const result = await db.raw(`SELECT id, kode, nama, deskripsi, subtopik FROM konsultasi_poli WHERE aktif ORDER BY sort NULLS LAST, id`);
    return rows(result).map((row) => ({
      id: row.id,
      kode: row.kode,
      nama: row.nama,
      deskripsi: row.deskripsi,
      subtopik: Array.isArray(row.subtopik) ? row.subtopik : [],
    }));
  }

  /**
   * Prefill formulir: usaha dan kontak yang sudah tersimpan pada akun. Tidak ada NIB/NIK yang
   * ditukar lewat endpoint publik, jadi tidak ada lookup anonim yang bisa menguji keberadaan identitas.
   */
  async function prefill(pemanggil) {
    const kontak = rows(
      await db.raw(
        `SELECT NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), '') AS nama, email FROM directus_users WHERE id = ?`,
        [pemanggil.id],
      ),
    )[0];
    let usaha = null;
    if (pemanggil.usahaId) {
      usaha =
        rows(
          await db.raw(
            `SELECT u.nama, u.skala, t.kota_nama AS kota, kk.kode AS kbli, u.nomor_whatsapp AS whatsapp
               FROM usaha u
               LEFT JOIN usaha_tabular t ON t.id = u.id
               LEFT JOIN klasifikasi_usaha kk ON kk.id = u.klasifikasi
              WHERE u.id = ?`,
            [pemanggil.usahaId],
          ),
        )[0] ?? null;
    }
    return {
      usaha: usaha ? { nama: usaha.nama, skala: usaha.skala, kota: usaha.kota, kbli: usaha.kbli, sumber: "sidt" } : null,
      kontak: {
        nama: kontak?.nama ?? null,
        email: kontak?.email ?? null,
        whatsapp: usaha?.whatsapp ? normalisasiTelepon(usaha.whatsapp) : null,
      },
    };
  }

  /** Slot bebas satu poli pada satu hari; `query` = `{ poli, tanggal }` mentah dari URL. */
  async function slots(query = {}) {
    const idPoli = Number(query.poli);
    const tanggal = String(query.tanggal ?? "");
    if (!Number.isInteger(idPoli) || idPoli < 1) throw new ProgramError(400, "POLI_TIDAK_VALID", "The poli is not valid.");
    const reason = tanggalTidakValid(tanggal, clock());
    if (reason) throw new ProgramError(400, reason, "The date cannot be booked.");
    const taken = rows(
      await db.raw(`SELECT jadwal_slot FROM konsultasi_tiket WHERE poli = ? AND jadwal_tanggal = ? AND status <> 'batal'`, [idPoli, tanggal]),
    ).map((row) => row.jadwal_slot);
    return SLOTS.map((slot) => ({ slot, tersedia: !taken.includes(slot) }));
  }

  /**
   * Pesan slot dan kembalikan nomor tiket. `akun` = accountability Directus atau null (anonim);
   * `payload` = JSON mentah dari form; `lampiran` = `[{ filename, buffer }]`; `captchaRaw` = payload captcha.
   * Urutan: validasi -> sniff lampiran -> captcha -> poli/usaha -> unggah -> transaksi.
   * Pemesanan adalah satu transaksi: unique index slot adalah kuotanya, jadi dua pemesan yang berebut
   * slot yang sama menghasilkan satu tiket (409 untuk yang kalah) dan berkas yang sudah terunggah dihapus lagi.
   */
  async function buatTiket(akun, payload, lampiran, captchaRaw) {
    const pemohon = await pemohonKlinik(db, akun);
    const usaha = pemohon.usahaId;
    const input = parseTiket(payload, usaha, clock());
    const berkas = lampiran.map((file) => ({ ...file, type: sniffType(file.buffer) }));
    if (berkas.some((file) => !file.type)) {
      throw new ProgramError(400, "LAMPIRAN_TIDAK_DIDUKUNG", "Attachments must be PDF, JPG, PNG or WebP.");
    }
    await captcha(captchaRaw);

    const meja = rows(await db.raw(`SELECT id, nama FROM konsultasi_poli WHERE id = ? AND aktif`, [input.poli]))[0];
    if (!meja) throw new ProgramError(400, "POLI_TIDAK_VALID", "The poli is not valid.");
    let namaUsaha = input.namaUsaha;
    if (usaha) {
      // The owner's own business name wins: a payload cannot rename a SIDT business.
      namaUsaha = rows(await db.raw(`SELECT nama FROM usaha WHERE id = ?`, [usaha]))[0]?.nama ?? null;
    }

    // Upload first (outside the transaction); remove the files again if the booking fails.
    const fileIds = [];
    try {
      for (const file of berkas) {
        fileIds.push(
          await files.simpan({
            buffer: file.buffer,
            filename: file.filename,
            type: file.type,
            folder: LAMPIRAN_FOLDER_ID,
            title: `Lampiran klinik – ${file.filename}`,
          }),
        );
      }
      const tiket = await db.transaction(async (trx) => {
        const seq = rows(await trx.raw(`SELECT nextval('konsultasi_tiket_nomor_seq') AS n`))[0].n;
        let row;
        try {
          row = rows(
            await trx.raw(
              `INSERT INTO konsultasi_tiket
                 (nomor, usaha, nama_usaha, nama_kontak, whatsapp, email, poli, deskripsi, moda, jadwal_tanggal, jadwal_slot,
                  pemohon, sumber_identitas, wa_consent)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               RETURNING id, nomor, moda, jadwal_tanggal::text AS tanggal, jadwal_slot AS slot`,
              [nomorTiket(seq, clock()), usaha, namaUsaha, input.namaKontak, input.whatsapp, input.email, meja.id, input.deskripsi,
                input.moda, input.tanggal, input.slot, pemohon.id, usaha ? "sidt" : "manual", input.consent],
            ),
          )[0];
        } catch (error) {
          if (error?.code === "23505") throw new ProgramError(409, "SLOT_PENUH", "This slot has just been booked. Choose another.");
          throw error;
        }
        for (const [index, fileId] of fileIds.entries()) {
          await trx.raw(
            `INSERT INTO konsultasi_tiket_lampiran (konsultasi_tiket_id, directus_files_id, sort) VALUES (?, ?, ?)`,
            [row.id, fileId, index + 1],
          );
        }
        await outbox.enqueue(trx, {
          kunci: kunciPesan(row.id, "tiket_dibuat"),
          jenis: "tiket_dibuat",
          sumber: { tiket: row.id },
          ...untukOutbox(pesanTiket({ nomor: row.nomor, poli_nama: meja.nama, jadwal_tanggal: row.tanggal, jadwal_slot: row.slot, moda: row.moda })),
          tujuan: input.whatsapp,
          // Same rule as a status change: the number belongs to the signed-in owner of a SIDT
          // business, not to a name typed by hand.
          tujuanTerverifikasi: Boolean(usaha),
          consent: input.consent,
        });
        return row;
      });
      kick();
      return {
        nomor: tiket.nomor,
        poli: meja.nama,
        moda: tiket.moda,
        tanggal: tiket.tanggal,
        slot: tiket.slot,
        sumberIdentitas: usaha ? "sidt" : "manual",
        notifikasi: (await outbox.statusUntuk({ tiket: tiket.id })) ?? { status: "batal", label: STATUS_LABEL.batal },
      };
    } catch (error) {
      if (fileIds.length) await files.hapus(fileIds).catch(() => {});
      throw error;
    }
  }

  /**
   * Baca ulang tiket: butuh nomor tiket DAN nomor WhatsApp pemesanan, sehingga endpoint tidak bisa
   * dipakai untuk menyisir tiket orang lain.
   */
  async function lacakTiket(body) {
    const data = objectBody({ body });
    const nomor = String(data.nomor ?? "").trim().toUpperCase();
    if (!NOMOR_TIKET.test(nomor)) throw notFound();
    const whatsapp = normalisasiTelepon(data.whatsapp);
    await captcha(data.captcha);
    const tiket = rows(
      await db.raw(
        `SELECT t.nomor, t.nama_usaha AS "namaUsaha", t.status, t.moda, t.jadwal_tanggal::text AS tanggal, t.jadwal_slot AS slot,
                t.whatsapp, t.sumber_identitas AS "sumberIdentitas", po.nama AS "poliNama", t.id AS "tiketId"
           FROM konsultasi_tiket t JOIN konsultasi_poli po ON po.id = t.poli
          WHERE t.nomor = ?`,
        [nomor],
      ),
    )[0];
    if (!tiket || !whatsapp || normalisasiTelepon(tiket.whatsapp) !== whatsapp) throw notFound();
    return {
      nomor: tiket.nomor,
      namaUsaha: tiket.namaUsaha,
      poli: tiket.poliNama,
      status: tiket.status,
      moda: tiket.moda,
      tanggal: tiket.tanggal,
      slot: tiket.slot,
      sumberIdentitas: tiket.sumberIdentitas,
      notifikasi: (await outbox.statusUntuk({ tiket: tiket.tiketId })) ?? { status: "batal", label: STATUS_LABEL.batal },
    };
  }

  /** Tiket yang boleh dikerjakan petugas ini (provinsi melihat semua, lihat penugasan.js). */
  async function listTiket(pemanggil, query = {}) {
    const status = query.status ? oneOf(query, "status", STATUS) : null;
    const cakupan = cakupanPetugas(pemanggil);
    const result = await db.raw(
      `${TIKET_SELECT}
        WHERE ${cakupan.sql} AND ((?::text IS NULL AND t.status <> 'batal') OR t.status = ?)
        ORDER BY CASE t.prioritas WHEN 'mendesak' THEN 0 WHEN 'tinggi' THEN 1 ELSE 2 END, t.jadwal_tanggal, t.jadwal_slot
        LIMIT 500`,
      [...cakupan.bindings, status, status],
    );
    return rows(result).map((row) => toTiketDto(pemanggil, row));
  }

  /**
   * Geser di kanban, tugaskan, jadwalkan, catat sesi. `versi` (timestamp mikrodetik yang terakhir
   * dilihat klien) wajib: tanpa itu kunci optimistis opsional dan dua petugas bisa saling menimpa (B24).
   * Baris, audit, dan pesan outbox commit atau rollback bersama.
   */
  async function ubahStatusTiket(pemanggil, tiketId, body, versi) {
    const id = uuidParam(tiketId);
    const data = objectBody({ body });
    const update = parseUpdate(data);
    const columns = Object.keys(update);
    const casts = { diagnosis: "::jsonb", rujukan: "::jsonb" };
    const updated = await db.transaction(async (trx) => {
      const current = rows(
        await trx.raw(
          `SELECT t.id, t.status, t.pendamping, t.pemohon, t.wa_consent AS "waConsent", t.whatsapp,
                  t.sumber_identitas AS "sumberIdentitas", ut.kota_id AS "kotaId",
                  NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS "aktorNama",
                  to_char(t.date_updated AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS versi
             FROM konsultasi_tiket t
             LEFT JOIN usaha_tabular ut ON ut.id = t.usaha
             LEFT JOIN directus_users u ON u.id = ?
            WHERE t.id = ?
            FOR UPDATE OF t`,
          [pemanggil.id, id],
        ),
      )[0];
      if (!current) throw notFound();
      // Officer scope, stage order and the version the client saw, all before any write.
      assertVersi(versi, current.versi);
      if (!bolehUbah(pemanggil, current, update)) {
        throw new ProgramError(403, "BUKAN_PENUGASAN_ANDA", "This ticket is not assigned to you.");
      }
      assertTransisi(update, current.status);
      try {
        await trx.raw(
          `UPDATE konsultasi_tiket SET ${columns.map((column) => `${column} = ?${casts[column] ?? ""}`).join(", ")}, date_updated = NOW() WHERE id = ?`,
          [...columns.map((column) => update[column]), id],
        );
      } catch (error) {
        // Re-opening a cancelled ticket whose slot was taken meanwhile.
        if (error?.code === "23505") throw new ProgramError(409, "SLOT_PENUH", "The slot is already taken by another ticket.");
        throw error;
      }
      await catatAudit(trx, {
        tiket: id,
        aktor: pemanggil.id,
        aktorNama: current.aktorNama,
        statusDari: current.status,
        statusKe: update.status,
        perubahan: update,
      });
      const row = rows(await trx.raw(`${TIKET_SELECT} WHERE t.id = ?`, [id]))[0];
      // One message per transition: repeating the same status never queues a second one.
      if (update.status && update.status !== current.status) {
        const batal = update.status === "batal";
        const jenis = batal ? "pembatalan" : "status_berubah";
        const tiket = { nomor: row.nomor };
        await outbox.enqueue(trx, {
          // Versi baris setelah update masuk ke kunci idempotensi (B15).
          kunci: kunciPesan(row.id, jenis, update.status, row.versi),
          jenis,
          sumber: { tiket: row.id },
          ...untukOutbox(batal ? pesanPembatalan(tiket) : pesanStatusBerubah(tiket, update.status)),
          tujuan: normalisasiTelepon(row.whatsapp),
          tujuanTerverifikasi: row.sumberIdentitas === "sidt",
          consent: row.waConsent,
        });
      }
      return row;
    });
    kick();
    return toTiketDto(pemanggil, updated);
  }

  /**
   * Buka lampiran tiket: pemohon pada tiket itu, atau petugas yang kanbannya mencakup tiketnya.
   * Berkas klinis ada di folder privat yang tidak dibuka policy Directus mana pun, jadi ini satu-satunya
   * jalan masuk. Berkas yang bukan lampiran, atau di luar jangkauan, mendapat 404 yang sama dengan berkas
   * yang tidak ada. Mengembalikan `{ stream, file }` dari port berkas.
   */
  async function bacaLampiran(pemanggil, fileIdParam) {
    const fileId = uuidParam(fileIdParam, "LAMPIRAN_TIDAK_DITEMUKAN");
    const cakupan = isStaff(pemanggil) ? cakupanPetugas(pemanggil) : { sql: "FALSE", bindings: [] };
    const milik = rows(
      await db.raw(
        `SELECT t.pemohon, t.usaha, (${cakupan.sql}) AS dalam_cakupan FROM konsultasi_tiket_lampiran l
           JOIN konsultasi_tiket t ON t.id = l.konsultasi_tiket_id
          WHERE l.directus_files_id = ?`,
        [...cakupan.bindings, fileId],
      ),
    )[0];
    const boleh =
      Boolean(milik) &&
      (milik.dalam_cakupan === true ||
        (milik.pemohon && milik.pemohon === pemanggil.id) ||
        (milik.usaha && pemanggil.usahaId && milik.usaha === pemanggil.usahaId));
    if (!boleh) throw new ProgramError(404, "LAMPIRAN_TIDAK_DITEMUKAN", "The attachment was not found.");
    return files.baca(fileId);
  }
}

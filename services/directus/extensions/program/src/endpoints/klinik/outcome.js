/**
 * Outcome klinik (R04, N7-05): hasil kepatuhan/perbaikan usaha dari tiket `selesai`.
 *
 * Alur dua langkah, dua aktor: petugas yang menangani tiket mengajukan outcome (`diajukan`); provinsi
 * atau kab/kota pemilik wilayah usahanya memverifikasi (`terverifikasi`) — orangnya tidak boleh sama
 * dengan pengaju. Hanya baris `terverifikasi` yang dibaca profil usaha dan indikator IP-UMKM. Koreksi
 * membuat versi baru dan mencabut versi lama; pencabutan mengeluarkan efeknya dari profil. Setiap
 * perubahan meninggalkan satu baris `konsultasi_outcome_audit`.
 *
 * Outcome sengaja terstruktur: hanya daftar (atribut, jenis). Diagnosis, rencana aksi, catatan, dan tautan
 * rapat tiket tidak pernah ikut ke outcome, jadi tidak mungkin bocor ke profil.
 *
 * Idempotensi: satu outcome hidup per tiket (partial unique), pengajuan diserialkan oleh kunci baris
 * tiket, dan retry dengan isi yang sama mengembalikan outcome yang ada dengan `duplikat: true`.
 */
import { ProgramError, rows } from "../../lib/utils/http.js";
import { objectBody, oneOf, optionalText, uuidParam } from "../../lib/validate.js";
import {
  ATRIBUT_OUTCOME, JENIS_OUTCOME, LABEL_STATUS_OUTCOME, STATUS_OUTCOME, aksiOutcomeUntuk, bolehVerifikasiOutcome, sidikOutcome,
} from "./rules.js";

const notFound = () => new ProgramError(404, "OUTCOME_TIDAK_DITEMUKAN", "The outcome was not found.");
const invalid = (pesan) => new ProgramError(400, "OUTCOME_TIDAK_VALID", pesan);

/** Daftar item outcome dari body: 1..15 atribut Jabar unik, masing-masing berjenis kepatuhan atau perbaikan. */
export function parseItemsOutcome(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > Object.keys(ATRIBUT_OUTCOME).length) {
    throw invalid('The field "items" must list 1-15 attributes.');
  }
  const dilihat = new Set();
  return items.map((item) => {
    const atribut = item?.atribut;
    if (!Object.hasOwn(ATRIBUT_OUTCOME, atribut) || !JENIS_OUTCOME.includes(item?.jenis)) throw invalid("An outcome item is not valid.");
    if (dilihat.has(atribut)) throw invalid("An attribute can appear only once.");
    dilihat.add(atribut);
    return { atribut, jenis: item.jenis };
  });
}

/** Alasan koreksi/cabut: wajib, karena keduanya menghapus efek dari profil dan harus bisa dipertanggungjawabkan. */
function parseAlasan(body) {
  const alasan = optionalText(body, "alasan", 500);
  if (!alasan || alasan.length < 5) throw invalid('The field "alasan" is required (at least 5 characters).');
  return alasan;
}

/** Baris terbaru tiket → DTO petugas; `aksi` datang dari server, id pengaju tidak ikut terkirim. */
export function toOutcomeDto(pemanggil, outcome, kotaId) {
  if (!outcome) return null;
  const { diajukanOleh, items, ...sisa } = outcome;
  return {
    ...sisa,
    statusLabel: LABEL_STATUS_OUTCOME[outcome.status] ?? outcome.status,
    items: (items ?? []).map((item) => ({ ...item, label: ATRIBUT_OUTCOME[item.atribut] ?? item.atribut })),
    aksi: aksiOutcomeUntuk(pemanggil, { status: outcome.status, diajukanOleh }, kotaId),
  };
}

/** Subquery outcome terbaru satu tiket (alias `t`), dipakai TIKET_SELECT. Mengembalikan json atau NULL. */
export const OUTCOME_TERBARU_SQL = `(SELECT json_build_object(
          'id', o.id, 'versi', o.versi, 'status', o.status, 'diajukanOleh', o.diajukan_oleh, 'diajukanNama', o.diajukan_nama,
          'diajukanPada', o.diajukan_pada, 'diverifikasiNama', o.diverifikasi_nama, 'diverifikasiPada', o.diverifikasi_pada,
          'dicabutNama', o.dicabut_nama, 'dicabutPada', o.dicabut_pada, 'alasanCabut', o.alasan_cabut,
          'items', COALESCE((SELECT json_agg(json_build_object('atribut', i.atribut, 'jenis', i.jenis) ORDER BY i.atribut)
                               FROM konsultasi_outcome_item i WHERE i.outcome = o.id), '[]'::json))
     FROM konsultasi_outcome o WHERE o.tiket = t.id ORDER BY o.versi DESC LIMIT 1)`;

async function auditOutcome(trx, { outcome, aktor, aktorNama, aksi, statusDari, statusKe, versi, alasan = null }) {
  await trx.raw(
    `INSERT INTO konsultasi_outcome_audit (outcome, aktor, aktor_nama, aksi, status_dari, status_ke, versi, alasan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [outcome, aktor ?? null, aktorNama ? String(aktorNama).slice(0, 160) : null, aksi, statusDari, statusKe, versi, alasan],
  );
}

async function namaAktor(trx, userId) {
  return rows(await trx.raw(`SELECT NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), '') AS nama FROM directus_users WHERE id = ?`, [userId]))[0]?.nama ?? null;
}

async function itemsOutcome(trx, outcomeId) {
  return rows(await trx.raw(`SELECT atribut, jenis FROM konsultasi_outcome_item WHERE outcome = ?`, [outcomeId]));
}

async function sisipkanOutcome(trx, { tiketId, usahaId, versi, status, pemanggil, aktorNama, items, menggantikan = null }) {
  const verifikasi = status === "terverifikasi";
  const baris = rows(
    await trx.raw(
      `INSERT INTO konsultasi_outcome
         (tiket, usaha, versi, status, diajukan_oleh, diajukan_nama, diverifikasi_oleh, diverifikasi_nama, diverifikasi_pada, menggantikan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${verifikasi ? "NOW()" : "NULL"}, ?)
       RETURNING id`,
      [tiketId, usahaId, versi, status, pemanggil.id, aktorNama, verifikasi ? pemanggil.id : null, verifikasi ? aktorNama : null, menggantikan],
    ),
  )[0];
  for (const item of items) {
    await trx.raw(`INSERT INTO konsultasi_outcome_item (outcome, atribut, jenis) VALUES (?, ?, ?)`, [baris.id, item.atribut, item.jenis]);
  }
  return baris.id;
}

/**
 * Cakupan verifikator pada daftar outcome (alias `o`): provinsi semua; kab/kota hanya usaha di kotanya.
 * Peran lain tidak pernah sampai sini (dijaga route), tetapi gagal tertutup bila sampai.
 */
function cakupanVerifikator(pemanggil) {
  if (pemanggil?.admin || pemanggil?.peran === "provinsi") return { sql: "TRUE", bindings: [] };
  if (pemanggil?.peran === "kabkota") {
    if (pemanggil.kotaId == null) throw new ProgramError(403, "KOTA_NOT_ASSIGNED", "Petugas kab/kota belum memiliki penugasan kota.");
    return { sql: "EXISTS (SELECT 1 FROM usaha_tabular ut WHERE ut.id = o.usaha AND ut.kota_id = ?)", bindings: [pemanggil.kotaId] };
  }
  return { sql: "FALSE", bindings: [] };
}

export function createOutcome({ db }) {
  return { catatDalamTransaksi, catat, daftar, verifikasi, koreksi, cabut };

  /**
   * Ajukan outcome dari tiket yang baris + statusnya sudah dikunci pemanggil (`FOR UPDATE`). Dipakai
   * langsung oleh `catat` dan oleh penutupan tiket (PATCH status `selesai` + outcome) di transaksi yang sama.
   */
  async function catatDalamTransaksi(trx, { tiket, items, pemanggil }) {
    if (!tiket.usaha) {
      throw new ProgramError(409, "USAHA_TIDAK_TERTAUT", "Only a ticket of a registered business can produce an outcome.");
    }
    if (tiket.status !== "selesai") throw new ProgramError(409, "TIKET_BELUM_SELESAI", "The ticket must be completed first.");
    const terbaru = rows(
      await trx.raw(`SELECT id, versi, status FROM konsultasi_outcome WHERE tiket = ? ORDER BY versi DESC LIMIT 1`, [tiket.id]),
    )[0];
    if (terbaru && terbaru.status !== "dicabut") {
      if (sidikOutcome(await itemsOutcome(trx, terbaru.id)) === sidikOutcome(items)) return { id: terbaru.id, duplikat: true };
      throw new ProgramError(409, "OUTCOME_SUDAH_ADA", "This ticket already has an outcome. Correct it instead.");
    }
    const aktorNama = await namaAktor(trx, pemanggil.id);
    const versi = (terbaru?.versi ?? 0) + 1;
    let id;
    try {
      id = await sisipkanOutcome(trx, { tiketId: tiket.id, usahaId: tiket.usaha, versi, status: "diajukan", pemanggil, aktorNama, items });
    } catch (error) {
      if (error?.code === "23505") throw new ProgramError(409, "OUTCOME_SUDAH_ADA", "This ticket already has an outcome. Correct it instead.");
      throw error;
    }
    await auditOutcome(trx, { outcome: id, aktor: pemanggil.id, aktorNama, aksi: "ajukan", statusDari: null, statusKe: "diajukan", versi });
    return { id, duplikat: false };
  }

  /** POST /tiket/:id/outcome pada tiket yang sudah `selesai`; `boleh` = aturan penugasan tiket dari service. */
  async function catat(pemanggil, tiketId, body, boleh) {
    const id = uuidParam(tiketId);
    const items = parseItemsOutcome(objectBody({ body }).items);
    return db.transaction(async (trx) => {
      const tiket = rows(
        await trx.raw(
          `SELECT t.id, t.usaha, t.status, t.pendamping, ut.kota_id AS "kotaId"
             FROM konsultasi_tiket t LEFT JOIN usaha_tabular ut ON ut.id = t.usaha
            WHERE t.id = ? FOR UPDATE OF t`,
          [id],
        ),
      )[0];
      if (!tiket || !boleh(tiket)) {
        // Di luar cakupan sama dengan tidak ada: 404 tidak menjadi oracle keberadaan tiket.
        throw new ProgramError(404, "TIKET_TIDAK_DITEMUKAN", "The ticket was not found.");
      }
      return catatDalamTransaksi(trx, { tiket, items, pemanggil });
    });
  }

  /** Antrean verifikasi (default `diajukan`) untuk provinsi/kab-kota dalam cakupannya. */
  async function daftar(pemanggil, query = {}) {
    const status = query.status ? oneOf(query, "status", STATUS_OUTCOME) : "diajukan";
    const cakupan = cakupanVerifikator(pemanggil);
    const hasil = rows(
      await db.raw(
        `SELECT o.id, o.versi, o.status, o.diajukan_oleh AS "diajukanOleh", o.diajukan_nama AS "diajukanNama",
                o.diajukan_pada AS "diajukanPada", o.diverifikasi_nama AS "diverifikasiNama", o.diverifikasi_pada AS "diverifikasiPada",
                o.dicabut_nama AS "dicabutNama", o.dicabut_pada AS "dicabutPada", o.alasan_cabut AS "alasanCabut",
                t.nomor AS "nomorTiket", t.nama_usaha AS "namaUsaha", po.nama AS poli, ut.kota_id AS "kotaId",
                COALESCE((SELECT json_agg(json_build_object('atribut', i.atribut, 'jenis', i.jenis) ORDER BY i.atribut)
                            FROM konsultasi_outcome_item i WHERE i.outcome = o.id), '[]'::json) AS items
           FROM konsultasi_outcome o
           JOIN konsultasi_tiket t ON t.id = o.tiket
           JOIN konsultasi_poli po ON po.id = t.poli
           LEFT JOIN usaha_tabular ut ON ut.id = o.usaha
          WHERE ${cakupan.sql} AND o.status = ?
          ORDER BY o.diajukan_pada, o.id
          LIMIT 200`,
        [...cakupan.bindings, status],
      ),
    );
    return hasil.map(({ kotaId, ...row }) => toOutcomeDto(pemanggil, row, kotaId));
  }

  /** Muat + kunci satu outcome dan pastikan pemanggil boleh mengelolanya (di luar wilayah = 404). */
  async function muat(trx, pemanggil, idParam) {
    const id = uuidParam(idParam, "OUTCOME_TIDAK_DITEMUKAN");
    const row = rows(
      await trx.raw(
        `SELECT o.id, o.tiket, o.usaha, o.versi, o.status, o.diajukan_oleh AS "diajukanOleh", ut.kota_id AS "kotaId"
           FROM konsultasi_outcome o LEFT JOIN usaha_tabular ut ON ut.id = o.usaha
          WHERE o.id = ? FOR UPDATE OF o`,
        [id],
      ),
    )[0];
    if (!row || !bolehVerifikasiOutcome(pemanggil, row.kotaId)) throw notFound();
    return row;
  }

  async function verifikasi(pemanggil, idParam) {
    return db.transaction(async (trx) => {
      const outcome = await muat(trx, pemanggil, idParam);
      // Retry (atau verifikator lain yang terlambat) atas outcome yang sudah terverifikasi: tidak ada perubahan.
      if (outcome.status === "terverifikasi") return { id: outcome.id, versi: outcome.versi, status: outcome.status, duplikat: true };
      if (outcome.status === "dicabut") throw new ProgramError(409, "OUTCOME_DICABUT", "This outcome has been revoked.");
      if (outcome.diajukanOleh === pemanggil.id) {
        throw new ProgramError(409, "VERIFIKATOR_SAMA", "An outcome must be verified by someone other than the submitter.");
      }
      const aktorNama = await namaAktor(trx, pemanggil.id);
      await trx.raw(
        `UPDATE konsultasi_outcome SET status = 'terverifikasi', diverifikasi_oleh = ?, diverifikasi_nama = ?, diverifikasi_pada = NOW() WHERE id = ?`,
        [pemanggil.id, aktorNama, outcome.id],
      );
      await auditOutcome(trx, {
        outcome: outcome.id, aktor: pemanggil.id, aktorNama, aksi: "verifikasi", statusDari: "diajukan", statusKe: "terverifikasi", versi: outcome.versi,
      });
      return { id: outcome.id, versi: outcome.versi, status: "terverifikasi", duplikat: false };
    });
  }

  /**
   * Koreksi isi outcome: versi baru langsung `terverifikasi` (pengoreksi adalah verifikator), versi lama
   * `dicabut` dengan alasan. Efek pada profil berganti dalam satu transaksi, jadi tidak pernah ada waktu
   * ketika kedua versi (atau tidak satu pun) dihitung. Mengulang koreksi yang sama mengembalikan versi baru.
   */
  async function koreksi(pemanggil, idParam, body) {
    const data = objectBody({ body });
    const items = parseItemsOutcome(data.items);
    const alasan = parseAlasan(data);
    return db.transaction(async (trx) => {
      const outcome = await muat(trx, pemanggil, idParam);
      if (outcome.status === "dicabut") {
        const pengganti = rows(await trx.raw(`SELECT id, versi, status FROM konsultasi_outcome WHERE menggantikan = ?`, [outcome.id]))[0];
        if (pengganti && sidikOutcome(await itemsOutcome(trx, pengganti.id)) === sidikOutcome(items)) {
          return { id: pengganti.id, versi: pengganti.versi, status: pengganti.status, duplikat: true };
        }
        throw new ProgramError(409, "OUTCOME_DICABUT", "This outcome has been revoked.");
      }
      if (sidikOutcome(await itemsOutcome(trx, outcome.id)) === sidikOutcome(items)) {
        throw new ProgramError(409, "OUTCOME_TIDAK_BERUBAH", "The corrected outcome is identical to the current one.");
      }
      const aktorNama = await namaAktor(trx, pemanggil.id);
      const versiBaru = rows(await trx.raw(`SELECT MAX(versi) + 1 AS versi FROM konsultasi_outcome WHERE tiket = ?`, [outcome.tiket]))[0].versi;
      // Yang lama harus keluar dulu: indeks unik parsial hanya mengizinkan satu outcome hidup per tiket.
      await trx.raw(
        `UPDATE konsultasi_outcome SET status = 'dicabut', dicabut_oleh = ?, dicabut_nama = ?, dicabut_pada = NOW(), alasan_cabut = ? WHERE id = ?`,
        [pemanggil.id, aktorNama, `Dikoreksi ke versi ${versiBaru}: ${alasan}`.slice(0, 500), outcome.id],
      );
      const id = await sisipkanOutcome(trx, {
        tiketId: outcome.tiket, usahaId: outcome.usaha, versi: versiBaru, status: "terverifikasi", pemanggil, aktorNama, items, menggantikan: outcome.id,
      });
      await auditOutcome(trx, {
        outcome: outcome.id, aktor: pemanggil.id, aktorNama, aksi: "koreksi", statusDari: outcome.status, statusKe: "dicabut", versi: outcome.versi, alasan,
      });
      await auditOutcome(trx, {
        outcome: id, aktor: pemanggil.id, aktorNama, aksi: "koreksi", statusDari: null, statusKe: "terverifikasi", versi: versiBaru, alasan,
      });
      return { id, versi: versiBaru, status: "terverifikasi", duplikat: false };
    });
  }

  /** Cabut outcome (mis. salah catat): efeknya langsung hilang dari profil/indikator. Retry aman. */
  async function cabut(pemanggil, idParam, body) {
    const alasan = parseAlasan(objectBody({ body }));
    return db.transaction(async (trx) => {
      const outcome = await muat(trx, pemanggil, idParam);
      if (outcome.status === "dicabut") return { id: outcome.id, versi: outcome.versi, status: "dicabut", duplikat: true };
      const aktorNama = await namaAktor(trx, pemanggil.id);
      await trx.raw(
        `UPDATE konsultasi_outcome SET status = 'dicabut', dicabut_oleh = ?, dicabut_nama = ?, dicabut_pada = NOW(), alasan_cabut = ? WHERE id = ?`,
        [pemanggil.id, aktorNama, alasan, outcome.id],
      );
      await auditOutcome(trx, {
        outcome: outcome.id, aktor: pemanggil.id, aktorNama, aksi: "cabut", statusDari: outcome.status, statusKe: "dicabut", versi: outcome.versi, alasan,
      });
      return { id: outcome.id, versi: outcome.versi, status: "dicabut", duplikat: false };
    });
  }
}

import { ProgramError, noStore, rows, sendError } from "../../lib/utils/http.js";
import { loadLegalitas, loadUsahaSummary } from "../../lib/usaha.js";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";
import {
  flag,
  objectBody,
  oneOf,
  optionalNumber,
  optionalText,
  optionalUuid,
  uuidParam,
  UUID,
} from "../../lib/validate.js";
import { JENIS_LEGALITAS, hitungSkor, mergeLegalitas, rekomendasiOf } from "./scoring.js";

const KESIAPAN_STATUS = ["belum", "dalam_proses", "terbit"];
const LIST_STATUS = ["draft", "dinilai", "disetujui", "ditolak"];
const MAX_BERITA_ACARA_ITEMS = 200;
// Knex expands array bindings into value lists, so id arrays are bound as one JSON text value.
const { pastikanUsaha } = cakupan;
const ID_LIST = "SELECT jsonb_array_elements_text(?::jsonb)::uuid";

const PENGAJUAN_COLUMNS = `p.id, p.usaha, p.status, p.kapasitas_produksi, p.satuan, p.kesiapan_legalitas,
  p.literasi_qris, p.literasi_pembukuan_digital, p.surat_komitmen, p.skor_finansial, p.skor_pasar,
  p.skor_legalitas, p.skor_sdm, p.skor_total, p.rubrik_versi, p.dinilai_at, p.catatan,
  p.alasan_tolak, p.ditolak_at,
  p.berita_acara, p.date_created, p.date_updated`;

const num = (value) => (value === null || value === undefined ? null : Number(value));

export function toPengajuan(row) {
  return {
    id: row.id,
    usaha: row.usaha,
    status: row.status,
    kapasitasProduksi: num(row.kapasitas_produksi),
    satuan: row.satuan,
    kesiapanLegalitas: row.kesiapan_legalitas ?? {},
    literasiQris: Boolean(row.literasi_qris),
    literasiPembukuanDigital: Boolean(row.literasi_pembukuan_digital),
    suratKomitmen: row.surat_komitmen,
    skor:
      row.skor_total === null || row.skor_total === undefined
        ? null
        : {
            finansial: num(row.skor_finansial),
            pasar: num(row.skor_pasar),
            legalitas: num(row.skor_legalitas),
            sdm: num(row.skor_sdm),
            total: num(row.skor_total),
            rekomendasi: rekomendasiOf(num(row.skor_total)),
            rubrikVersi: row.rubrik_versi,
          },
    dinilaiAt: row.dinilai_at,
    catatan: row.catatan,
    alasanTolak: row.alasan_tolak ?? null,
    ditolakAt: row.ditolak_at ?? null,
    beritaAcara: row.berita_acara,
    dateCreated: row.date_created,
    dateUpdated: row.date_updated,
  };
}

/** Jabar-specific fields of a submission from the request body. */
function parseFields(body) {
  const kesiapan = body.kesiapanLegalitas ?? {};
  if (!kesiapan || typeof kesiapan !== "object" || Array.isArray(kesiapan)) {
    throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "kesiapanLegalitas" is not valid.');
  }
  const kesiapanLegalitas = {};
  for (const [jenis, status] of Object.entries(kesiapan)) {
    if (!JENIS_LEGALITAS.includes(jenis) || !KESIAPAN_STATUS.includes(status)) {
      throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "kesiapanLegalitas" is not valid.');
    }
    kesiapanLegalitas[jenis] = status;
  }
  return {
    kapasitas_produksi: optionalNumber(body, "kapasitasProduksi", { min: 0, max: 1e12 }),
    satuan: optionalText(body, "satuan", 32),
    kesiapan_legalitas: JSON.stringify(kesiapanLegalitas),
    literasi_qris: flag(body, "literasiQris"),
    literasi_pembukuan_digital: flag(body, "literasiPembukuanDigital"),
    surat_komitmen: optionalUuid(body, "suratKomitmen"),
    catatan: optionalText(body, "catatan", 2000),
  };
}

async function findPengajuan(database, id, { lock = false } = {}) {
  const result = await database.raw(
    `SELECT ${PENGAJUAN_COLUMNS} FROM talent_pengajuan p WHERE p.id = ?${lock ? " FOR UPDATE" : ""}`,
    [id],
  );
  const row = rows(result)[0];
  if (!row) throw new ProgramError(404, "PENGAJUAN_NOT_FOUND", "The submission was not found.");
  return row;
}

function requireStatus(row, status, code) {
  if (row.status !== status) {
    throw new ProgramError(409, code, "The submission is not in the required status.");
  }
}

/** TS-15/TS-17: skor dan pengajuan butuh kapasitas produksi > 0 dan satuan. */
function requireLengkap(row) {
  const kapasitas = num(row.kapasitas_produksi);
  if (!(kapasitas > 0) || !String(row.satuan ?? "").trim()) {
    throw new ProgramError(422, "DATA_BELUM_LENGKAP", "Kapasitas produksi dan satuan wajib diisi.");
  }
}

const handle = (logger, res, fn) =>
  fn().catch((error) => sendError(res, logger, error));

/** GET /usaha/:usahaId — SIDT data (masked), certificates and the latest submission. */
export const readUsaha =
  ({ database, logger }) =>
  (req, res, pemanggil) =>
    handle(logger, res, async () => {
      const usahaId = uuidParam(req.params?.usahaId, "INVALID_USAHA_ID");
      await pastikanUsaha(database, pemanggil, usahaId);
      const usaha = await loadUsahaSummary(database, usahaId);
      const legalitas = await loadLegalitas(database, usahaId);
      const latest = rows(
        await database.raw(
          `SELECT ${PENGAJUAN_COLUMNS} FROM talent_pengajuan p WHERE p.usaha = ? ORDER BY p.date_created DESC LIMIT 1`,
          [usahaId],
        ),
      )[0];
      noStore(res);
      res.json({ data: { usaha, legalitas, pengajuan: latest ? toPengajuan(latest) : null } });
    });

/** GET /pengajuan?status=dinilai — submissions for the curation panel, best score first. */
export const listPengajuan =
  ({ database, logger }) =>
  (req, res, pemanggil) =>
    handle(logger, res, async () => {
      const status = req.query?.status ? oneOf(req.query, "status", LIST_STATUS) : null;
      const provinsiWide = pemanggil.admin || pemanggil.peran === "provinsi";
      // A kab/kota officer without a kota must not fall through to the province-wide list.
      if (!provinsiWide && !pemanggil.kotaId) {
        throw new ProgramError(403, "KOTA_NOT_ASSIGNED", "Petugas kab/kota belum memiliki penugasan kota.");
      }
      const kotaScope = provinsiWide ? null : pemanggil.kotaId;
      const result = await database.raw(
        `SELECT ${PENGAJUAN_COLUMNS}, u.nama AS usaha_nama, u.nib AS usaha_nib, u.skala AS usaha_skala,
                t.kota_nama AS usaha_kota
           FROM talent_pengajuan p
           JOIN usaha u ON u.id = p.usaha
           LEFT JOIN usaha_tabular t ON t.id = p.usaha
          WHERE (?::text IS NULL OR p.status = ?)
            AND (?::integer IS NULL OR t.kota_id = ?)
            AND (p.status <> 'ditolak' OR NOT EXISTS (
                  SELECT 1 FROM talent_pengajuan baru
                   WHERE baru.usaha = p.usaha AND baru.date_created > p.date_created))
          ORDER BY p.skor_total DESC NULLS LAST, p.date_created DESC
          LIMIT 500`,
        [status, status, kotaScope, kotaScope],
      );
      noStore(res);
      res.json({
        data: rows(result).map((row) => ({
          ...toPengajuan(row),
          usahaInfo: { nama: row.usaha_nama, nib: row.usaha_nib, skala: row.usaha_skala, kota: row.usaha_kota },
        })),
      });
    });

/** POST /pengajuan — open a submission for a business (moves it to "nominated"). */
export const createPengajuan =
  ({ database, logger }) =>
  (req, res, pemanggil) =>
    handle(logger, res, async () => {
      const body = objectBody(req);
      const usahaId = uuidParam(body.usaha, "INVALID_USAHA_ID");
      const fields = parseFields(body);
      const created = await database.transaction(async (trx) => {
        await pastikanUsaha(trx, pemanggil, usahaId);
        let row;
        try {
          row = rows(
            await trx.raw(
              `INSERT INTO talent_pengajuan
                 (usaha, diajukan_oleh, kapasitas_produksi, satuan, kesiapan_legalitas,
                  literasi_qris, literasi_pembukuan_digital, surat_komitmen, catatan)
               VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?)
               RETURNING id`,
              [
                usahaId,
                pemanggil.id,
                fields.kapasitas_produksi,
                fields.satuan,
                fields.kesiapan_legalitas,
                fields.literasi_qris,
                fields.literasi_pembukuan_digital,
                fields.surat_komitmen,
                fields.catatan,
              ],
            ),
          )[0];
        } catch (error) {
          if (error?.code === "23505") {
            throw new ProgramError(409, "PENGAJUAN_SUDAH_ADA", "This business already has an open submission.");
          }
          throw error;
        }
        await trx.raw(`UPDATE usaha SET talent_status = 'nominated' WHERE id = ? AND talent_status = 'none'`, [usahaId]);
        return findPengajuan(trx, row.id);
      });
      noStore(res);
      res.status(201).json({ data: toPengajuan(created) });
    });

/** PATCH /pengajuan/:id — edit an open submission; any edit discards the previous score. */
export const updatePengajuan =
  ({ database, logger }) =>
  (req, res, pemanggil) =>
    handle(logger, res, async () => {
      const id = uuidParam(req.params?.id);
      const fields = parseFields(objectBody(req));
      const updated = await database.transaction(async (trx) => {
        const existing = await findPengajuan(trx, id, { lock: true });
        requireStatus(existing, "draft", "PENGAJUAN_CLOSED");
        await pastikanUsaha(trx, pemanggil, existing.usaha);
        await trx.raw(
          `UPDATE talent_pengajuan
              SET kapasitas_produksi = ?, satuan = ?, kesiapan_legalitas = ?::jsonb, literasi_qris = ?,
                  literasi_pembukuan_digital = ?, surat_komitmen = ?, catatan = ?, status = 'draft',
                  skor_finansial = NULL, skor_pasar = NULL, skor_legalitas = NULL, skor_sdm = NULL,
                  skor_total = NULL, rubrik_versi = NULL, dinilai_at = NULL, date_updated = NOW()
            WHERE id = ?`,
          [
            fields.kapasitas_produksi,
            fields.satuan,
            fields.kesiapan_legalitas,
            fields.literasi_qris,
            fields.literasi_pembukuan_digital,
            fields.surat_komitmen,
            fields.catatan,
            id,
          ],
        );
        return findPengajuan(trx, id);
      });
      noStore(res);
      res.json({ data: toPengajuan(updated) });
    });

/** POST /pengajuan/:id/hitung-skor — score a draft on the server; the status stays draft. */
export const scorePengajuan =
  ({ database, logger }) =>
  (req, res, pemanggil) =>
    handle(logger, res, async () => {
      const id = uuidParam(req.params?.id);
      const scored = await database.transaction(async (trx) => {
        const row = await findPengajuan(trx, id, { lock: true });
        requireStatus(row, "draft", "PENGAJUAN_CLOSED");
        requireLengkap(row);
        await pastikanUsaha(trx, pemanggil, row.usaha);
        const usaha = await loadUsahaSummary(trx, row.usaha);
        const certificates = await loadLegalitas(trx, row.usaha);
        const skor = hitungSkor({
          omzetTahunan: usaha.omzetTahunan,
          kapasitasProduksi: num(row.kapasitas_produksi),
          literasiQris: Boolean(row.literasi_qris),
          literasiPembukuanDigital: Boolean(row.literasi_pembukuan_digital),
          suratKomitmen: Boolean(row.surat_komitmen),
          nib: Boolean(usaha.nib),
          legalitas: mergeLegalitas(certificates, row.kesiapan_legalitas),
          tenagaKerja: usaha.tenagaKerja,
        });
        await trx.raw(
          `UPDATE talent_pengajuan
              SET skor_finansial = ?, skor_pasar = ?, skor_legalitas = ?, skor_sdm = ?, skor_total = ?,
                  rubrik_versi = ?, dinilai_at = NOW(), date_updated = NOW()
            WHERE id = ?`,
          [skor.finansial, skor.pasar, skor.legalitas, skor.sdm, skor.total, skor.rubrikVersi, id],
        );
        return findPengajuan(trx, id);
      });
      noStore(res);
      res.json({ data: toPengajuan(scored) });
    });

/** POST /pengajuan/:id/ajukan — submit a complete, scored draft to curation (BUG-006). */
export const submitPengajuan =
  ({ database, logger }) =>
  (req, res, pemanggil) =>
    handle(logger, res, async () => {
      const id = uuidParam(req.params?.id);
      const submitted = await database.transaction(async (trx) => {
        const row = await findPengajuan(trx, id, { lock: true });
        requireStatus(row, "draft", "PENGAJUAN_CLOSED");
        await pastikanUsaha(trx, pemanggil, row.usaha);
        requireLengkap(row);
        if (row.skor_total === null || row.skor_total === undefined) {
          throw new ProgramError(409, "SKOR_BELUM_DIHITUNG", "Score the submission before submitting it.");
        }
        await trx.raw(`UPDATE talent_pengajuan SET status = 'dinilai', date_updated = NOW() WHERE id = ?`, [id]);
        await trx.raw(
          `UPDATE usaha SET talent_status = 'scouting' WHERE id = ? AND talent_status IN ('none', 'nominated')`,
          [row.usaha],
        );
        return findPengajuan(trx, id);
      });
      noStore(res);
      res.json({ data: toPengajuan(submitted) });
    });

/** POST /pengajuan/:id/tolak — reject a submitted application with a reason; the business returns to "none". */
export const rejectPengajuan =
  ({ database, logger }) =>
  (req, res, pemanggil) =>
    handle(logger, res, async () => {
      const id = uuidParam(req.params?.id);
      const alasan = optionalText(objectBody(req), "alasan", 2000);
      if (!alasan) throw new ProgramError(400, "ALASAN_WAJIB", "A rejection reason is required.");
      const rejected = await database.transaction(async (trx) => {
        const row = await findPengajuan(trx, id, { lock: true });
        requireStatus(row, "dinilai", "PENGAJUAN_TIDAK_SIAP_DIKURASI");
        await pastikanUsaha(trx, pemanggil, row.usaha);
        await trx.raw(
          `UPDATE talent_pengajuan
              SET status = 'ditolak', alasan_tolak = ?, ditolak_oleh = ?, ditolak_at = NOW(), date_updated = NOW()
            WHERE id = ?`,
          [alasan, pemanggil.id, id],
        );
        await trx.raw(
          `UPDATE usaha SET talent_status = 'none' WHERE id = ? AND talent_status IN ('nominated', 'scouting')`,
          [row.usaha],
        );
        return findPengajuan(trx, id);
      });
      noStore(res);
      res.json({ data: toPengajuan(rejected) });
    });

/** GET /berita-acara — issued Berita Acara, newest first. */
export const listBeritaAcara =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const result = await database.raw(
        `SELECT b.id, b.nomor, b.tanggal, b.catatan, b.berkas, b.date_created AS "dateCreated",
                COUNT(p.id)::integer AS "jumlahPengajuan"
           FROM talent_berita_acara b
           LEFT JOIN talent_pengajuan p ON p.berita_acara = b.id
          GROUP BY b.id
          ORDER BY b.date_created DESC
          LIMIT 200`,
      );
      noStore(res);
      res.json({ data: rows(result) });
    });

/**
 * POST /berita-acara — approve scored submissions in one transaction: issue the Berita Acara,
 * mark the submissions approved and move their businesses into the talent pool.
 */
export const createBeritaAcara =
  ({ database, logger }) =>
  (req, res, pemanggil) =>
    handle(logger, res, async () => {
      const body = objectBody(req);
      const ids = body.pengajuan;
      if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        ids.length > MAX_BERITA_ACARA_ITEMS ||
        !ids.every((id) => typeof id === "string" && UUID.test(id))
      ) {
        throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "pengajuan" must list 1–200 submission ids.');
      }
      const unique = [...new Set(ids)];
      const catatan = optionalText(body, "catatan", 2000);

      const beritaAcara = await database.transaction(async (trx) => {
        const locked = rows(
          await trx.raw(
            `SELECT id, usaha, status FROM talent_pengajuan WHERE id IN (${ID_LIST}) ORDER BY id FOR UPDATE`,
            [JSON.stringify(unique)],
          ),
        );
        if (locked.length !== unique.length) {
          throw new ProgramError(404, "PENGAJUAN_NOT_FOUND", "One or more submissions were not found.");
        }
        if (locked.some((row) => row.status !== "dinilai")) {
          throw new ProgramError(409, "PENGAJUAN_BELUM_DINILAI", "Only scored submissions can be approved.");
        }
        const created = rows(
          await trx.raw(
            // lpad truncates longer strings, so pad to at least 4 digits without cutting past 9999.
            `INSERT INTO talent_berita_acara (nomor, disetujui_oleh, catatan)
             SELECT 'BA-TS/' || to_char(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYY') || '/' ||
                    lpad(n::text, GREATEST(4, length(n::text)), '0'), ?, ?
               FROM (SELECT nextval('talent_berita_acara_nomor_seq') AS n) seq
             RETURNING id, nomor, tanggal, catatan, berkas, date_created AS "dateCreated"`,
            [pemanggil.id, catatan],
          ),
        )[0];
        await trx.raw(
          `UPDATE talent_pengajuan SET status = 'disetujui', berita_acara = ?, date_updated = NOW()
            WHERE id IN (${ID_LIST})`,
          [created.id, JSON.stringify(unique)],
        );
        await trx.raw(
          `UPDATE usaha SET talent_status = 'talent_pool'
            WHERE id IN (${ID_LIST}) AND talent_status IN ('none', 'nominated', 'scouting')`,
          [JSON.stringify(locked.map((row) => row.usaha))],
        );
        return { ...created, jumlahPengajuan: unique.length };
      });
      noStore(res);
      res.status(201).json({ data: beritaAcara });
    });

import { ProgramError, noStore, rows, sendError } from "../../lib/utils/http.js";
import { loadActor } from "../../lib/access.js";
import { requireCaptcha } from "../../lib/captcha.js";
import { flag, objectBody, oneOf, optionalNumber, optionalText, uuidParam, UUID } from "../../lib/validate.js";

/** Directus folder whose files the Public policy may read (migration 20260926G). */
export const KATALOG_FOLDER_ID = "6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10";
export const KATEGORI = ["makanan", "minuman", "fashion", "kerajinan", "kesehatan_kecantikan", "agribisnis", "lainnya"];
const KURASI_STATUS = ["menunggu", "tayang", "rekomendasi_marketplace", "ditolak"];
const MAX_FOTO = 5;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const handle = (logger, res, fn) => fn().catch((error) => sendError(res, logger, error));

const isCurator = (actor) => actor.admin || actor.appRole === "provinsi";
const canManage = (actor, usahaId) => isCurator(actor) || (actor.usaha !== null && actor.usaha === usahaId);

const PRODUK_SELECT = `
  SELECT p.*, COALESCE((SELECT json_agg(f.directus_files_id ORDER BY f.sort, f.id)
                          FROM produk_foto f WHERE f.produk_id = p.id), '[]'::json) AS foto_ids
    FROM produk p`;

const num = (value) => (value === null || value === undefined ? null : Number(value));

export function toProduk(row) {
  return {
    id: row.id,
    usaha: row.usaha,
    nama: row.nama,
    deskripsi: row.deskripsi,
    kategori: row.kategori,
    kbli: row.kbli,
    hargaRetail: num(row.harga_retail),
    hargaGrosir: num(row.harga_grosir),
    moq: num(row.moq),
    videoUrl: row.video_url,
    dimensi: row.dimensi,
    berat: row.berat,
    shelfLife: row.shelf_life,
    bahanBaku: row.bahan_baku,
    tkdnPersen: num(row.tkdn_persen),
    kapasitasBulanan: row.kapasitas_bulanan,
    leadTime: row.lead_time,
    persenBahanLokal: num(row.persen_bahan_lokal),
    pdnDeklarasi: Boolean(row.pdn_deklarasi),
    foto: row.foto_ids ?? [],
    statusKurasi: row.status_kurasi,
    catatanKurasi: row.catatan_kurasi,
    dikurasiAt: row.dikurasi_at,
    usahaNama: row.usaha_nama,
    usahaKota: row.usaha_kota_nama,
    dateCreated: row.date_created,
    dateUpdated: row.date_updated,
  };
}

function parseProduk(body) {
  const nama = optionalText(body, "nama", 160);
  if (!nama) throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "nama" is required.');
  const kategori = body.kategori === undefined || body.kategori === null ? null : oneOf(body, "kategori", KATEGORI);
  const videoUrl = optionalText(body, "videoUrl", 500);
  if (videoUrl && !/^https:\/\/\S+$/i.test(videoUrl)) {
    throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "videoUrl" must be an https URL.');
  }
  const kbli = optionalText(body, "kbli", 16);
  if (kbli && !/^\d{2,5}$/.test(kbli)) throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "kbli" is not valid.');
  const foto = body.foto ?? [];
  if (!Array.isArray(foto) || foto.length > MAX_FOTO || !foto.every((id) => typeof id === "string" && UUID.test(id))) {
    throw new ProgramError(400, "INVALID_PAYLOAD", `The field "foto" must list at most ${MAX_FOTO} file ids.`);
  }
  return {
    nama,
    deskripsi: optionalText(body, "deskripsi", 5000),
    kategori,
    kbli,
    harga_retail: optionalNumber(body, "hargaRetail", { min: 0, max: 1e13 }),
    harga_grosir: optionalNumber(body, "hargaGrosir", { min: 0, max: 1e13 }),
    moq: optionalNumber(body, "moq", { min: 1, max: 1e9 }),
    video_url: videoUrl,
    dimensi: optionalText(body, "dimensi", 100),
    berat: optionalText(body, "berat", 50),
    shelf_life: optionalText(body, "shelfLife", 50),
    bahan_baku: optionalText(body, "bahanBaku", 2000),
    tkdn_persen: optionalNumber(body, "tkdnPersen", { min: 0, max: 100 }),
    kapasitas_bulanan: optionalText(body, "kapasitasBulanan", 100),
    lead_time: optionalText(body, "leadTime", 100),
    persen_bahan_lokal: optionalNumber(body, "persenBahanLokal", { min: 0, max: 100 }),
    pdn_deklarasi: flag(body, "pdnDeklarasi"),
    foto: [...new Set(foto)],
  };
}

const COLUMNS = [
  "nama", "deskripsi", "kategori", "kbli", "harga_retail", "harga_grosir", "moq", "video_url", "dimensi", "berat",
  "shelf_life", "bahan_baku", "tkdn_persen", "kapasitas_bulanan", "lead_time", "persen_bahan_lokal", "pdn_deklarasi",
];

/** Photos must already sit in the public catalogue folder, otherwise visitors could not load them. */
async function assertPublicPhotos(trx, foto) {
  if (!foto.length) return;
  const found = rows(
    await trx.raw(
      `SELECT id FROM directus_files WHERE folder = ? AND id IN (SELECT jsonb_array_elements_text(?::jsonb)::uuid)`,
      [KATALOG_FOLDER_ID, JSON.stringify(foto)],
    ),
  );
  if (found.length !== foto.length) {
    throw new ProgramError(400, "FOTO_TIDAK_VALID", "Product photos must be uploaded to the public catalogue folder.");
  }
}

async function replaceFoto(trx, produkId, foto) {
  await trx.raw(`DELETE FROM produk_foto WHERE produk_id = ?`, [produkId]);
  for (const [index, fileId] of foto.entries()) {
    await trx.raw(`INSERT INTO produk_foto (produk_id, directus_files_id, sort) VALUES (?, ?, ?)`, [produkId, fileId, index + 1]);
  }
}

async function findProduk(database, id, { lock = false } = {}) {
  const row = rows(await database.raw(`${PRODUK_SELECT} WHERE p.id = ?${lock ? " FOR UPDATE OF p" : ""}`, [id]))[0];
  if (!row) throw new ProgramError(404, "PRODUK_NOT_FOUND", "The product was not found.");
  return row;
}

/** GET /usaha?q= — businesses the actor may manage products for (curators search all). */
export const searchUsaha =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const actor = await loadActor(database, req.accountability);
      let result;
      if (isCurator(actor)) {
        const q = typeof req.query?.q === "string" ? req.query.q.trim().slice(0, 80) : "";
        if (q.length < 3) {
          noStore(res);
          res.json({ data: [] });
          return;
        }
        result = await database.raw(
          `SELECT u.id, u.nama, u.nib, t.kota_nama AS kota
             FROM usaha u LEFT JOIN usaha_tabular t ON t.id = u.id
            WHERE u.nib = ? OR u.nama ILIKE ?
            ORDER BY u.nama LIMIT 20`,
          [q, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`],
        );
      } else {
        result = await database.raw(
          `SELECT u.id, u.nama, u.nib, t.kota_nama AS kota FROM usaha u LEFT JOIN usaha_tabular t ON t.id = u.id WHERE u.id = ?`,
          [actor.usaha],
        );
      }
      noStore(res);
      res.json({ data: rows(result) });
    });

/** GET /produk?usaha= — all products of one business, any curation status. */
export const listProdukUsaha =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const usahaId = uuidParam(req.query?.usaha, "INVALID_USAHA_ID");
      const actor = await loadActor(database, req.accountability);
      if (!canManage(actor, usahaId)) throw new ProgramError(403, "FORBIDDEN", "You cannot manage this business.");
      const result = await database.raw(`${PRODUK_SELECT} WHERE p.usaha = ? ORDER BY p.date_created DESC`, [usahaId]);
      noStore(res);
      res.json({ data: rows(result).map(toProduk) });
    });

/** POST /produk — a new product waits for curation. */
export const createProduk =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const body = objectBody(req);
      const usahaId = uuidParam(body.usaha, "INVALID_USAHA_ID");
      const input = parseProduk(body);
      const actor = await loadActor(database, req.accountability);
      if (!canManage(actor, usahaId)) throw new ProgramError(403, "FORBIDDEN", "You cannot manage this business.");
      const created = await database.transaction(async (trx) => {
        await assertPublicPhotos(trx, input.foto);
        const id = rows(
          await trx.raw(
            `INSERT INTO produk (usaha, ${COLUMNS.join(", ")}) VALUES (?, ${COLUMNS.map(() => "?").join(", ")}) RETURNING id`,
            [usahaId, ...COLUMNS.map((column) => input[column])],
          ),
        )[0].id;
        await replaceFoto(trx, id, input.foto);
        return findProduk(trx, id);
      });
      noStore(res);
      res.status(201).json({ data: toProduk(created) });
    });

/** PATCH /produk/:id — any edit sends the product back to curation. */
export const updateProduk =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const id = uuidParam(req.params?.id);
      const input = parseProduk(objectBody(req));
      const actor = await loadActor(database, req.accountability);
      const updated = await database.transaction(async (trx) => {
        const current = await findProduk(trx, id, { lock: true });
        if (!canManage(actor, current.usaha)) throw new ProgramError(403, "FORBIDDEN", "You cannot manage this business.");
        await assertPublicPhotos(trx, input.foto);
        await trx.raw(
          `UPDATE produk SET ${COLUMNS.map((column) => `${column} = ?`).join(", ")},
                  status_kurasi = 'menunggu', catatan_kurasi = NULL, dikurasi_oleh = NULL, dikurasi_at = NULL,
                  date_updated = NOW()
            WHERE id = ?`,
          [...COLUMNS.map((column) => input[column]), id],
        );
        await replaceFoto(trx, id, input.foto);
        return findProduk(trx, id);
      });
      noStore(res);
      res.json({ data: toProduk(updated) });
    });

/** GET /kurasi?status=menunggu — curation queue (province and admin only). */
export const listKurasi =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const status = oneOf(req.query ?? {}, "status", KURASI_STATUS, "menunggu");
      const actor = await loadActor(database, req.accountability);
      if (!isCurator(actor)) throw new ProgramError(403, "FORBIDDEN", "Only curators can open the queue.");
      const result = await database.raw(
        `${PRODUK_SELECT} WHERE p.status_kurasi = ? ORDER BY p.date_updated ${status === "menunggu" ? "ASC" : "DESC"} LIMIT 500`,
        [status],
      );
      noStore(res);
      res.json({ data: rows(result).map(toProduk) });
    });

/** POST /produk/:id/kurasi — publish, recommend for marketplaces, or reject with a note. */
export const kurasiProduk =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const id = uuidParam(req.params?.id);
      const body = objectBody(req);
      const keputusan = oneOf(body, "keputusan", ["tayang", "rekomendasi_marketplace", "ditolak"]);
      const catatan = optionalText(body, "catatan", 2000);
      if (keputusan === "ditolak" && !catatan) {
        throw new ProgramError(400, "CATATAN_WAJIB", "A note is required when rejecting a product.");
      }
      const actor = await loadActor(database, req.accountability);
      if (!isCurator(actor)) throw new ProgramError(403, "FORBIDDEN", "Only curators can decide.");
      const decided = await database.transaction(async (trx) => {
        await findProduk(trx, id, { lock: true });
        await trx.raw(
          `UPDATE produk SET status_kurasi = ?, catatan_kurasi = ?, dikurasi_oleh = ?, dikurasi_at = NOW(), date_updated = NOW()
            WHERE id = ?`,
          [keputusan, catatan, actor.id, id],
        );
        return findProduk(trx, id);
      });
      noStore(res);
      res.json({ data: toProduk(decided) });
    });

/** GET /loi — letters of intent from the public catalogue (curators only). */
export const listLoi =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const actor = await loadActor(database, req.accountability);
      if (!isCurator(actor)) throw new ProgramError(403, "FORBIDDEN", "Only curators can read letters of intent.");
      const result = await database.raw(
        `SELECT l.id, l.produk, p.nama AS "produkNama", p.usaha_nama AS "usahaNama", l.nama, l.instansi, l.email,
                l.telepon, l.jumlah, l.pesan, l.status, l.date_created AS "dateCreated"
           FROM produk_loi l JOIN produk p ON p.id = l.produk
          ORDER BY l.date_created DESC LIMIT 500`,
      );
      noStore(res);
      res.json({ data: rows(result) });
    });

/** POST /loi — PUBLIC: a buyer's letter of intent for a published product, behind a captcha. */
export const submitLoi =
  ({ database, logger, env }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const body = objectBody(req);
      const produkId = uuidParam(body.produk, "INVALID_PRODUK_ID");
      const nama = optionalText(body, "nama", 120);
      const email = optionalText(body, "email", 160);
      const pesan = optionalText(body, "pesan", 2000);
      if (!nama || !pesan || !email || !EMAIL.test(email)) {
        throw new ProgramError(400, "INVALID_PAYLOAD", "Name, a valid email and a message are required.");
      }
      const telepon = optionalText(body, "telepon", 32);
      if (telepon && !/^[+\d][\d\s-]{6,}$/.test(telepon)) {
        throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "telepon" is not valid.');
      }
      const instansi = optionalText(body, "instansi", 160);
      const jumlah = optionalText(body, "jumlah", 100);
      await requireCaptcha(database, env, body.captcha);
      const published = rows(
        await database.raw(`SELECT id FROM produk WHERE id = ? AND status_kurasi IN ('tayang', 'rekomendasi_marketplace')`, [produkId]),
      )[0];
      if (!published) throw new ProgramError(404, "PRODUK_NOT_FOUND", "The product was not found.");
      await database.raw(
        `INSERT INTO produk_loi (produk, nama, instansi, email, telepon, jumlah, pesan) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [produkId, nama, instansi, email, telepon, jumlah, pesan],
      );
      noStore(res);
      res.status(201).json({ data: { diterima: true } });
    });



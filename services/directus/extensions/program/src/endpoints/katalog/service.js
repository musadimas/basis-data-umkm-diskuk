import crypto from "node:crypto";
import { ProgramError, rows } from "../../lib/utils/http.js";
import { requireCaptcha } from "../../lib/captcha.js";
import { flag, normalisasiTeleponSeluler, objectBody, oneOf, optionalNumber, optionalText, optionalUuid, uuidParam, UUID } from "../../lib/validate.js";
import dokumen from "../../../../../analytics-shared/dokumen.cjs";
import { qrModul } from "../../lib/qr.js";
import { KURASI_ASAL, KURASI_STATUS, LOI_ASAL, LOI_DUPLIKAT_JAM, LOI_MAX_PER_WINDOW, LOI_WINDOW_MINUTES, STATUS_TAYANG, hargaRange, validasiKurasi } from "./rules.js";

export { LOI_MAX_PER_WINDOW, LOI_WINDOW_MINUTES, STATUS_TAYANG };

/** Directus folder whose files the Public policy may read (migration 20260926G). */
export const KATALOG_FOLDER_ID = "6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10";
/** Photos wait for curation here; nothing in this folder has a public read grant (20260926P). */
export const KURASI_FOLDER_ID = "6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f11";
export const KATEGORI = ["makanan", "minuman", "fashion", "kerajinan", "kesehatan_kecantikan", "agribisnis", "lainnya"];
const MAX_FOTO = 5;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `pemanggil` = `{ id, admin, peran, kotaId, usahaId }`, sudah di-resolve oleh adapter. */
const isCurator = (pemanggil) => pemanggil.admin || pemanggil.peran === "provinsi";
const canManage = (pemanggil, usahaId) => isCurator(pemanggil) || (pemanggil.usahaId !== null && pemanggil.usahaId === usahaId);

const PRODUK_SELECT = `
  SELECT p.*, COALESCE((SELECT json_agg(f.directus_files_id ORDER BY f.sort, f.id)
                          FROM produk_foto f WHERE f.produk_id = p.id), '[]'::json) AS foto_ids
    FROM produk p`;

const num = (value) => (value === null || value === undefined ? null : Number(value));

/** Fields a record does not carry are printed as "Belum tersedia", never faked (Y06). */
export const BELUM_TERSEDIA = "Belum tersedia";
const worth = (value) => (value === null || value === undefined || value === "" ? BELUM_TERSEDIA : String(value));
const persen = (value) => (value === null || value === undefined ? BELUM_TERSEDIA : `${Number(value).toLocaleString("id-ID")}%`);
const SKALA_LABEL = { micro: "Mikro", small: "Kecil", medium: "Menengah" };

/** Valid certificates as the snapshot trigger stored them: [{jenis, nomor, berlakuHingga}]. */
export function legalitasPublik(value) {
  if (!value) return [];
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed : [];
}

/** Raw client IPs are never stored: a keyed hash is enough for the rate limit. */
export function ipHashOf(req, env) {
  const ip = req?.ip ?? req?.socket?.remoteAddress ?? req?.connection?.remoteAddress;
  const secret = env?.SECRET ?? env?.KEY;
  if (!ip || !secret) return null;
  return crypto.createHmac("sha256", String(secret)).update(String(ip)).digest("hex");
}

const berkasNama = (nama) =>
  `spesifikasi-${String(nama ?? "produk")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "produk"}.pdf`;

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
    hargaLabel: hargaRange(row.harga_retail, row.harga_grosir),
    moq: num(row.moq),
    videoUrl: row.video_url,
    dimensi: row.dimensi,
    berat: row.berat,
    shelfLife: row.shelf_life,
    bahanBaku: row.bahan_baku,
    tkdnPersen: num(row.tkdn_persen),
    kapasitasBulanan: row.kapasitas_bulanan,
    leadTime: row.lead_time,
    ujiLab: row.uji_lab,
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
    uji_lab: optionalText(body, "ujiLab", 200),
    persen_bahan_lokal: optionalNumber(body, "persenBahanLokal", { min: 0, max: 100 }),
    pdn_deklarasi: flag(body, "pdnDeklarasi"),
    foto: [...new Set(foto)],
  };
}

const COLUMNS = [
  "nama", "deskripsi", "kategori", "kbli", "harga_retail", "harga_grosir", "moq", "video_url", "dimensi", "berat",
  "shelf_life", "bahan_baku", "tkdn_persen", "kapasitas_bulanan", "lead_time", "uji_lab", "persen_bahan_lokal", "pdn_deklarasi",
];

/** The photo proxy serves these inline on the Directus origin, so only raster types are accepted. */
const FOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FOTO_BYTES = 5 * 1024 * 1024;

/** Photos must sit in the curation folder, be real raster images, and — for non-curators — be
 * files the actor uploaded or files already attached to this product (a curator may have uploaded
 * them on the owner's behalf). Nothing here is publicly readable before a curation decision moves
 * it out, so cross-owner access fails on both the folder and the ownership check. */
async function assertKurasiPhotos(trx, foto, actor, produkId = null) {
  if (!foto.length) return;
  const found = rows(
    await trx.raw(
      `SELECT id, uploaded_by, type, filesize,
              (?::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM produk_foto f
                 WHERE f.directus_files_id = directus_files.id AND f.produk_id = ?::uuid)) AS milik_produk
         FROM directus_files WHERE folder = ? AND id IN (SELECT jsonb_array_elements_text(?::jsonb)::uuid)`,
      [produkId, produkId, KURASI_FOLDER_ID, JSON.stringify(foto)],
    ),
  );
  if (found.length !== foto.length) {
    throw new ProgramError(400, "FOTO_TIDAK_VALID", "Product photos must be uploaded through the product form.");
  }
  if (!isCurator(actor) && found.some((row) => row.uploaded_by !== actor.id && row.milik_produk !== true)) {
    throw new ProgramError(403, "FORBIDDEN", "You cannot use another owner's photo.");
  }
  // The browser form is not a security boundary (B10): a declared SVG would be served inline by
  // the photo proxy on the Directus origin (stored XSS), and an unrecorded size is never trusted.
  if (
    found.some(
      (row) =>
        !FOTO_TYPES.includes(row.type) ||
        row.filesize === null ||
        !Number.isFinite(Number(row.filesize)) ||
        Number(row.filesize) > MAX_FOTO_BYTES,
    )
  ) {
    throw new ProgramError(400, "FOTO_TIDAK_VALID", "Product photos must be JPEG, PNG or WebP under 5 MB.");
  }
}

/** Published photos live in the public folder; everything else stays in the curation folder. */
async function pindahkanFoto(trx, produkId, tayang) {
  await trx.raw(
    `UPDATE directus_files SET folder = ? WHERE id IN (SELECT directus_files_id FROM produk_foto WHERE produk_id = ?)`,
    [tayang ? KATALOG_FOLDER_ID : KURASI_FOLDER_ID, produkId],
  );
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

export function createKatalog({ db, assets, env, clock = () => new Date() }) {
  return {
    /** Byte foto produk. Kurator dan pemilik saja; folder kurasi tidak punya grant publik. */
    async fotoProduk(pemanggil, fileIdRaw) {
      const fileId = uuidParam(fileIdRaw, "INVALID_FILE_ID");
      const row = rows(await db.raw(`SELECT folder, uploaded_by FROM directus_files WHERE id = ?`, [fileId]))[0];
      if (!row) throw new ProgramError(404, "FOTO_TIDAK_DITEMUKAN", "The photo was not found.");
      if (row.folder !== KURASI_FOLDER_ID && row.folder !== KATALOG_FOLDER_ID) {
        throw new ProgramError(403, "FORBIDDEN", "This file is not product media.");
      }
      if (!isCurator(pemanggil) && row.uploaded_by !== pemanggil.id) {
        throw new ProgramError(403, "FORBIDDEN", "You cannot access another owner's photo.");
      }
      const asset = await assets.getAsset(fileId);
      // Directus stores the declared type in `type` (there is no `mimetype`); the adapter sends
      // nosniff so an unexpected upload type cannot render as a document on the Directus origin.
      return { contentType: asset.file.type || "application/octet-stream", stream: asset.stream };
    },

    /** Usaha yang boleh dikelola pemanggil (kurator mencari semuanya). */
    async cariUsaha(pemanggil, q) {
      let result;
      if (isCurator(pemanggil)) {
        const kata = typeof q === "string" ? q.trim().slice(0, 80) : "";
        if (kata.length < 3) return [];
        result = await db.raw(
          `SELECT u.id, u.nama, u.nib, t.kota_nama AS kota
             FROM usaha u LEFT JOIN usaha_tabular t ON t.id = u.id
            WHERE u.nib = ? OR u.nama ILIKE ?
            ORDER BY u.nama LIMIT 20`,
          [kata, `%${kata.replace(/[\\%_]/g, (c) => `\\${c}`)}%`],
        );
      } else {
        result = await db.raw(
          `SELECT u.id, u.nama, u.nib, t.kota_nama AS kota FROM usaha u LEFT JOIN usaha_tabular t ON t.id = u.id WHERE u.id = ?`,
          [pemanggil.usahaId],
        );
      }
      return rows(result);
    },

    /** Semua produk satu usaha, status kurasi apa pun. */
    async daftarProduk(pemanggil, usahaIdRaw) {
      const usahaId = uuidParam(usahaIdRaw, "INVALID_USAHA_ID");
      if (!canManage(pemanggil, usahaId)) throw new ProgramError(403, "FORBIDDEN", "You cannot manage this business.");
      const result = await db.raw(`${PRODUK_SELECT} WHERE p.usaha = ? ORDER BY p.date_created DESC`, [usahaId]);
      return rows(result).map(toProduk);
    },

    /** Produk baru menunggu kurasi. */
    async buatProduk(pemanggil, body) {
      const payload = objectBody({ body });
      const usahaId = uuidParam(payload.usaha, "INVALID_USAHA_ID");
      const input = parseProduk(payload);
      if (!canManage(pemanggil, usahaId)) throw new ProgramError(403, "FORBIDDEN", "You cannot manage this business.");
      const created = await db.transaction(async (trx) => {
        await assertKurasiPhotos(trx, input.foto, pemanggil);
        const id = rows(
          await trx.raw(
            `INSERT INTO produk (usaha, ${COLUMNS.join(", ")}) VALUES (?, ${COLUMNS.map(() => "?").join(", ")}) RETURNING id`,
            [usahaId, ...COLUMNS.map((column) => input[column])],
          ),
        )[0].id;
        await replaceFoto(trx, id, input.foto);
        return findProduk(trx, id);
      });
      return toProduk(created);
    },

    /** Edit apa pun mengembalikan produk ke kurasi. Kunci produk -> canManage -> foto pindah ke
     * kurasi -> validasi foto -> UPDATE + reset status -> ganti foto. Gagal berarti rollback. */
    async editProduk(pemanggil, produkIdRaw, body) {
      const id = uuidParam(produkIdRaw);
      const input = parseProduk(objectBody({ body }));
      const updated = await db.transaction(async (trx) => {
        const current = await findProduk(trx, id, { lock: true });
        if (!canManage(pemanggil, current.usaha)) throw new ProgramError(403, "FORBIDDEN", "You cannot manage this business.");
        // Foto yang tayang kembali privat; dipindah dulu supaya sudah di folder kurasi saat
        // divalidasi (B11). Edit yang gagal membatalkan pemindahan bersama transaksi.
        await pindahkanFoto(trx, id, false);
        await assertKurasiPhotos(trx, input.foto, pemanggil, id);
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
      return toProduk(updated);
    },

    /** Antrean kurasi (provinsi dan admin saja). */
    async daftarKurasi(pemanggil, statusRaw) {
      const status = oneOf({ status: statusRaw }, "status", KURASI_STATUS, "menunggu");
      if (!isCurator(pemanggil)) throw new ProgramError(403, "FORBIDDEN", "Only curators can open the queue.");
      const result = await db.raw(
        `${PRODUK_SELECT} WHERE p.status_kurasi = ? ORDER BY p.date_updated ${status === "menunggu" ? "ASC" : "DESC"} LIMIT 500`,
        [status],
      );
      return rows(result).map(toProduk);
    },

    /** Tayang, rekomendasi marketplace, atau tolak dengan catatan. Transisi dijaga UPDATE
     * bersyarat (`KURASI_ASAL`): keputusan yang tidak lagi sah dibalas 409 dan foto tidak dipindah. */
    async kurasiProduk(pemanggil, produkIdRaw, body) {
      const id = uuidParam(produkIdRaw);
      const payload = objectBody({ body });
      const { keputusan, catatan } = validasiKurasi(payload);
      if (!isCurator(pemanggil)) throw new ProgramError(403, "FORBIDDEN", "Only curators can decide.");
      const decided = await db.transaction(async (trx) => {
        // Lock baris keputusan: dua kurator tidak boleh memutuskan produk yang sama bersamaan.
        await findProduk(trx, id, { lock: true });
        // Asal yang sah dikirim sebagai satu teks JSON: Knex mengembangkan binding larik (lihat ID_LIST).
        const diubah = rows(
          await trx.raw(
            `UPDATE produk SET status_kurasi = ?, catatan_kurasi = ?, dikurasi_oleh = ?, dikurasi_at = NOW(), date_updated = NOW()
              WHERE id = ? AND status_kurasi IN (SELECT jsonb_array_elements_text(?::jsonb)) RETURNING id`,
            [keputusan, catatan, pemanggil.id, id, JSON.stringify(KURASI_ASAL[keputusan])],
          ),
        );
        if (!diubah.length) {
          throw new ProgramError(409, "TRANSISI_KURASI_TIDAK_VALID", "The product's curation status no longer allows this decision.");
        }
        // Keputusan menentukan lokasi foto: tayang -> folder publik, selain itu folder kurasi (M6-04).
        await pindahkanFoto(trx, id, STATUS_TAYANG.includes(keputusan));
        return findProduk(trx, id);
      });
      return toProduk(decided);
    },

    /** LOI: kurator membaca semuanya; pemilik hanya yang untuk produknya (M7-05). */
    async daftarLoi(pemanggil) {
      const curator = isCurator(pemanggil);
      const owner = pemanggil.usahaId !== null && pemanggil.usahaId !== undefined;
      if (!curator && !owner) throw new ProgramError(403, "FORBIDDEN", "Only authorised officers and owners can read letters of intent.");
      // Kontak hanya keluar bila pengirim setuju dihubungi; LOI lama (pra-20260926R) bernilai false.
      const result = await db.raw(
        `SELECT l.id, l.produk, p.nama AS "produkNama", p.usaha_nama AS "usahaNama", l.nama, l.instansi,
                CASE WHEN l.persetujuan_kontak THEN l.email END AS email,
                CASE WHEN l.persetujuan_kontak THEN l.telepon END AS telepon,
                l.jumlah, l.pesan, l.persetujuan_kontak AS "persetujuanKontak", l.status,
                l.date_created AS "dateCreated"
           FROM produk_loi l JOIN produk p ON p.id = l.produk
          WHERE ?::boolean OR p.usaha = ?::uuid
          ORDER BY l.date_created DESC LIMIT 500`,
        [curator, pemanggil.usahaId],
      );
      return rows(result);
    },

    /** Kurator menandai tindak lanjut LOI (BUG-020); transisi dijaga UPDATE bersyarat. */
    async ubahStatusLoi(pemanggil, loiIdRaw, body) {
      const id = uuidParam(loiIdRaw);
      const status = oneOf(objectBody({ body }), "status", Object.keys(LOI_ASAL));
      if (!isCurator(pemanggil)) throw new ProgramError(403, "FORBIDDEN", "Only curators can update letters of intent.");
      const diubah = rows(
        await db.raw(
          `UPDATE produk_loi SET status = ? WHERE id = ? AND status IN (SELECT jsonb_array_elements_text(?::jsonb))
           RETURNING id, status`,
          [status, id, JSON.stringify(LOI_ASAL[status])],
        ),
      )[0];
      if (diubah) return diubah;
      const ada = rows(await db.raw(`SELECT 1 FROM produk_loi WHERE id = ?`, [id]))[0];
      if (!ada) throw new ProgramError(404, "LOI_NOT_FOUND", "The letter of intent was not found.");
      throw new ProgramError(409, "TRANSISI_LOI_TIDAK_VALID", "The letter of intent can no longer move to this status.");
    },

    /** LOI PUBLIK. Urutan: validasi -> idempotensi -> captcha (sekali pakai) -> produk tayang ->
     * rate limit -> insert. Balasan `{ diterima, duplikat }`; adapter memetakan duplikat ke 200. */
    async kirimLoi(body, { ip } = {}) {
      const payload = objectBody({ body });
      const produkId = uuidParam(payload.produk, "INVALID_PRODUK_ID");
      const nama = optionalText(payload, "nama", 120);
      const email = optionalText(payload, "email", 160);
      const pesan = optionalText(payload, "pesan", 2000);
      if (!nama || !pesan || !email || !EMAIL.test(email)) {
        throw new ProgramError(400, "INVALID_PAYLOAD", "Name, a valid email and a message are required.");
      }
      const telepon = optionalText(payload, "telepon", 32);
      if (telepon && !normalisasiTeleponSeluler(telepon)) {
        throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "telepon" is not valid.');
      }
      const instansi = optionalText(payload, "instansi", 160);
      const jumlah = optionalText(payload, "jumlah", 100);
      const clientUuid = optionalUuid(payload, "clientUuid");
      if (!clientUuid) throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "clientUuid" is required.');
      if (!flag(payload, "persetujuanKontak")) {
        throw new ProgramError(400, "PERSETUJUAN_WAJIB", "Contact consent is required before sending a letter of intent.");
      }
      // Idempotency comes first: a captcha is single use, so a retry of an accepted submission can
      // never pass the captcha again and must still be answered "already received".
      const duplikat = rows(
        await db.raw(
          `SELECT id FROM produk_loi
            WHERE produk = ? AND (idempotency_key = ?::uuid
               OR (email = ? AND pesan = ? AND date_created > NOW() - make_interval(hours => ?)))
            LIMIT 1`,
          [produkId, clientUuid, email, pesan, LOI_DUPLIKAT_JAM],
        ),
      )[0];
      if (duplikat) return { diterima: true, duplikat: true };
      await requireCaptcha(db, env, payload.captcha);
      const published = rows(
        await db.raw(`SELECT id FROM produk WHERE id = ? AND status_kurasi IN (?, ?)`, [produkId, ...STATUS_TAYANG]),
      )[0];
      if (!published) throw new ProgramError(404, "PRODUK_NOT_FOUND", "The product was not found.");
      const ipHash = ipHashOf({ ip }, env);
      if (ipHash) {
        const used = Number(
          rows(
            await db.raw(
              `SELECT count(*) AS jumlah FROM produk_loi WHERE ip_hash = ? AND date_created > NOW() - make_interval(mins => ?)`,
              [ipHash, LOI_WINDOW_MINUTES],
            ),
          )[0]?.jumlah ?? 0,
        );
        if (used >= LOI_MAX_PER_WINDOW) {
          throw new ProgramError(429, "TERLALU_BANYAK_PERMINTAAN", "Too many letters of intent from this address. Try again later.");
        }
      }
      try {
        await db.raw(
          `INSERT INTO produk_loi (produk, nama, instansi, email, telepon, jumlah, pesan, persetujuan_kontak, idempotency_key, ip_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?::uuid, ?)`,
          [produkId, nama, instansi, email, telepon, jumlah, pesan, clientUuid, ipHash],
        );
      } catch (error) {
        // A concurrent submission with the same key won the insert: exactly one letter is stored.
        if (error?.code !== "23505") throw error;
        return { diterima: true, duplikat: true };
      }
      return { diterima: true, duplikat: false };
    },

    /** Lembar spesifikasi PUBLIK satu produk tayang. Kontak pemilik tidak pernah dicetak; field
     * kosong ditulis "Belum tersedia" (M7-04). */
    async lembarSpesifikasi(produkIdRaw) {
      const id = uuidParam(produkIdRaw, "INVALID_PRODUK_ID");
      const row = rows(
        await db.raw(`${PRODUK_SELECT} WHERE p.id = ? AND p.status_kurasi IN (?, ?)`, [id, ...STATUS_TAYANG]),
      )[0];
      if (!row) throw new ProgramError(404, "PRODUK_NOT_FOUND", "The product was not found.");
      const legalitas = legalitasPublik(row.usaha_legalitas);
      const baseUrl = dokumen.publicUrl(env);
      const bagian = [
        {
          judul: "Produsen",
          baris: [
            `Nama usaha: ${worth(row.usaha_nama)}`,
            `Wilayah: ${worth(row.usaha_kota_nama)}`,
            `Skala usaha: ${SKALA_LABEL[row.usaha_skala] ?? worth(row.usaha_skala)}`,
            `NIB: ${worth(row.usaha_nib)}`,
          ],
        },
        {
          judul: "Produk",
          baris: [
            `Nama produk: ${worth(row.nama)}`,
            `Kategori: ${worth(row.kategori)}`,
            `KBLI: ${worth(row.kbli)}`,
            `Rentang harga: ${hargaRange(row.harga_retail, row.harga_grosir) ?? BELUM_TERSEDIA}`,
            `Minimum order (MOQ): ${row.moq ? Number(row.moq).toLocaleString("id-ID") : BELUM_TERSEDIA}`,
            `Deskripsi: ${worth(row.deskripsi)}`,
          ],
        },
        {
          judul: "Spesifikasi",
          baris: [
            `Dimensi: ${worth(row.dimensi)}`,
            `Berat bersih: ${worth(row.berat)}`,
            `Masa kedaluwarsa: ${worth(row.shelf_life)}`,
            `Bahan baku: ${worth(row.bahan_baku)}`,
            `TKDN: ${persen(row.tkdn_persen)}`,
            `Bahan baku lokal: ${persen(row.persen_bahan_lokal)}`,
            `Uji laboratorium: ${worth(row.uji_lab)}`,
          ],
        },
        {
          judul: "Kapasitas dan Pesanan",
          baris: [
            `Kapasitas produksi bulanan: ${worth(row.kapasitas_bulanan)}`,
            `Kapasitas pesanan besar: ${BELUM_TERSEDIA}`,
            `Stok: ${BELUM_TERSEDIA}`,
            `Lead time: ${worth(row.lead_time)}`,
          ],
        },
        {
          judul: "Legalitas dan Verifikasi",
          baris: [
            `Sertifikat terbit: ${
              legalitas.length
                ? legalitas
                    .map((item) => `${String(item.jenis).toUpperCase()}${item.nomor ? ` nomor ${item.nomor}` : ""}`)
                    .join(", ")
                : BELUM_TERSEDIA
            }`,
            `PDN: ${row.usaha_pdn ? "Terverifikasi" : row.pdn_deklarasi ? "Deklarasi mandiri pelaku usaha" : BELUM_TERSEDIA}`,
            `Talent: ${row.usaha_talent_status ? String(row.usaha_talent_status).replace(/_/g, " ") : BELUM_TERSEDIA}`,
            `Ramah disabilitas: ${row.usaha_ramah_disabilitas ? "Ya" : "Tidak"}`, 
          ],
        },
        {
          judul: "Verifikasi Dokumen",
          baris: [
            "Lembar spesifikasi ini dihasilkan dari katalog resmi DISKUK Provinsi Jawa Barat.",
            `Halaman produk: ${baseUrl}/katalog/${row.id}`,
          ],
        },
      ];
      const pdf = dokumen.renderDokumen({
        judul: "Lembar Spesifikasi Produk",
        subjudul: `${row.nama} - ${worth(row.usaha_nama)}`,
        bagian,
        qr: { modul: qrModul(`${baseUrl}/katalog/${row.id}`), ukuran: 100 },
        meta: { generatedAt: clock().toISOString().slice(0, 10) },
      });
      return { pdf, berkas: berkasNama(row.nama) };
    },
  };
}

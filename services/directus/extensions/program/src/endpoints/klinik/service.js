import crypto from "node:crypto";
import { Readable } from "node:stream";
import busboy from "busboy";
import { ProgramError, noStore, rows, sendError } from "../../lib/utils/http.js";
import { loadActor } from "../../lib/access.js";
import { requireCaptcha } from "../../lib/captcha.js";
import { objectBody, oneOf, optionalText, uuidParam } from "../../lib/validate.js";
import { notify } from "../../lib/notify.js";
import { ASPEK_DIAGNOSIS, PRIORITAS, RUJUKAN, SLOTS, STATUS, nomorTiket, sniffType, tanggalTidakValid } from "./rules.js";

/** Private Directus folder for ticket attachments (migration 20260926J). */
export const LAMPIRAN_FOLDER_ID = "0b8f2d4c-7a13-4c55-9e6d-3f1a2b9c8d70";
const MAX_LAMPIRAN = 3;
const MAX_LAMPIRAN_BYTES = 5 * 1024 * 1024;
const REF_TTL_MS = 30 * 60 * 1000;
const REF_LABEL = "diskuk-klinik-ref-v1";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^(\+?62|0)8\d{7,12}$/;

const handle = (logger, res, fn) => fn().catch((error) => sendError(res, logger, error));
const isStaff = (actor) => actor.admin || actor.appRole === "provinsi" || actor.appRole === "pendamping";

// ── Business reference tokens ──────────────────────────────────────────────
// The lookup hands the browser a short-lived signed reference instead of the business UUID, so
// the public form can link a ticket to a SIDT business without exposing its identifier.
function refKey(env) {
  if (!env?.SECRET) throw new ProgramError(503, "KLINIK_NOT_CONFIGURED", "The clinic is not configured.");
  return crypto.createHmac("sha256", String(env.SECRET)).update(REF_LABEL).digest();
}

export function signRef(env, usahaId, now = Date.now()) {
  const body = `${usahaId}.${now + REF_TTL_MS}`;
  const mac = crypto.createHmac("sha256", refKey(env)).update(body).digest("base64url");
  return Buffer.from(`${body}.${mac}`).toString("base64url");
}

export function readRef(env, token, now = Date.now()) {
  if (typeof token !== "string" || token.length > 300) return null;
  const [usahaId, exp, mac] = Buffer.from(token, "base64url").toString("utf8").split(".");
  if (!usahaId || !exp || !mac || Number(exp) < now) return null;
  const expected = crypto.createHmac("sha256", refKey(env)).update(`${usahaId}.${exp}`).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? usahaId : null;
}

// ── Public: lookup, slots, ticket ──────────────────────────────────────────

/** POST /lookup — PUBLIC, captcha. NIB or NIK → business name, scale, kab/kota, KBLI only. */
export const lookup =
  ({ database, logger, env }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const body = objectBody(req);
      const jenis = oneOf(body, "jenis", ["nib", "nik"]);
      const nomor = String(body.nomor ?? "").replace(/\D/g, "");
      if ((jenis === "nib" && nomor.length !== 13) || (jenis === "nik" && nomor.length !== 16)) {
        throw new ProgramError(400, "NOMOR_TIDAK_VALID", jenis === "nib" ? "NIB has 13 digits." : "NIK has 16 digits.");
      }
      await requireCaptcha(database, env, body.captcha);
      const result = await database.raw(
        `SELECT u.id, u.nama, u.skala, t.kota_nama AS kota, kk.kode AS kbli
           FROM usaha u
           JOIN pelaku_usaha p ON p.id = u.pelaku_usaha
           LEFT JOIN usaha_tabular t ON t.id = u.id
           LEFT JOIN klasifikasi_usaha kk ON kk.id = u.klasifikasi
          WHERE ${jenis === "nib" ? "u.nib = ?" : "p.nik = ?"}
          ORDER BY u.nama LIMIT 10`,
        [nomor],
      );
      noStore(res);
      res.json({
        data: rows(result).map((row) => ({ ref: signRef(env, row.id), nama: row.nama, skala: row.skala, kota: row.kota, kbli: row.kbli })),
      });
    });

/** GET /slot?poli=&tanggal= — PUBLIC. Free slots for one poli on one day. */
export const slots =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const poli = Number(req.query?.poli);
      const tanggal = String(req.query?.tanggal ?? "");
      if (!Number.isInteger(poli) || poli < 1) throw new ProgramError(400, "POLI_TIDAK_VALID", "The poli is not valid.");
      const reason = tanggalTidakValid(tanggal);
      if (reason) throw new ProgramError(400, reason, "The date cannot be booked.");
      const taken = rows(
        await database.raw(
          `SELECT jadwal_slot FROM konsultasi_tiket WHERE poli = ? AND jadwal_tanggal = ? AND status <> 'batal'`,
          [poli, tanggal],
        ),
      ).map((row) => row.jadwal_slot);
      res.setHeader("Cache-Control", "no-store");
      res.json({ data: SLOTS.map((slot) => ({ slot, tersedia: !taken.includes(slot) })) });
    });

/** Reads the multipart form: a JSON `payload` field, the `captcha` field and up to 3 files. */
function readMultipart(req) {
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = busboy({
        headers: req.headers,
        limits: { files: MAX_LAMPIRAN, fileSize: MAX_LAMPIRAN_BYTES, fields: 4, fieldSize: 20_000, parts: 8 },
      });
    } catch {
      reject(new ProgramError(400, "INVALID_PAYLOAD", "Send the form as multipart/form-data."));
      return;
    }
    const fields = {};
    const files = [];
    let failure = null;
    parser.on("field", (name, value) => (fields[name] = value));
    parser.on("file", (name, stream, info) => {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("limit", () => (failure = new ProgramError(400, "LAMPIRAN_TERLALU_BESAR", "Each attachment may be at most 5 MB.")));
      stream.on("end", () => {
        if (name === "lampiran") files.push({ filename: String(info.filename ?? "lampiran").slice(0, 200), buffer: Buffer.concat(chunks) });
      });
    });
    parser.on("filesLimit", () => (failure = new ProgramError(400, "LAMPIRAN_TERLALU_BANYAK", "At most 3 attachments.")));
    parser.on("partsLimit", () => (failure = new ProgramError(400, "INVALID_PAYLOAD", "Too many form parts.")));
    parser.on("error", () => reject(new ProgramError(400, "INVALID_PAYLOAD", "The form could not be read.")));
    parser.on("close", () => (failure ? reject(failure) : resolve({ fields, files })));
    req.pipe(parser);
  });
}

function parseTiket(fields, env) {
  let body;
  try {
    body = JSON.parse(fields.payload ?? "");
  } catch {
    throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "payload" must be JSON.');
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ProgramError(400, "INVALID_PAYLOAD", "Invalid payload.");
  const usaha = body.usahaRef ? readRef(env, body.usahaRef) : null;
  if (body.usahaRef && !usaha) throw new ProgramError(400, "REF_KEDALUWARSA", "Look up the business again.");
  const namaUsaha = optionalText(body, "namaUsaha", 255);
  const namaKontak = optionalText(body, "namaKontak", 120);
  const whatsapp = String(body.whatsapp ?? "").replace(/[\s-]/g, "");
  const email = optionalText(body, "email", 160);
  const deskripsi = optionalText(body, "deskripsi", 3000);
  const poli = Number(body.poli);
  const invalid = (field) => new ProgramError(400, "INVALID_PAYLOAD", `The field "${field}" is not valid.`);
  if (!usaha && !namaUsaha) throw invalid("namaUsaha");
  if (!namaKontak) throw invalid("namaKontak");
  if (!PHONE.test(whatsapp)) throw invalid("whatsapp");
  if (email && !EMAIL.test(email)) throw invalid("email");
  if (!deskripsi || deskripsi.length < 20) throw invalid("deskripsi");
  if (!Number.isInteger(poli) || poli < 1) throw invalid("poli");
  const moda = oneOf(body, "moda", ["daring", "luring"]);
  const slot = oneOf(body, "slot", SLOTS);
  const tanggal = String(body.tanggal ?? "");
  const reason = tanggalTidakValid(tanggal);
  if (reason) throw new ProgramError(400, reason, "The date cannot be booked.");
  return { usaha, namaUsaha, namaKontak, whatsapp, email, deskripsi, poli, moda, slot, tanggal };
}

function storageLocation(env) {
  const locations = env?.STORAGE_LOCATIONS;
  const first = Array.isArray(locations) ? locations[0] : String(locations ?? "local").split(",")[0];
  return first.trim() || "local";
}

/**
 * POST /tiket — PUBLIC, captcha, multipart. Books a slot and returns the ticket number.
 * Attachments are sniffed (PDF, JPEG, PNG, WebP) and stored in the private "Lampiran Klinik" folder.
 */
export const createTiket =
  ({ database, logger, env, services, getSchema }) =>
  (req, res) =>
    handle(logger, res, async () => {
      if (!String(req.headers?.["content-type"] ?? "").startsWith("multipart/form-data")) {
        throw new ProgramError(400, "INVALID_PAYLOAD", "Send the form as multipart/form-data.");
      }
      const { fields, files } = await readMultipart(req);
      const input = parseTiket(fields, env);
      const lampiran = files.map((file) => ({ ...file, type: sniffType(file.buffer) }));
      if (lampiran.some((file) => !file.type)) {
        throw new ProgramError(400, "LAMPIRAN_TIDAK_DIDUKUNG", "Attachments must be PDF, JPG, PNG or WebP.");
      }
      await requireCaptcha(database, env, fields.captcha);

      const poli = rows(await database.raw(`SELECT id, nama FROM konsultasi_poli WHERE id = ? AND aktif`, [input.poli]))[0];
      if (!poli) throw new ProgramError(400, "POLI_TIDAK_VALID", "The poli is not valid.");
      let namaUsaha = input.namaUsaha;
      if (input.usaha) {
        namaUsaha = rows(await database.raw(`SELECT nama FROM usaha WHERE id = ?`, [input.usaha]))[0]?.nama ?? namaUsaha;
      }

      // Upload first (outside the transaction); remove the files again if the booking fails.
      const fileIds = [];
      const filesService = lampiran.length ? new services.FilesService({ schema: await getSchema(), accountability: null }) : null;
      try {
        for (const file of lampiran) {
          fileIds.push(
            await filesService.uploadOne(Readable.from(file.buffer), {
              storage: storageLocation(env),
              folder: LAMPIRAN_FOLDER_ID,
              filename_download: file.filename,
              title: `Lampiran klinik – ${file.filename}`,
              type: file.type,
            }),
          );
        }
        const tiket = await database.transaction(async (trx) => {
          const seq = rows(await trx.raw(`SELECT nextval('konsultasi_tiket_nomor_seq') AS n`))[0].n;
          let row;
          try {
            row = rows(
              await trx.raw(
                `INSERT INTO konsultasi_tiket
                   (nomor, usaha, nama_usaha, nama_kontak, whatsapp, email, poli, deskripsi, moda, jadwal_tanggal, jadwal_slot)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 RETURNING id, nomor, moda, jadwal_tanggal::text AS tanggal, jadwal_slot AS slot`,
                [nomorTiket(seq), input.usaha, namaUsaha, input.namaKontak, input.whatsapp, input.email, poli.id, input.deskripsi,
                  input.moda, input.tanggal, input.slot],
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
          return row;
        });
        await notify({ logger }, "klinik.tiket_dibuat", { nomor: tiket.nomor, whatsapp: input.whatsapp });
        noStore(res);
        res.status(201).json({
          data: { nomor: tiket.nomor, poli: poli.nama, moda: tiket.moda, tanggal: tiket.tanggal, slot: tiket.slot },
        });
      } catch (error) {
        if (fileIds.length) await filesService.deleteMany(fileIds).catch(() => {});
        throw error;
      }
    });

// ── Staff: kanban ───────────────────────────────────────────────────────────

const TIKET_SELECT = `
  SELECT t.id, t.nomor, t.usaha, t.nama_usaha AS "namaUsaha", t.nama_kontak AS "namaKontak", t.whatsapp, t.email,
         t.poli, po.nama AS "poliNama", t.deskripsi, t.moda, t.jadwal_tanggal::text AS "jadwalTanggal",
         t.jadwal_slot AS "jadwalSlot", t.prioritas, t.status, t.pendamping,
         NULLIF(TRIM(CONCAT_WS(' ', pd.first_name, pd.last_name)), '') AS "pendampingNama",
         t.link_meet AS "linkMeet", t.diagnosis, t.action_plan AS "actionPlan", t.rujukan, t.catatan,
         t.date_created AS "dateCreated", t.date_updated AS "dateUpdated",
         COALESCE((SELECT json_agg(l.directus_files_id ORDER BY l.sort) FROM konsultasi_tiket_lampiran l
                    WHERE l.konsultasi_tiket_id = t.id), '[]'::json) AS lampiran
    FROM konsultasi_tiket t
    JOIN konsultasi_poli po ON po.id = t.poli
    LEFT JOIN directus_users pd ON pd.id = t.pendamping`;

/** GET /tiket?status= — tickets for the kanban (staff only). */
export const listTiket =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const actor = await loadActor(database, req.accountability);
      if (!isStaff(actor)) throw new ProgramError(403, "FORBIDDEN", "Clinic staff only.");
      const status = req.query?.status ? oneOf(req.query, "status", STATUS) : null;
      const result = await database.raw(
        `${TIKET_SELECT}
          WHERE (?::text IS NULL AND t.status <> 'batal') OR t.status = ?
          ORDER BY CASE t.prioritas WHEN 'mendesak' THEN 0 WHEN 'tinggi' THEN 1 ELSE 2 END, t.jadwal_tanggal, t.jadwal_slot
          LIMIT 500`,
        [status, status],
      );
      noStore(res);
      res.json({ data: rows(result) });
    });

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

/** PATCH /tiket/:id — move on the kanban, assign, schedule a meeting, record the session. */
export const updateTiket =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const id = uuidParam(req.params?.id);
      const update = parseUpdate(objectBody(req));
      const actor = await loadActor(database, req.accountability);
      if (!isStaff(actor)) throw new ProgramError(403, "FORBIDDEN", "Clinic staff only.");
      const columns = Object.keys(update);
      const casts = { diagnosis: "::jsonb", rujukan: "::jsonb" };
      const updated = await database.transaction(async (trx) => {
        const current = rows(await trx.raw(`SELECT id, status FROM konsultasi_tiket WHERE id = ? FOR UPDATE`, [id]))[0];
        if (!current) throw new ProgramError(404, "TIKET_NOT_FOUND", "The ticket was not found.");
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
        return { before: current.status, row: rows(await trx.raw(`${TIKET_SELECT} WHERE t.id = ?`, [id]))[0] };
      });
      if (update.status && update.status !== updated.before) {
        await notify({ logger }, "klinik.status_berubah", { nomor: updated.row.nomor, status: update.status });
      }
      noStore(res);
      res.json({ data: updated.row });
    });

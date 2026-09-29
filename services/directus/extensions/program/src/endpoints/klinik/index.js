import { Readable } from "node:stream";
import { ProgramError, noStore, samaRahasia, sendError } from "../../lib/utils/http.js";
import { objectBody } from "../../lib/validate.js";
import { readMultipart } from "../../lib/http/multipart.js";
import { requireCaptcha } from "../../lib/captcha.js";
import { getOutbox } from "../../lib/outbox/runtime.js";
import { receiptSecret, whatsappConfigured } from "../../lib/whatsapp.js";
import { MAX_LAMPIRAN, MAX_LAMPIRAN_BYTES, createKlinik, galatLampiran } from "./service.js";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";

const { publik, terjaga } = cakupan;

// Petugas kanban: provinsi, kabkota, pendamping. Prefill dan lampiran butuh
// sesi apa pun (pelamar umkm membaca lampirannya sendiri); sisanya publik
// (captcha/rahasia tetap di handler).
const SEMUA = { peran: ["provinsi", "kabkota", "pendamping", "umkm"] };
const PETUGAS = { peran: ["provinsi", "kabkota", "pendamping"] };

// Klinik Konsultasi (Brief Fitur Modul 7.3 / M7-11…M7-14):
//   GET   /v1/program/klinik/poli                 PUBLIC: the six consultation desks
//   GET   /v1/program/klinik/prefill              session: own business + contact details
//   GET   /v1/program/klinik/slot                 PUBLIC: free slots for a poli and date
//   POST  /v1/program/klinik/tiket                PUBLIC, captcha, multipart: book a consultation
//   POST  /v1/program/klinik/tiket/lacak          PUBLIC, captcha: read back a ticket
//   GET   /v1/program/klinik/tiket                staff: kanban
//   PATCH /v1/program/klinik/tiket/:id            staff: status, assignment, session record, referrals
//   GET   /v1/program/klinik/lampiran/:fileId     applicant or staff: private attachment
//   POST  /v1/program/klinik/notifikasi/receipt   provider callback: WhatsApp delivery receipt
//
// There is deliberately no public NIB/NIK lookup: identity is prefilled from the signed-in
// account, and anonymous visitors type their business name (stored as "manual"/unverified).
export default (router, context) => {
  // Outbox bersama (lib/outbox/runtime.js): pengiriman dijalankan hook cron `notifikasi` dan
  // `kick` pasca-commit (use case), bukan timer di sini.
  const outbox = getOutbox(context);
  const konteks = { ...context, outbox };
  const klinik = createKlinik({
    db: context.database,
    files: berkasDirectus(context),
    outbox,
    captcha: (raw) => requireCaptcha(context.database, context.env, raw),
    kick: () => {
      if (!whatsappConfigured(context.env)) return;
      outbox.dispatch().catch((error) => context.logger.warn?.({ code: error?.code }, "Clinic outbox dispatch failed"));
    },
  });
  const jalan = (verb) => () => async (req, res, pemanggil) => {
    try {
      const { data, status = 200, header } = await verb(req, pemanggil);
      if (header) header(res);
      else noStore(res);
      res.status(status).json({ data });
    } catch (error) {
      sendError(res, context.logger, error);
    }
  };
  router.get("/poli", publik(jalan(async () => ({ data: await klinik.poli() })))(konteks));
  router.get("/prefill", terjaga(SEMUA, jalan(async (_req, p) => ({ data: await klinik.prefill(p) })))(konteks));
  router.get(
    "/slot",
    publik(jalan(async (req) => ({ data: await klinik.slots(req.query), header: (res) => res.setHeader("Cache-Control", "no-store") })))(konteks),
  );
  router.post(
    "/tiket",
    publik(
      jalan(async (req) => {
        if (!String(req.headers?.["content-type"] ?? "").startsWith("multipart/form-data")) {
          throw new ProgramError(400, "INVALID_PAYLOAD", "Send the form as multipart/form-data.");
        }
        const { fields, files } = await readMultipart(req, {
          fileField: "lampiran",
          maxFiles: MAX_LAMPIRAN,
          maxFileBytes: MAX_LAMPIRAN_BYTES,
          galat: galatLampiran,
        });
        return { data: await klinik.buatTiket(req.accountability, fields.payload, files, fields.captcha), status: 201 };
      }),
    )(konteks),
  );
  router.post("/tiket/lacak", publik(jalan(async (req) => ({ data: await klinik.lacakTiket(req.body) })))(konteks));
  router.get("/tiket", terjaga(PETUGAS, jalan(async (req, p) => ({ data: await klinik.listTiket(p, req.query) })))(konteks));
  router.patch(
    "/tiket/:id",
    terjaga(PETUGAS, jalan(async (req, p) => ({ data: await klinik.ubahStatusTiket(p, req.params?.id, req.body, req.body?.versi) })))(konteks),
  );
  router.get("/lampiran/:fileId", terjaga(SEMUA, () => lampiran(klinik, context.logger))(konteks));
  router.post("/notifikasi/receipt", publik(() => receipt(konteks))(konteks));
};

/** Port berkas di atas Directus FilesService/AssetsService (tanpa accountability: akses lewat use case). */
function berkasDirectus({ services, getSchema, env }) {
  return {
    async simpan({ buffer, filename, type, folder, title }) {
      const service = new services.FilesService({ schema: await getSchema(), accountability: null });
      return service.uploadOne(Readable.from(buffer), {
        storage: storageLocation(env),
        folder,
        filename_download: filename,
        title,
        type,
      });
    },
    async hapus(ids) {
      const service = new services.FilesService({ schema: await getSchema(), accountability: null });
      await service.deleteMany(ids);
    },
    async baca(fileId) {
      const assets = new services.AssetsService({ accountability: null, schema: await getSchema() });
      return assets.getAsset(fileId, null, null, false);
    },
  };
}

function storageLocation(env) {
  const locations = env?.STORAGE_LOCATIONS;
  const first = Array.isArray(locations) ? locations[0] : String(locations ?? "local").split(",")[0];
  return first.trim() || "local";
}

/** GET /lampiran/:fileId: use case memutuskan akses; adapter mengalirkan byte dengan header aman. */
function lampiran(klinik, logger) {
  return async (req, res, pemanggil) => {
    try {
      const asset = await klinik.bacaLampiran(pemanggil, req.params?.fileId);
      res.setHeader("Content-Type", asset.file.type || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(asset.file.filename_download ?? "lampiran")}"`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      noStore(res);
      asset.stream.pipe(res);
    } catch (error) {
      sendError(res, logger, error);
    }
  };
}

/** Provider delivery receipt; the shared secret keeps forged callbacks out of the outbox. */
function receipt(context) {
  return async (req, res) => {
    const secret = receiptSecret(context.env);
    if (!secret) {
      sendError(res, context.logger, new ProgramError(503, "RECEIPT_NOT_CONFIGURED", "The receipt callback is not configured."));
      return;
    }
    const given = String(req.headers?.["x-diskuk-secret"] ?? "");
    // Directus renders errors it does not recognise as 500, so refusals are answered here.
    if (!samaRahasia(given, secret)) {
      sendError(res, context.logger, new ProgramError(401, "FORBIDDEN", "Invalid receipt secret."));
      return;
    }
    try {
      const body = objectBody(req);
      const updated = await context.outbox.terapkanResi({
        id: body.id ?? null,
        providerMessageId: body.messageId ?? body.message_id ?? null,
        status: body.status,
        receipt: body,
      });
      noStore(res);
      res.json({ data: { diterapkan: Boolean(updated), status: updated?.status ?? null } });
    } catch (error) {
      sendError(res, context.logger, error);
    }
  };
}

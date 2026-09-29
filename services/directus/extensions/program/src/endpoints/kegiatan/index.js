import { ProgramError, escapeHtml, noStore, samaRahasia, sendError } from "../../lib/utils/http.js";
import { uuidParam } from "../../lib/validate.js";
import { getOutbox } from "../../lib/outbox/runtime.js";
import { batalkanPengingat, detailKegiatan, jadwalkanPengingatJatuhTempo, lihatPengingat, listKegiatan, optInPengingat } from "./service.js";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";

const { publik } = cakupan;

// Public agenda (Brief Fitur Modul 7.2 — Y07/M7-07…M7-10):
//   GET  /v1/program/kegiatan?bulan&tahun&kategori&penyelenggara&metode&ramah&status
//        PUBLIC list: server-side filters, temporal status, counts and the 27 dinas options
//   GET  /v1/program/kegiatan/:id                PUBLIC detail (published events only)
//   POST /v1/program/kegiatan/:id/pengingat      PUBLIC, captcha: opt in to a WhatsApp/email reminder
//   POST /v1/program/kegiatan/pengingat/batal    PUBLIC: cancel one reminder by its token
//   GET  /v1/program/kegiatan/pengingat/:token   PUBLIC: unsubscribe page linked from the e-mail
//   POST /v1/program/kegiatan/pengingat/proses   internal (x-operasional-internal-secret): run the job
export default (router, context) => {
  const { database, logger, env = {} } = context;

  /**
   * Response envelope, the same convention the analytics bundle uses (analysis/index.js): `data`
   * always carries the whole payload and `meta` travels inside it (`{ meta, data: [...] }` ->
   * `{ data: { items: [...], meta } }`), because the Directus SDK unwraps the top-level `data`
   * key and anything beside it would be lost to SDK clients.
   */
  const envelope = (payload) => {
    if (!payload || typeof payload !== "object" || !("meta" in payload) || !("data" in payload)) return payload;
    const { data, meta, ...rest } = payload;
    const inner = data && typeof data === "object" && !Array.isArray(data) ? { ...data, meta } : { items: data, meta };
    return { ...rest, data: inner };
  };

  // The returned promise keeps the route usable from tests that await the handler, while Express
  // ignores it — errors are always answered inside sendError.
  const jalan = (res, task) =>
    Promise.resolve()
      .then(task)
      .catch((error) => sendError(res, logger, error));

  const halaman = (judul, isi) =>
    `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${judul}</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
  main { max-width: 32rem; margin: 4rem auto; padding: 1.5rem; background: #fff; border: 1px solid #e2e8f0; border-radius: .75rem; }
  h1 { font-size: 1.125rem; margin-top: 0; }
  p { line-height: 1.6; }
  a.tombol { display: inline-block; padding: .5rem 1rem; background: #0f172a; color: #fff; text-decoration: none; border-radius: .5rem; }
</style>
</head>
<body><main>${isi}</main></body>
</html>`;

  const kirimHalaman = (res, status, judul, isi) => {
    res.status(status);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(halaman(judul, isi));
  };

  router.get("/", publik(() => (req, res) =>
    jalan(res, async () => {
      const hasil = await listKegiatan(database, req.query ?? {});
      noStore(res);
      res.json(envelope(hasil));
    }),
  )(context));

  // Literal reminder routes before "/:id" so they never match the id pattern.
  router.post("/pengingat/batal", publik(() => (req, res) =>
    jalan(res, async () => {
      const hasil = await batalkanPengingat(database, req.body?.token, getOutbox(context));
      noStore(res);
      res.json(hasil);
    }),
  )(context));

  router.post("/pengingat/proses", publik(() => (req, res) =>
    jalan(res, async () => {
      const secret = req.headers?.["x-operasional-internal-secret"];
      if (!env.OPERASIONAL_INTERNAL_SECRET || !samaRahasia(String(secret ?? ""), env.OPERASIONAL_INTERNAL_SECRET)) {
        throw new ProgramError(403, "FORBIDDEN", "The reminder job requires the internal secret.");
      }
      // The same two steps as the scheduled hook (hooks/notifikasi.js): schedule what is due, then
      // let the outbox send. Returned together so the runtime proof sees the whole path.
      const outbox = getOutbox(context);
      const jadwal = await jadwalkanPengingatJatuhTempo({ database, outbox, env });
      const kirim = await outbox.dispatch({ limit: 50 });
      noStore(res);
      res.json({ data: { ...jadwal, ...kirim } });
    }),
  )(context));

  router.get("/pengingat/:token", publik(() => (req, res) => {
    const token = req.params?.token;
    // A mail scanner that pre-fetches the link must not cancel anything: the first GET only asks
    // for confirmation, the second one (?konfirmasi=1) performs the cancellation.
    const konfirmasi = String(req.query?.konfirmasi ?? "") === "1";
    const tidakDikenal = () =>
      kirimHalaman(res, 404, "Tautan tidak dikenal", "<h1>Tautan tidak dikenal</h1><p>Tautan pembatalan ini sudah tidak berlaku atau tidak pernah ada.</p>");
    // The returned promise lets tests await the page; Express itself ignores it.
    return (async () => {
      if (!konfirmasi) {
        let target;
        try {
          target = (await lihatPengingat(database, token)).data;
        } catch {
          tidakDikenal();
          return;
        }
        if (target.status === "dibatalkan") {
          kirimHalaman(res, 200, "Pengingat sudah dibatalkan", "<h1>Pengingat sudah dibatalkan</h1><p>Tidak ada pengingat aktif untuk tujuan ini.</p>");
          return;
        }
        kirimHalaman(
          res,
          200,
          "Batalkan pengingat",
          `<h1>Batalkan pengingat kegiatan?</h1>
<p>Tujuan: <strong>${escapeHtml(target.tujuanMasked)}</strong><br>Kanal: ${target.kanal === "email" ? "Email" : "WhatsApp"}</p>
<p>Setelah dibatalkan, Anda tidak akan menerima pengingat untuk kegiatan ini lagi.</p>
<p><a class="tombol" href="?konfirmasi=1">Batalkan pengingat</a></p>`,
        );
        return;
      }
      let hasil;
      try {
        hasil = (await batalkanPengingat(database, token, getOutbox(context))).data;
      } catch {
        tidakDikenal();
        return;
      }
      kirimHalaman(
        res,
        200,
        "Pengingat dibatalkan",
        `<h1>Pengingat dibatalkan</h1>
<p>Tujuan <strong>${escapeHtml(hasil.tujuanMasked)}</strong> tidak akan menerima pengingat untuk kegiatan ini.</p>`,
      );
    })().catch((error) => sendError(res, logger, error));
  })(context));

  router.get("/:id", publik(() => (req, res) =>
    jalan(res, async () => {
      const hasil = await detailKegiatan(database, uuidParam(req.params?.id, "INVALID_KEGIATAN_ID"));
      noStore(res);
      res.json(hasil);
    }),
  )(context));

  router.post("/:id/pengingat", publik(() => (req, res) =>
    jalan(res, async () => {
      const hasil = await optInPengingat(
        database,
        env,
        uuidParam(req.params?.id, "INVALID_KEGIATAN_ID"),
        req.body ?? {},
        new Date(),
        getOutbox(context),
      );
      noStore(res);
      res.status(201).json(hasil);
    }),
  )(context));
};

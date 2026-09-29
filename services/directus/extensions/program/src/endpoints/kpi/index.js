import { createKpi } from "./service.js";
import { noStore, sendError } from "../../lib/utils/http.js";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";

const { terjaga } = cakupan;

// Weekly KPI monitoring (Brief Fitur Modul 5), scoped by Cakupan Pemanggil:
//   GET   /v1/program/kpi/peserta                 active participants with this week's status
//   GET   /v1/program/kpi/peserta/:id             participant, weekly reports, pitching streak
//   POST  /v1/program/kpi/peserta/:id/laporan     submit a week's report (idempotent on clientUuid)
//   PATCH /v1/program/kpi/peserta/:id/pitching    toggle the pitching recommendation
//   GET   /v1/program/kpi/laporan?status=         review queue
//   POST  /v1/program/kpi/laporan/:id/review      approve or reject a report
// Kandidat 01: baca/kirim untuk semua peran ter-scope; kirim hanya umkm;
// review/pitching hanya provinsi/pendamping. Scope baris di use case via predikat.
// Kandidat 04: adapter tipis; validasi, transaksi, dan aturan ada di service.js (createKpi).
const BACA = { peran: ["provinsi", "kabkota", "pendamping", "umkm"] };
const KIRIM = { peran: ["umkm"] };
const REVIEW = { peran: ["provinsi", "pendamping"] };

const STATUS_KIRIM = { dibuat: 201, diulang: 200, direvisi: 200 };

/** Jalankan verb use case dan tulis `{ data }`; ProgramError menjadi respons error. */
const jalan = (verb) => (ctx) => async (req, res, pemanggil) => {
  try {
    const { data, status = 200 } = await verb(createKpi({ db: ctx.database }), req, pemanggil);
    noStore(res);
    res.status(status).json({ data });
  } catch (error) {
    sendError(res, ctx.logger, error);
  }
};

const data = (promise) => promise.then((hasil) => ({ data: hasil }));

export default (router, context) => {
  router.get("/peserta", terjaga(BACA, jalan((kpi, _req, p) => data(kpi.listPeserta(p))))(context));
  router.get("/peserta/:id", terjaga(BACA, jalan((kpi, req, p) => data(kpi.bacaPeserta(p, req.params?.id))))(context));
  router.post(
    "/peserta/:id/laporan",
    terjaga(
      KIRIM,
      jalan(async (kpi, req, p) => {
        const { hasil, laporan } = await kpi.kirimLaporan(p, req.params?.id, req.body);
        return { data: laporan, status: STATUS_KIRIM[hasil] };
      }),
    )(context),
  );
  router.patch("/peserta/:id/pitching", terjaga(REVIEW, jalan((kpi, req, p) => data(kpi.setPitching(p, req.params?.id, req.body))))(context));
  router.get("/laporan", terjaga(REVIEW, jalan((kpi, req, p) => data(kpi.listLaporan(p, req.query ?? {}))))(context));
  router.post("/laporan/:id/review", terjaga(REVIEW, jalan((kpi, req, p) => data(kpi.reviewLaporan(p, req.params?.id, req.body))))(context));
};

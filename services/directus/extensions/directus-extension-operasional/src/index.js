"use strict";

const { routeGuard, ALL_ROLES } = require("../../shared/auth.cjs");
const { DATA_ROLES, resolveOperator } = require("../../shared/operator.cjs");
const { sendOperasionalError } = require("./errors.js");
// Y01 (agen paralel): identitas fungsional — getMe, resolveNib, listAktivitas.
const { getMe, resolveNib, listAktivitas } = require("./me-service.js");
const { getUsahaLapangan, updateUsahaLapangan, verifikasiUsaha } = require("./usaha-service.js");
const {
  getPrefill,
  hitungSkor,
  ajukan,
  listTalenta,
  getTalenta,
  nominasi,
  tolak,
  terbitkanBeritaAcara,
  listBeritaAcara,
} = require("./talenta-service.js");
const { streamBerkas } = require("./berkas-service.js");
const {
  listBatch,
  createBatch,
  listPendamping,
  listPeserta,
  ubahTahap,
  ubahProgram,
  getUsahaSaya,
  listLaporanSaya,
  kirimLaporan,
} = require("./program-service.js");
const {
  listBinaan,
  listAntrean,
  getLaporan,
  verifikasiLaporan,
  getBinaanDetail,
  setRekomendasi,
} = require("./binaan-service.js");

function jsonBody(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

function wrap(req, res, next, database, task, roles = DATA_ROLES) {
  if (!routeGuard(req, next, { roles })) return;
  const requestId = req.headers?.["x-request-id"];
  Promise.resolve()
    .then(async () => {
      const operator = await resolveOperator(database, req.accountability);
      return task(operator);
    })
    .then((result) => {
      res.setHeader?.("Cache-Control", "private, no-store");
      res.status(200).json(result);
    })
    .catch((error) => sendOperasionalError(res, error, requestId));
}

module.exports = {
  id: "operasional",
  handler: (router, { database, services, getSchema }) => {
    // ── Y01: identitas fungsional (jangan ubah tanpa koordinasi agen Y01) ──
    router.get("/me", (req, res, next) => {
      if (!routeGuard(req, next, { roles: ALL_ROLES })) return;
      const requestId = req.headers?.["x-request-id"];
      Promise.resolve()
        .then(() => getMe(database, req.accountability))
        .then((data) => {
          res.setHeader?.("Cache-Control", "private, no-store");
          res.status(200).json({ data });
        })
        .catch((error) => sendOperasionalError(res, error, requestId));
    });
    router.get("/aktivitas", (req, res, next) => {
      if (!routeGuard(req, next, { roles: ALL_ROLES })) return;
      const requestId = req.headers?.["x-request-id"];
      Promise.resolve()
        .then(() => listAktivitas(database, req.accountability))
        .then((data) => {
          res.setHeader?.("Cache-Control", "private, no-store");
          res.status(200).json({ data });
        })
        .catch((error) => sendOperasionalError(res, error, requestId));
    });
    router.post("/internal/resolve-nib", (req, res, next) => {
      if (!routeGuard(req, next)) return;
      const requestId = req.headers?.["x-request-id"];
      Promise.resolve()
        .then(() => resolveNib(database, req.headers, jsonBody(req)))
        .then((data) => {
          res.setHeader?.("Cache-Control", "private, no-store");
          res.status(200).json({ data });
        })
        .catch((error) => sendOperasionalError(res, error, requestId));
    });

    // ── Y02: data lapangan + Talent Scouting ──
    router.get("/usaha/:id", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        getUsahaLapangan(database, req.params?.id, operator),
      ),
    );
    router.patch("/usaha/:id", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        updateUsahaLapangan(database, req.params?.id, jsonBody(req), operator),
      ),
    );
    router.post("/usaha/:id/verifikasi", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        verifikasiUsaha(database, req.params?.id, operator),
      ),
    );

    router.get("/talenta/prefill/:usahaId", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        getPrefill(database, req.params?.usahaId, operator),
      ),
    );
    router.post("/talenta/skor", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        hitungSkor(database, jsonBody(req), operator),
      ),
    );
    router.post("/talenta", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        ajukan(database, jsonBody(req), operator),
      ),
    );
    router.get("/talenta", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        listTalenta(database, req.query || {}, operator),
      ),
    );
    router.get("/talenta/:id", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        getTalenta(database, req.params?.id, operator),
      ),
    );
    router.post("/talenta/:id/nominasi", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        nominasi(database, req.params?.id, operator),
      ),
    );
    router.post("/talenta/:id/tolak", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        tolak(database, req.params?.id, jsonBody(req), operator),
      ),
    );
    router.post("/berita-acara", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        terbitkanBeritaAcara(database, jsonBody(req), operator),
      ),
    );
    router.get("/berita-acara", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        listBeritaAcara(database, operator),
      ),
    );

    // ── Y03: program akselerasi + laporan Jumat (offline-first) ──
    router.get("/batch", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        listBatch(database, operator),
      ),
    );
    router.post("/batch", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        createBatch(database, jsonBody(req), operator),
      ),
    );
    router.get("/pendamping", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        listPendamping(database, operator),
      ),
    );
    router.get("/akselerasi/peserta", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        listPeserta(database, req.query || {}, operator),
      ),
    );
    router.post("/talenta/:id/tahap", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        ubahTahap(database, req.params?.id, jsonBody(req), operator),
      ),
    );
    router.patch("/talenta/:id/program", (req, res, next) =>
      wrap(req, res, next, database, (operator) =>
        ubahProgram(database, req.params?.id, jsonBody(req), operator),
      ),
    );
    router.get("/usaha-saya", (req, res, next) =>
      wrap(
        req,
        res,
        next,
        database,
        (operator) => getUsahaSaya(database, operator),
        ["umkm"],
      ),
    );
    router.get("/laporan-saya", (req, res, next) =>
      wrap(
        req,
        res,
        next,
        database,
        (operator) => listLaporanSaya(database, operator),
        ["umkm"],
      ),
    );
    router.post("/laporan", (req, res, next) =>
      wrap(
        req,
        res,
        next,
        database,
        (operator) => kirimLaporan(database, jsonBody(req), operator),
        ["umkm"],
      ),
    );

    // ── Y03: binaan pendamping + verifikasi ──
    router.get("/binaan", (req, res, next) =>
      wrap(
        req,
        res,
        next,
        database,
        (operator) => listBinaan(database, operator),
        ["pendamping"],
      ),
    );
    router.get("/binaan/antrean", (req, res, next) =>
      wrap(
        req,
        res,
        next,
        database,
        (operator) => listAntrean(database, req.query || {}, operator),
        ["pendamping"],
      ),
    );
    router.get("/binaan/:talentaId", (req, res, next) =>
      wrap(
        req,
        res,
        next,
        database,
        (operator) => getBinaanDetail(database, req.params?.talentaId, operator),
        ["pendamping", "provinsi", "kabkota"],
      ),
    );
    router.post("/binaan/:talentaId/rekomendasi", (req, res, next) =>
      wrap(
        req,
        res,
        next,
        database,
        (operator) => setRekomendasi(database, req.params?.talentaId, jsonBody(req), operator),
        ["pendamping"],
      ),
    );
    router.get("/laporan/:id", (req, res, next) =>
      wrap(
        req,
        res,
        next,
        database,
        (operator) => getLaporan(database, req.params?.id, operator),
        ["pendamping", "provinsi", "kabkota", "umkm"],
      ),
    );
    router.post("/laporan/:id/verifikasi", (req, res, next) =>
      wrap(
        req,
        res,
        next,
        database,
        (operator) => verifikasiLaporan(database, req.params?.id, jsonBody(req), operator),
        ["pendamping"],
      ),
    );

    router.get("/berkas/:fileId", (req, res, next) => {
      if (!routeGuard(req, next, { roles: ALL_ROLES })) return;
      Promise.resolve()
        .then(async () => {
          const operator = await resolveOperator(database, req.accountability, {
            requireAssignment: false,
          });
          await streamBerkas(
            { database, services, getSchema },
            req.params?.fileId,
            operator,
            res,
          );
        })
        .catch((error) => sendOperasionalError(res, error, req.headers?.["x-request-id"]));
    });
  },
};

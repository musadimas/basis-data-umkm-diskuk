"use strict";

const { routeGuard, ALL_ROLES } = require("../../shared/auth.cjs");
const { DATA_ROLES, resolveOperator } = require("../../shared/operator.cjs");
const { sendOperasionalError } = require("./errors.js");
// Y01 (agen paralel): identitas fungsional — getMe, resolveNib, listAktivitas.
const { getMe, resolveNib, listAktivitas } = require("./me-service.js");
const { getUsahaLapangan, updateUsahaLapangan, verifikasiUsaha } = require("./usaha-service.js");

function jsonBody(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

// routeGuard hanya memastikan pengguna aplikasi terautentikasi (semua peran operasional memakai
// satu UUID role Directus, jadi roleKeyOf selalu "provinsi"). Batas peran per route ditegakkan
// resolveOperator dari app_role lewat `roles`.
function wrap(req, res, next, database, task, roles = DATA_ROLES) {
  if (!routeGuard(req, next, { roles: ALL_ROLES })) return;
  const requestId = req.headers?.["x-request-id"];
  Promise.resolve()
    .then(async () => {
      const operator = await resolveOperator(database, req.accountability, { roles });
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
  handler: (router, { database }) => {
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

    // ── Y02: data lapangan ──
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
  },
};

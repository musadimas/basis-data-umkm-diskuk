"use strict";

const { ALL_ROLES, DATA_ROLES, terjaga } = require("../../../analytics-shared/cakupan.cjs");
const { sendOperasionalError } = require("./errors.js");
const { getMe } = require("./me-service.js");
const { getUsahaLapangan, updateUsahaLapangan, verifikasiUsaha } = require("./usaha-service.js");
const { getAspekPerkembangan } = require("./permen-aspek.js");

function jsonBody(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

// Kandidat 01: gerbang UUID role + muatPemanggil + peran dijaga adapter `terjaga()`
// (cakupan.cjs); handler hanya menjalankan tugas dan merender error operasional.
function jawab(task) {
  return (ctx) => async (req, res, pemanggil) => {
    const requestId = req.headers?.["x-request-id"];
    try {
      const result = await task(ctx.database, req, pemanggil);
      res.setHeader?.("Cache-Control", "private, no-store");
      res.status(200).json(result);
    } catch (error) {
      sendOperasionalError(res, error, requestId);
    }
  };
}

module.exports = {
  id: "operasional",
  handler: (router, ctx) => {
    // ── Y01: identitas fungsional ──
    router.get(
      "/me",
      terjaga({ peran: ALL_ROLES }, jawab(async (database, req) => ({ data: await getMe(database, req.accountability) }))) (ctx),
    );

    router.get(
      "/aspek-perkembangan",
      terjaga({ peran: DATA_ROLES }, jawab((database, req, pemanggil) =>
        getAspekPerkembangan(database, req.query ?? {}, { role: pemanggil.peran, kotaId: pemanggil.kotaId }),
      ))(ctx),
    );

    // ── Y02: data lapangan ──
    router.get(
      "/usaha/:id",
      terjaga({ peran: DATA_ROLES }, jawab((database, req, pemanggil) => getUsahaLapangan(database, req.params?.id, pemanggil)))(ctx),
    );
    router.patch(
      "/usaha/:id",
      terjaga({ peran: DATA_ROLES }, jawab((database, req, pemanggil) => updateUsahaLapangan(database, req.params?.id, jsonBody(req), pemanggil)))(ctx),
    );
    router.post(
      "/usaha/:id/verifikasi",
      terjaga({ peran: DATA_ROLES }, jawab((database, req, pemanggil) => verifikasiUsaha(database, req.params?.id, pemanggil)))(ctx),
    );
  },
};

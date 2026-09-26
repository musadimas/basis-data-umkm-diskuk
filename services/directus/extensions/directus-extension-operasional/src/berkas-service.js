"use strict";

const { OperasionalError, validationFailed } = require("./errors.js");

const FOLDER_OPERASIONAL = "fa57be17-82ba-480c-b77c-536d42a124d4";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rowsOf = (result) => result?.rows ?? result?.[0] ?? result ?? [];

function sanitizeFilename(name) {
  return String(name || "berkas").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "berkas";
}

async function assertBerkasMilik(database, fileId, operator) {
  if (!UUID_PATTERN.test(String(fileId || ""))) {
    throw validationFailed({ berkas: "Berkas tidak valid" });
  }
  const result = await database.raw(
    `SELECT id, folder, uploaded_by FROM directus_files WHERE id = ? LIMIT 1`,
    [fileId],
  );
  const row = rowsOf(result)[0];
  if (!row || row.folder !== FOLDER_OPERASIONAL || String(row.uploaded_by) !== String(operator?.userId)) {
    throw validationFailed({ berkas: "Berkas tidak valid" });
  }
  return row;
}

// Aturan baca berkas domain: surat_komitmen dapat dibaca bila talenta dapat
// diakses operator (provinsi: semua; kabkota: talenta.kota = operator.kotaId).
// bukti_laporan (Y03): talenta_laporan_mingguan.bukti dapat dibaca oleh
// provinsi, kabkota scoped kota, pendamping binaan, atau umkm pemilik usaha.
// Di luar aturan, pengunggah selalu boleh membaca berkasnya sendiri.
const BERKAS_RULES = [
  {
    key: "surat_komitmen",
    async resolve(database, fileId, operator) {
      const result = await database.raw(
        `SELECT t.id, t.kota FROM talenta t WHERE t.surat_komitmen = ? LIMIT 1`,
        [fileId],
      );
      const row = rowsOf(result)[0];
      if (!row) return false;
      if (operator?.role === "provinsi") return true;
      if (operator?.role === "kabkota" && Number(row.kota) === Number(operator.kotaId)) return true;
      return false;
    },
  },
  {
    key: "bukti_laporan",
    async resolve(database, fileId, operator) {
      const result = await database.raw(
        `SELECT t.pendamping, t.usaha, t.kota
         FROM talenta_laporan_mingguan l JOIN talenta t ON t.id = l.talenta
         WHERE l.bukti = ? LIMIT 1`,
        [fileId],
      );
      const row = rowsOf(result)[0];
      if (!row) return false;
      if (operator?.role === "provinsi") return true;
      if (operator?.role === "kabkota" && Number(row.kota) === Number(operator.kotaId)) return true;
      if (operator?.role === "pendamping" && String(row.pendamping) === String(operator.userId)) return true;
      if (operator?.role === "umkm" && String(row.usaha) === String(operator.usahaId)) return true;
      return false;
    },
  },
];

async function bolehBacaBerkas(database, file, operator) {
  if (!file || !operator) return false;
  if (String(file.uploaded_by) === String(operator.userId)) return true;
  for (const rule of BERKAS_RULES) {
    try {
      if (await rule.resolve(database, file.id, operator)) return true;
    } catch {
      // lanjut ke aturan berikutnya
    }
  }
  return false;
}

async function streamBerkas({ database, services, getSchema }, fileId, operator, res) {
  if (!UUID_PATTERN.test(String(fileId || ""))) {
    throw new OperasionalError(404, "NOT_FOUND", "Berkas tidak ditemukan.");
  }
  const result = await database.raw(
    `SELECT id, folder, uploaded_by, type, filename_download FROM directus_files WHERE id = ? LIMIT 1`,
    [fileId],
  );
  const file = rowsOf(result)[0];
  if (!file || file.folder !== FOLDER_OPERASIONAL) {
    throw new OperasionalError(404, "NOT_FOUND", "Berkas tidak ditemukan.");
  }
  const allowed = await bolehBacaBerkas(database, file, operator);
  if (!allowed) {
    throw new OperasionalError(404, "NOT_FOUND", "Berkas tidak ditemukan.");
  }
  const schema = await getSchema();
  const assets = new services.AssetsService({ schema, accountability: null });
  const { stream, file: meta } = await assets.getAsset(fileId, { transformationParams: {} });
  res.setHeader?.("Content-Type", meta?.type || file.type || "application/octet-stream");
  res.setHeader?.("Content-Disposition", `inline; filename="${sanitizeFilename(meta?.filename_download || file.filename_download)}"`);
  res.setHeader?.("Cache-Control", "private, no-store");
  res.setHeader?.("X-Content-Type-Options", "nosniff");
  await new Promise((resolve, reject) => {
    stream.on("error", reject);
    stream.pipe(res);
    stream.on("end", resolve);
  });
}

module.exports = {
  FOLDER_OPERASIONAL,
  BERKAS_RULES,
  assertBerkasMilik,
  bolehBacaBerkas,
  streamBerkas,
  sanitizeFilename,
};

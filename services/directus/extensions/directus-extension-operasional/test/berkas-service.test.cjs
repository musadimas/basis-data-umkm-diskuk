"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { Readable } = require("node:stream");
const {
  FOLDER_OPERASIONAL,
  assertBerkasMilik,
  streamBerkas,
} = require("../src/berkas-service.js");

const FILE_ID = "44444444-4444-4444-8444-000000000001";
const ME = { userId: "u-1", role: "kabkota", kotaId: 1 };

function dbFor({ file = null, talenta = null } = {}) {
  return {
    raw: async (sql) => {
      if (sql.includes("FROM directus_files")) return { rows: file ? [file] : [] };
      if (sql.includes("FROM talenta t")) return { rows: talenta ? [talenta] : [] };
      return { rows: [] };
    },
  };
}

test("UUID invalid → 404", async () => {
  const db = dbFor();
  await assert.rejects(() => streamBerkas({ database: db, services: {}, getSchema: async () => ({}) }, "nope", ME, {}), (e) => e.statusCode === 404);
});

test("berkas milik orang lain tanpa referensi → 404", async () => {
  const db = dbFor({
    file: { id: FILE_ID, folder: FOLDER_OPERASIONAL, uploaded_by: "u-lain", type: "image/png", filename_download: "x.png" },
    talenta: null,
  });
  await assert.rejects(
    () => streamBerkas({ database: db, services: {}, getSchema: async () => ({}) }, FILE_ID, ME, {}),
    (e) => e.statusCode === 404,
  );
});

test("kabkota membaca surat komitmen talenta kota lain → 404", async () => {
  const db = dbFor({
    file: { id: FILE_ID, folder: FOLDER_OPERASIONAL, uploaded_by: "u-lain", type: "image/png", filename_download: "komitmen.png" },
    talenta: { id: "t-1", kota: 99 },
  });
  await assert.rejects(
    () => streamBerkas({ database: db, services: {}, getSchema: async () => ({}) }, FILE_ID, ME, {}),
    (e) => e.statusCode === 404,
  );
});

test("pengunggah membaca berkasnya → stream + header nosniff + nama disanitasi", async () => {
  const { Writable } = require("node:stream");
  const db = dbFor({
    file: { id: FILE_ID, folder: FOLDER_OPERASIONAL, uploaded_by: "u-1", type: "image/png", filename_download: "komitmen (1).png" },
  });
  const services = {
    AssetsService: class {
      constructor() {}
      async getAsset() {
        return {
          stream: Readable.from([Buffer.from("png-bytes")]),
          file: { type: "image/png", filename_download: "komitmen (1).png" },
        };
      }
    },
  };
  const headers = {};
  const chunks = [];
  const res = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(Buffer.from(chunk));
      cb();
    },
  });
  res.setHeader = (k, v) => {
    headers[k.toLowerCase()] = v;
  };
  await streamBerkas({ database: db, services, getSchema: async () => ({}) }, FILE_ID, ME, res);
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["cache-control"], "private, no-store");
  assert.equal(headers["content-type"], "image/png");
  assert.match(headers["content-disposition"], /komitmen__1_\.png/);
  assert.equal(Buffer.concat(chunks).toString(), "png-bytes");
});

test("assertBerkasMilik menolak folder lain dan pemilik lain", async () => {
  const dbOk = dbFor({ file: { id: FILE_ID, folder: FOLDER_OPERASIONAL, uploaded_by: "u-1" } });
  assert.ok(await assertBerkasMilik(dbOk, FILE_ID, ME));
  const dbFolder = dbFor({ file: { id: FILE_ID, folder: "lain", uploaded_by: "u-1" } });
  await assert.rejects(() => assertBerkasMilik(dbFolder, FILE_ID, ME), (e) => e.statusCode === 400);
  const dbOwner = dbFor({ file: { id: FILE_ID, folder: FOLDER_OPERASIONAL, uploaded_by: "u-2" } });
  await assert.rejects(() => assertBerkasMilik(dbOwner, FILE_ID, ME), (e) => e.statusCode === 400);
});

test("Y03 bukti_laporan: pendamping binaan boleh, pendamping lain ditolak", async () => {
  const { BERKAS_RULES } = require("../src/berkas-service.js");
  const rule = BERKAS_RULES.find((r) => r.key === "bukti_laporan");
  assert.ok(rule, "aturan bukti_laporan ada");
  const dbBinaan = {
    raw: async () => ({ rows: [{ pendamping: "pend-1", usaha: "usaha-1", kota: 1 }] }),
  };
  assert.equal(await rule.resolve(dbBinaan, FILE_ID, { userId: "pend-1", role: "pendamping" }), true);
  assert.equal(await rule.resolve(dbBinaan, FILE_ID, { userId: "pend-2", role: "pendamping" }), false);
  assert.equal(await rule.resolve(dbBinaan, FILE_ID, { role: "provinsi" }), true);
  assert.equal(
    await rule.resolve(dbBinaan, FILE_ID, { userId: "u", role: "umkm", usahaId: "usaha-1" }),
    true,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import registerKatalog from "../src/endpoints/katalog/index.js";
import { createKatalog } from "../src/endpoints/katalog/service.js";
import { mountEndpoint } from "./helpers.js";

const ID = "5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11";
const LOI_KEY = "3f1a7c58-5c2a-4a4f-9c1d-6a1f0f8f5b21";

/** Use case murni: database yang meledak bila disentuh membuktikan validasi berjalan sebelum query. */
const tanpaDb = new Proxy({}, { get: () => assert.fail("validasi harus menolak sebelum menyentuh database") });
const katalog = createKatalog({ db: tanpaDb, env: { SECRET: "x" } });
const kurator = { id: ID, admin: true, peran: "provinsi", kotaId: null, usahaId: null };
const kodeGagal = async (janji) => {
  const error = await janji.then(
    () => assert.fail("seharusnya ditolak"),
    (e) => e,
  );
  return [error.statusCode, error.code];
};

test("management routes require a session; only the letter-of-intent form and the spec sheet are public", async () => {
  const { call, routes, queries } = mountEndpoint(registerKatalog, { env: { SECRET: "x" } });
  assert.equal(routes.length, 10);
  for (const { method, path } of routes) {
    if (method === "POST" && path === "/loi") continue;
    if (method === "GET" && path === "/produk/:id/pdf") continue;
    const { nextError } = await call(method, path.replace(/:\w+/g, ID), { accountability: null, query: { usaha: ID } });
    assert.equal(nextError?.statusCode, 401, `${method} ${path}`);
  }
  assert.equal(queries.length, 0);
});

test("payload LOI publik divalidasi sebelum query apa pun", async () => {
  const valid = { produk: ID, nama: "Pembeli", email: "beli@contoh.id", pesan: "Minat", clientUuid: LOI_KEY, persetujuanKontak: true };
  for (const [patch, hasil] of [
    [{ email: "bukan-email" }, [400, "INVALID_PAYLOAD"]],
    [{ nama: "" }, [400, "INVALID_PAYLOAD"]],
    [{ pesan: "x".repeat(2001) }, [400, "INVALID_PAYLOAD"]],
    [{ telepon: "call me" }, [400, "INVALID_PAYLOAD"]],
    [{ produk: "x" }, [400, "INVALID_PRODUK_ID"]],
    [{ persetujuanKontak: false }, [400, "PERSETUJUAN_WAJIB"]],
    [{ clientUuid: null }, [400, "INVALID_PAYLOAD"]],
  ]) {
    assert.deepEqual(await kodeGagal(katalog.kirimLoi({ ...valid, ...patch })), hasil, JSON.stringify(patch));
  }
});

test("payload produk divalidasi sebelum query apa pun", async () => {
  const valid = { usaha: ID, nama: "Keripik", foto: [] };
  for (const patch of [
    { nama: "" },
    { kategori: "senjata" },
    { videoUrl: "http://example.com/v" },
    { videoUrl: "javascript:alert(1)" },
    { kbli: "ABC" },
    { tkdnPersen: 120 },
    { moq: 0 },
    { foto: [ID, ID, ID, ID, ID, "x"] },
    { pdnDeklarasi: "ya" },
  ]) {
    const [status] = await kodeGagal(katalog.buatProduk(kurator, { ...valid, ...patch }));
    assert.equal(status, 400, JSON.stringify(patch));
    const [statusEdit] = await kodeGagal(katalog.editProduk(kurator, ID, { ...valid, ...patch }));
    assert.equal(statusEdit, 400, `edit ${JSON.stringify(patch)}`);
  }
  assert.deepEqual(await kodeGagal(katalog.kurasiProduk(kurator, ID, { keputusan: "ditolak" })), [400, "CATATAN_WAJIB"]);
});

test("toProduk carries the server price label (B38)", async () => {
  const { toProduk } = await import("../src/endpoints/katalog/service.js");
  assert.equal(toProduk({ harga_retail: 15000, harga_grosir: 12000 }).hargaLabel, "Rp 12.000 - Rp 15.000");
  assert.equal(toProduk({ harga_retail: 15000, harga_grosir: null }).hargaLabel, "Rp 15.000");
  assert.equal(toProduk({ harga_retail: null, harga_grosir: null }).hargaLabel, null);
});

test("semua route katalog bertanda terjaga/publik dengan peran yang tepat (01)", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const cakupan = require("../../../analytics-shared/cakupan.cjs");
  const { routes } = mountEndpoint(registerKatalog, { env: { SECRET: "x" } });
  assert.equal(routes.length, 10);
  const ekspektasi = [
    ["GET", "/usaha", "terjaga", ["provinsi", "umkm"]],
    ["GET", "/produk", "terjaga", ["provinsi", "umkm"]],
    ["POST", "/produk", "terjaga", ["provinsi", "umkm"]],
    ["PATCH", "/produk/:id", "terjaga", ["provinsi", "umkm"]],
    ["GET", "/kurasi", "terjaga", ["provinsi"]],
    ["POST", "/produk/:id/kurasi", "terjaga", ["provinsi"]],
    ["GET", "/foto/:fileId", "terjaga", ["provinsi", "umkm"]],
    ["GET", "/produk/:id/pdf", "publik", []],
    ["GET", "/loi", "terjaga", ["provinsi", "umkm"]],
    ["POST", "/loi", "publik", []],
  ];
  for (const [method, path, jenis, peran] of ekspektasi) {
    const route = routes.find((r) => r.method === method && r.path === path);
    assert.ok(route, `${method} ${path} terdaftar`);
    const tanda = cakupan.tandaCakupan(route.handler);
    assert.equal(tanda?.jenis, jenis, `${method} ${path}`);
    assert.deepEqual([...(tanda.peran ?? [])].sort(), [...peran].sort(), `${method} ${path}`);
  }
});

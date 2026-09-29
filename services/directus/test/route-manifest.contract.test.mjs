import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const cakupan = require("../analytics-shared/cakupan.cjs");

const ROOT = new URL("..", import.meta.url);

const konteksPalsu = () => ({
  database: {
    async raw() { throw new Error("manifest: route tidak boleh query saat di-mount"); },
    transaction: async (fn) => fn(konteksPalsu().database),
  },
  env: {},
  logger: { error() {}, warn() {}, info() {} },
  services: {},
  getSchema: async () => ({}),
});

function perekam() {
  const routes = [];
  const tambah = (method) => (path, handler) => routes.push({ method, path, handler });
  return {
    routes,
    router: { get: tambah("GET"), post: tambah("POST"), patch: tambah("PATCH"), put: tambah("PUT"), delete: tambah("DELETE") },
  };
}

function bacaPaket(relatif) {
  return JSON.parse(readFileSync(new URL(relatif, ROOT), "utf8"));
}

async function mountSemua() {
  const tercatat = [];
  const program = bacaPaket("extensions/program/package.json");
  for (const entri of program["directus:extension"].entries) {
    if (entri.type !== "endpoint") continue;
    const modul = await import(new URL(`extensions/program/${entri.source}`, ROOT));
    const { routes, router } = perekam();
    await modul.default(router, konteksPalsu());
    for (const route of routes) tercatat.push({ prefix: entri.name, ...route });
  }
  const analitik = bacaPaket("extensions/analytics/package.json");
  for (const entri of analitik["directus:extension"].entries) {
    if (entri.type !== "endpoint") continue;
    const modul = await import(new URL(`extensions/analytics/${entri.source}`, ROOT));
    const { routes, router } = perekam();
    await modul.default(router, konteksPalsu());
    for (const route of routes) tercatat.push({ prefix: entri.name, ...route });
  }
  const operasional = require("../extensions/directus-extension-operasional/src/index.js");
  {
    const { routes, router } = perekam();
    operasional.handler(router, konteksPalsu());
    for (const route of routes) tercatat.push({ prefix: "operasional", ...route });
  }
  const auth = bacaPaket("extensions/authentication/package.json");
  for (const entri of auth["directus:extension"].entries) {
    if (entri.type !== "endpoint") continue;
    const modul = await import(new URL(`extensions/authentication/${entri.source}`, ROOT));
    const { routes, router } = perekam();
    await modul.default(router, konteksPalsu());
    for (const route of routes) tercatat.push({ prefix: entri.name, ...route });
  }
  return tercatat;
}

const kunci = (route) => `${route.prefix}|${route.method}|${route.path}`;

// Rute publik yang eksplisit (lihat tabel peta route Kandidat 01): tanpa sesi,
// sebagian memakai captcha/rahasia. Daftar ini tidak boleh basi.
const DAFTAR_PUBLIK = new Set([
  "v1/analytics/analysis|GET|/metadata",
  "v1/analytics/analysis|GET|/templates",
  "v1/analytics/analysis|GET|/status",
  "v1/analytics/tabular|GET|/status",
  "v1/auth/captcha|GET|/challenge",
  "v1/program/fasilitasi|GET|/",
  "v1/program/registrasi|GET|/sertifikat/:kode",
  "v1/program/registrasi|POST|/pindai",
]);

// Rute yang belum dipindah ke terjaga()/publik() (kandidat 01 lanjutan, satu fitur
// per sesi). Setiap migrasi MENGHAPUS barisnya di sini; baris basi menggagalkan tes.
const LEGACY_BELUM_MIGRASI = new Set([]);

test("cakupan mengekspor interface adapter gelombang 3", () => {
  for (const nama of [
    "APPLICATION_ROLE_ID",
    "ALL_ROLES",
    "DATA_ROLES",
    "CAKUPAN_TANDA",
    "CakupanError",
    "routeGuard",
    "muatPemanggil",
    "wajibPeran",
    "predikat",
    "pastikanUsaha",
    "kapabilitas",
    "permissionScopeOf",
    "terjaga",
    "publik",
    "tandaCakupan",
  ]) {
    assert.ok(cakupan[nama] !== undefined, `${nama} harus diekspor cakupan.cjs`);
  }
  assert.equal(cakupan.APPLICATION_ROLE_ID, "7d6d493c-1a6d-4c59-9e74-40d42a7862eb");
});

test("setiap route terdaftar bertanda terjaga/publik atau tercatat legacy", async () => {
  const tercatat = await mountSemua();
  assert.ok(tercatat.length >= 77, `menemukan ${tercatat.length} route`);
  const tanpaTanda = [];
  for (const route of tercatat) {
    const tanda = cakupan.tandaCakupan(route.handler);
    if (tanda) {
      assert.ok(["terjaga", "publik"].includes(tanda.jenis), kunci(route));
      if (tanda.jenis === "terjaga") {
        assert.ok(Array.isArray(tanda.peran) && tanda.peran.length > 0, kunci(route));
        for (const peran of tanda.peran) assert.ok(cakupan.ALL_ROLES.includes(peran), `${kunci(route)}: ${peran}`);
      }
    } else if (!LEGACY_BELUM_MIGRASI.has(kunci(route))) {
      tanpaTanda.push(kunci(route));
    }
  }
  assert.deepEqual(tanpaTanda, [], `route baru wajib memakai terjaga()/publik(): ${tanpaTanda.join(", ")}`);
});

test("entri legacy dan daftar publik tidak basi", async () => {
  const tercatat = await mountSemua();
  const ada = new Set(tercatat.map(kunci));
  const legacyBasi = [...LEGACY_BELUM_MIGRASI].filter((k) => !ada.has(k));
  assert.deepEqual(legacyBasi, [], `hapus entri legacy yang sudah migrasi/hilang: ${legacyBasi.join(", ")}`);
  const publikBasi = [...DAFTAR_PUBLIK].filter((k) => !ada.has(k));
  assert.deepEqual(publikBasi, [], `daftar publik basi: ${publikBasi.join(", ")}`);
  const publikDiLuarLegacy = [...DAFTAR_PUBLIK].filter((k) => {
    const route = tercatat.find((r) => kunci(r) === k);
    const tanda = route && cakupan.tandaCakupan(route.handler);
    return tanda ? tanda.jenis !== "publik" : !LEGACY_BELUM_MIGRASI.has(k);
  });
  assert.deepEqual(publikDiLuarLegacy, [], `rute publik harus bertanda publik(): ${publikDiLuarLegacy.join(", ")}`);
});

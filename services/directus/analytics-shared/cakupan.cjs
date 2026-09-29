"use strict";

/**
 * Cakupan Pemanggil (kandidat 01 gelombang 3, ADR-009).
 *
 * Satu-satunya tempat yang menjawab "siapa pemanggil ini dan apa yang boleh ia
 * lihat". Menggantikan empat cara memuat pemanggil (`loadActor` program,
 * `actorKlinik`, dua salinan `resolveOperator`) dan tiga sumber kota dengan satu
 * module fail-closed di `services/directus/analytics-shared/` (K2: terjangkau
 * keempat bundle Directus dan worker ekspor).
 *
 * Aturan yang dipegang module ini (bukan pemanggil):
 * - Tanpa baris akun → 401. `app_role` NULL/asing → 403 tanpa akses (K7: migrasi
 *   `20260928A` sudah membuang DEFAULT dan NOT NULL; daftar audit ditinjau manual).
 * - Tidak ada peran default; kolom sesi (`accountability.appRole`) tidak pernah dibaca.
 * - Sumber kota usaha adalah `usaha_tabular.kota_id` (K3); kota null tidak pernah cocok.
 * - Target di luar cakupan → 404 seragam supaya keberadaan tidak bocor (K1, ikut
 *   rekomendasi; keputusan formal milik pemilik produk). `KOTA_NOT_ASSIGNED` tetap 403.
 * - Setiap route di-mount lewat `terjaga({ peran })` atau `publik()`; tes manifest
 *   (`services/directus/test/route-manifest.contract.test.mjs`) menolak route baru
 *   yang tidak bertanda. Rute lama dimigrasi bertahap, satu fitur per sesi.
 *
 * Bentuk error mengikuti `OperatorError`: `name = "DirectusError"` supaya Directus
 * merender statusnya, bukan meratakannya menjadi 500.
 */

const { APPLICATION_ROLE_ID, ANALYTICS_POLICY_ID } = require("./contracts.cjs");

const ALL_ROLES = ["provinsi", "kabkota", "pendamping", "umkm"];
const DATA_ROLES = ["provinsi", "kabkota"];

// Tanda adapter pada handler. Symbol global supaya salinan ESM/CJS yang berbeda
// tetap saling mengenali tandanya saat tes manifest me-mount semua bundle.
const CAKUPAN_TANDA = Symbol.for("diskuk.cakupan");

class CakupanError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "DirectusError";
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.extensions = { code, status };
  }
}

function requireDashboardAccountability(req, { adminOnly = false } = {}) {
  const accountability = req?.accountability;
  if (!accountability?.user) {
    throw new CakupanError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  if (adminOnly && !accountability.admin) {
    throw new CakupanError(403, "FORBIDDEN", "Administrator access required");
  }
  if (!accountability.admin && accountability.role !== APPLICATION_ROLE_ID) {
    throw new CakupanError(403, "FORBIDDEN", "Dashboard access is not permitted");
  }
  return accountability;
}

/** Gerbang UUID peran aplikasi; pemeriksaan peran/q wilayah terjadi di muatPemanggil. */
function routeGuard(req, next, options) {
  try {
    requireDashboardAccountability(req, options);
    return true;
  } catch (error) {
    next(error);
    return false;
  }
}

/**
 * Muat pemanggil dari baris `directus_users`. Admin Directus menjadi provinsi tanpa
 * query; baris yang tidak terbaca berarti belum masuk (401); peran kosong/asing
 * berarti tanpa akses (403). Tidak pernah memakai default dan tidak pernah membaca
 * peran dari sesi.
 */
async function muatPemanggil(database, accountability) {
  if (!accountability?.user) {
    throw new CakupanError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  if (accountability.admin === true) {
    return { id: accountability.user, admin: true, peran: "provinsi", kotaId: null, usahaId: null };
  }
  const result = await database.raw(
    `SELECT id, app_role, usaha, kota_scope FROM directus_users WHERE id = ?`,
    [accountability.user],
  );
  const row = (result?.rows ?? result ?? [])[0];
  if (!row) {
    throw new CakupanError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  const peran = row.app_role ?? null;
  if (!ALL_ROLES.includes(peran)) {
    throw new CakupanError(403, "FORBIDDEN", "Dashboard access is not permitted");
  }
  return {
    id: row.id,
    admin: false,
    peran,
    kotaId: row.kota_scope ?? null,
    usahaId: row.usaha ?? null,
  };
}

/** Menolak pemanggil yang perannya di luar daftar route. Dipanggil adapter. */
function wajibPeran(pemanggil, daftar) {
  if (pemanggil?.admin) return;
  if (Array.isArray(daftar) && daftar.includes(pemanggil?.peran)) return;
  throw new CakupanError(403, "FORBIDDEN", "Dashboard access is not permitted");
}

const ALIAS_OK = /^[A-Za-z_][A-Za-z0-9_]*$/;
const JENIS_OK = new Set(["peserta", "tiket", "usaha", "readModel"]);
const ALIAS_BAWAAN = { peserta: "p", tiket: "t", usaha: "u", readModel: "a" };

/**
 * Kondisi SQL daftar yang boleh dilihat pemanggil.
 * - `peserta`: alias `program_peserta`; `tiket`: alias `konsultasi_tiket`;
 *   `usaha`: alias usaha (`<alias>.id`); `readModel`: alias read model analitik
 *   (`<alias>.kota_id` milik read model yang sedang dibaca).
 * - Kondisi bawaan adalah FALSE; kabkota tanpa penugasan → 403 KOTA_NOT_ASSIGNED.
 */
function predikat(pemanggil, jenis, alias) {
  if (!JENIS_OK.has(jenis)) return { sql: "FALSE", bindings: [] };
  const a = alias || ALIAS_BAWAAN[jenis];
  if (!ALIAS_OK.test(a)) throw new Error(`predikat: alias tidak valid: ${a}`);
  if (pemanggil?.admin || pemanggil?.peran === "provinsi") return { sql: "TRUE", bindings: [] };
  if (pemanggil?.peran === "kabkota") {
    if (pemanggil.kotaId == null) {
      throw new CakupanError(403, "KOTA_NOT_ASSIGNED", "Petugas kab/kota belum memiliki penugasan kota.");
    }
    if (jenis === "readModel") return { sql: `${a}.kota_id = ?`, bindings: [pemanggil.kotaId] };
    if (jenis === "usaha") {
      return {
        sql: `EXISTS (SELECT 1 FROM usaha_tabular ut WHERE ut.id = ${a}.id AND ut.kota_id = ?)`,
        bindings: [pemanggil.kotaId],
      };
    }
    return {
      sql: `EXISTS (SELECT 1 FROM usaha_tabular ut WHERE ut.id = ${a}.usaha AND ut.kota_id = ?)`,
      bindings: [pemanggil.kotaId],
    };
  }
  if (pemanggil?.peran === "pendamping") {
    if (jenis === "peserta") return { sql: `${a}.pendamping = ?`, bindings: [pemanggil.id] };
    if (jenis === "tiket") return { sql: `(${a}.pendamping = ? OR ${a}.pendamping IS NULL)`, bindings: [pemanggil.id] };
    return { sql: "FALSE", bindings: [] };
  }
  if (pemanggil?.peran === "umkm") {
    if (pemanggil.usahaId == null) return { sql: "FALSE", bindings: [] };
    if (jenis === "peserta" || jenis === "tiket") return { sql: `${a}.usaha = ?`, bindings: [pemanggil.usahaId] };
    if (jenis === "usaha") return { sql: `${a}.id = ?`, bindings: [pemanggil.usahaId] };
    return { sql: "FALSE", bindings: [] };
  }
  return { sql: "FALSE", bindings: [] };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const diLuarCakupan = () => new CakupanError(404, "NOT_FOUND", "Data tidak ditemukan atau di luar wilayah Anda.");

/**
 * Memastikan satu usaha boleh dilihat pemanggil. Hilang, belum terproyeksi, kota
 * null, atau kota lain semuanya dijawab 404 yang sama (K1).
 */
async function pastikanUsaha(database, pemanggil, usahaId) {
  if (!UUID_PATTERN.test(String(usahaId ?? ""))) throw diLuarCakupan();
  if (pemanggil?.peran === "kabkota" && !pemanggil?.admin && pemanggil.kotaId == null) {
    throw new CakupanError(403, "KOTA_NOT_ASSIGNED", "Petugas kab/kota belum memiliki penugasan kota.");
  }
  const baris = (hasil) => (hasil?.rows ?? hasil ?? [])[0];
  if (pemanggil?.admin || pemanggil?.peran === "provinsi") {
    const ada = baris(await database.raw(`SELECT id FROM usaha WHERE id = ?`, [usahaId]));
    if (!ada) throw diLuarCakupan();
    const tabular = baris(await database.raw(`SELECT kota_id FROM usaha_tabular WHERE id = ?`, [usahaId]));
    return { id: usahaId, kotaId: tabular?.kota_id ?? null };
  }
  if (pemanggil?.peran === "kabkota") {
    const tabular = baris(await database.raw(`SELECT kota_id FROM usaha_tabular WHERE id = ?`, [usahaId]));
    if (!tabular || tabular.kota_id == null || Number(tabular.kota_id) !== Number(pemanggil.kotaId)) {
      throw diLuarCakupan();
    }
    return { id: usahaId, kotaId: tabular.kota_id };
  }
  if (pemanggil?.peran === "umkm") {
    if (String(usahaId) !== String(pemanggil.usahaId)) throw diLuarCakupan();
    const ada = baris(await database.raw(`SELECT id FROM usaha WHERE id = ?`, [usahaId]));
    if (!ada) throw diLuarCakupan();
    return { id: usahaId, kotaId: null };
  }
  throw diLuarCakupan();
}

// Kapabilitas untuk `/operasional/me` dan web (K4: migrasi web menyusul; daftar ini
// memetakan gate yang ada — talent BA hanya provinsi, kurasi hanya provinsi,
// klinik untuk provinsi/kabkota/pendamping, kirim untuk umkm, review untuk
// provinsi/pendamping). Passport kabkota read-only (K8) belum diiklankan sampai
// service passport menerapkannya.
const KAPABILITAS = {
  provinsi: [
    "analitik.baca",
    "talent.kelola",
    "talent.ba",
    "katalog.kurasi",
    "klinik.petugas",
    "kpi.review",
    "usaha.baca",
    "usaha.tulis",
    "usaha.verifikasi",
  ],
  kabkota: ["analitik.baca", "talent.kelola", "klinik.petugas", "usaha.baca", "usaha.tulis", "usaha.verifikasi"],
  pendamping: ["klinik.petugas", "kpi.review"],
  umkm: ["kpi.kirim"],
};

function kapabilitas(pemanggil) {
  if (pemanggil?.admin) return [...KAPABILITAS.provinsi];
  return [...(KAPABILITAS[pemanggil?.peran] ?? [])];
}

/** Kunci partisi snapshot scope saat submit ekspor (B36). */
function permissionScopeOf(pemanggil) {
  if (pemanggil?.admin === true) return "admin";
  if (pemanggil?.peran === "kabkota" && pemanggil?.kotaId != null) return `kabkota:${pemanggil.kotaId}`;
  return "provinsi";
}

/** Ringkasan error yang aman untuk log (hanya kode + status, tanpa pesan/stack). */
function sanitizeError(error) {
  if (!error || typeof error !== "object") return { code: "INTERNAL_SERVER_ERROR" };
  return { code: error.code || "INTERNAL_SERVER_ERROR", status: error.statusCode || 500 };
}

function tandaCakupan(handler) {
  return handler?.[CAKUPAN_TANDA] ?? null;
}

/**
 * Adapter route terjaga: gerbang UUID, lalu muatPemanggil, lalu wajibPeran.
 * Handler berbentuk `(ctx) => async (req, res, pemanggil)`.
 */
function terjaga({ peran = ALL_ROLES } = {}, handler) {
  if (typeof handler !== "function") throw new Error("terjaga membutuhkan handler (ctx) => (req, res, pemanggil)");
  const daftar = [...peran];
  const bungkus = (ctx) => {
    const jalan = async (req, res, next) => {
      if (!routeGuard(req, next)) return;
      try {
        const pemanggil = await muatPemanggil(ctx.database, req.accountability);
        wajibPeran(pemanggil, daftar);
        await handler(ctx)(req, res, pemanggil);
      } catch (error) {
        if (typeof next === "function") next(error);
        else throw error;
      }
    };
    jalan[CAKUPAN_TANDA] = { jenis: "terjaga", peran: [...daftar] };
    return jalan;
  };
  bungkus[CAKUPAN_TANDA] = { jenis: "terjaga", peran: daftar };
  return bungkus;
}

/** Adapter route publik (tanpa sesi): captcha/rahasia tetap di handler. */
function publik(handler) {
  if (typeof handler !== "function") throw new Error("publik membutuhkan handler (ctx) => (req, res)");
  const bungkus = (ctx) => {
    const jalan = async (req, res, next) => {
      await handler(ctx)(req, res, next);
    };
    jalan[CAKUPAN_TANDA] = { jenis: "publik", peran: [] };
    return jalan;
  };
  bungkus[CAKUPAN_TANDA] = { jenis: "publik", peran: [] };
  return bungkus;
}

module.exports = {
  APPLICATION_ROLE_ID,
  ANALYTICS_POLICY_ID,
  ALL_ROLES,
  DATA_ROLES,
  CAKUPAN_TANDA,
  CakupanError,
  routeGuard,
  muatPemanggil,
  wajibPeran,
  predikat,
  pastikanUsaha,
  kapabilitas,
  permissionScopeOf,
  sanitizeError,
  tandaCakupan,
  terjaga,
  publik,
};

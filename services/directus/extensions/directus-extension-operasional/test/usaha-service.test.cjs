"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertUsahaAccess,
  getUsahaLapangan,
  updateUsahaLapangan,
  verifikasiUsaha,
} = require("../src/usaha-service.js");

const ID = "11111111-1111-4111-8111-000000000001";
const KABKOTA = { userId: "u-kab", role: "kabkota", kotaId: 1 };
const PROVINSI = { userId: "u-prov", role: "provinsi", kotaId: null };

function usahaRow(kotaId = 1) {
  return {
    id: ID,
    nama: "Usaha 01",
    nib: "1234567890123",
    skala: "micro",
    omzet_tahunan: "100000000",
    total_aset: null,
    kota_id: kotaId,
    kota_nama: "Kabupaten Bogor",
    kecamatan_nama: "Cibinong",
    kelurahan_nama: "Pakansari",
    pemilik_nama: "Pemilik 01",
  };
}

function dbWith({ usaha = usahaRow(), detail = null, atribut = null, klasifikasi = null, verifier = null } = {}) {
  const queries = [];
  const raw = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes("FROM usaha u") && sql.includes("pelaku_usaha pu")) {
      return { rows: usaha ? [usaha] : [] };
    }
    if (sql.includes("klasifikasi_usaha kk")) {
      return { rows: detail ? [detail] : [] };
    }
    if (sql.includes("FROM klasifikasi_usaha WHERE kode")) {
      return { rows: klasifikasi ? [klasifikasi] : [] };
    }
    if (sql.includes("FROM usaha_atribut_jabar WHERE usaha")) {
      if (sql.startsWith("SELECT usaha FROM") || sql.includes("SELECT usaha FROM")) {
        return { rows: atribut ? [{ usaha: ID }] : [] };
      }
      return { rows: atribut ? [atribut] : [] };
    }
    if (sql.includes("FROM directus_users WHERE id")) {
      return { rows: verifier ? [verifier] : [] };
    }
    return { rows: [] };
  };
  return {
    queries,
    raw,
    transaction: async (fn) => fn({ raw }),
  };
}

test("UUID invalid → 404", async () => {
  const db = dbWith();
  await assert.rejects(() => assertUsahaAccess(db, "bukan-uuid", PROVINSI), (e) => e.statusCode === 404);
});

test("kabkota akses usaha kota lain → 404", async () => {
  const db = dbWith({ usaha: usahaRow(99) });
  await assert.rejects(() => assertUsahaAccess(db, ID, KABKOTA), (e) => e.statusCode === 404);
});

test("kabkota akses usaha kotanya → lolos", async () => {
  const db = dbWith();
  const out = await assertUsahaAccess(db, ID, KABKOTA);
  assert.equal(out.nama, "Usaha 01");
  assert.equal(out.kotaId, 1);
});

test("PATCH nib pendek → 400 fields.nib", async () => {
  const db = dbWith();
  await assert.rejects(() => updateUsahaLapangan(db, ID, { sidt: { nib: "123" } }, KABKOTA), (e) => {
    assert.equal(e.statusCode, 400);
    assert.ok(e.extensions.fields.nib);
    return true;
  });
});

test("kodeKbli tidak ada → 400 fields.kodeKbli", async () => {
  const db = dbWith({ klasifikasi: null });
  await assert.rejects(
    () => updateUsahaLapangan(db, ID, { sidt: { kodeKbli: "99999" } }, PROVINSI),
    (e) => e.statusCode === 400 && Boolean(e.extensions.fields.kodeKbli),
  );
});

test("koordinat di luar Jabar → 400", async () => {
  const db = dbWith();
  await assert.rejects(
    () => updateUsahaLapangan(db, ID, { sidt: { latitude: 0, longitude: 0 } }, PROVINSI),
    (e) => e.statusCode === 400 && Boolean(e.extensions.fields.latitude),
  );
});

test("hanya satu dari lat/lng → 400", async () => {
  const db = dbWith();
  await assert.rejects(
    () => updateUsahaLapangan(db, ID, { sidt: { latitude: -6.6 } }, PROVINSI),
    (e) => e.statusCode === 400,
  );
});

test("atribut berubah → SQL memuat terverifikasi_oleh = NULL", async () => {
  const db = dbWith({ detail: { ...usahaRow(), kode_kbli: null } });
  await updateUsahaLapangan(db, ID, { atribut: { qris: true } }, KABKOTA);
  const upsert = db.queries.find((q) => q.sql.includes("usaha_atribut_jabar") && q.sql.includes("INSERT"));
  assert.ok(upsert, "upsert atribut tercatat");
  assert.match(upsert.sql, /terverifikasi_oleh = NULL/);
});

test("verifikasi tanpa baris atribut → 409", async () => {
  const db = dbWith({ atribut: null });
  await assert.rejects(() => verifikasiUsaha(db, ID, KABKOTA), (e) => e.statusCode === 409);
});

test("unique violation nib → 409 NIB_CONFLICT", async () => {
  const queries = [];
  const raw = async (sql) => {
    queries.push(sql);
    if (sql.includes("FROM usaha u")) return { rows: [usahaRow()] };
    if (sql.includes("UPDATE usaha SET")) {
      const error = new Error("duplicate");
      error.code = "23505";
      throw error;
    }
    return { rows: [] };
  };
  const db = { raw, transaction: async (fn) => fn({ raw }) };
  await assert.rejects(() => updateUsahaLapangan(db, ID, { sidt: { nib: "9999999999999" } }, PROVINSI), (e) => {
    assert.equal(e.statusCode, 409);
    assert.equal(e.code, "NIB_CONFLICT");
    return true;
  });
});

test("getUsahaLapangan merangkai sidt/wilayah/atribut/verifikasi", async () => {
  const db = dbWith({
    detail: { ...usahaRow(), kegiatan_utama: "Produksi", produk_utama: "Keripik", kode_kbli: "10794", latitude: "-6.6", longitude: "106.8", status: "active", alamat_jalan: "Jl. Raya" },
    atribut: {
      usaha: ID,
      npwp_usaha: true,
      qris: null,
      terverifikasi_oleh: "v-1",
      terverifikasi_pada: "2026-09-20T03:00:00.000Z",
      date_updated: "2026-09-21T00:00:00.000Z",
    },
    verifier: { id: "v-1", first_name: "Admin", last_name: "Subang", email: "a@example.invalid" },
  });
  const out = await getUsahaLapangan(db, ID, KABKOTA);
  assert.equal(out.data.sidt.nama, "Usaha 01");
  assert.equal(out.data.atribut.npwpUsaha, true);
  assert.equal(out.data.atribut.qris, null);
  assert.equal(out.data.verifikasi.terverifikasiOleh.nama, "Admin Subang");
});

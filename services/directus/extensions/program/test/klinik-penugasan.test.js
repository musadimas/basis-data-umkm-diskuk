import assert from "node:assert/strict";
import test from "node:test";
import { assertTransisi, assertVersi, cakupanPetugas } from "../src/endpoints/klinik/penugasan.js";
import { bolehUbah, transisiSah } from "../src/endpoints/klinik/rules.js";

const ID = "5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11";
const PENDAMPING = "9be1f0c6-3f4a-4a5b-8f3d-6f2c8b1d4e77";
const VERSI = "2026-09-27T10:31:12.123456Z";

const tiketRow = (overrides = {}) => ({
  id: ID,
  status: "masuk",
  pendamping: null,
  pemohon: null,
  waConsent: true,
  whatsapp: "6281234567890",
  sumberIdentitas: "manual",
  kotaId: null,
  aktorNama: "Analis Provinsi",
  versi: VERSI,
  ...overrides,
});

test("the five stages only move forward, and batal can return to the calendar", () => {
  assert.equal(transisiSah("masuk", "dijadwalkan"), true);
  assert.equal(transisiSah("dijadwalkan", "berjalan"), true);
  assert.equal(transisiSah("tindak_lanjut", "selesai"), true);
  assert.equal(transisiSah("masuk", "masuk"), true);
  assert.equal(transisiSah("masuk", "selesai"), false);
  assert.equal(transisiSah("masuk", "berjalan"), false);
  assert.equal(transisiSah("selesai", "tindak_lanjut"), false);
  assert.equal(transisiSah("batal", "dijadwalkan"), true);
  assert.equal(transisiSah("batal", "berjalan"), false);
});

test("a status jump is refused with 409 and no state change", () => {
  assert.doesNotThrow(() => assertTransisi({ status: "dijadwalkan" }, "masuk"));
  assert.doesNotThrow(() => assertTransisi({ catatan: "x" }, "masuk"));
  const error = (() => {
    try {
      assertTransisi({ status: "selesai" }, "masuk");
    } catch (caught) {
      return caught;
    }
    return null;
  })();
  assert.equal(error?.statusCode, 409);
  assert.equal(error?.code, "TRANSISI_TIDAK_VALID");
});

test("a missing, malformed or stale version is refused (B24)", () => {
  const hilang = (() => {
    try {
      assertVersi(undefined, VERSI);
    } catch (caught) {
      return caught;
    }
    return null;
  })();
  assert.equal(hilang?.statusCode, 400);
  assert.equal(hilang?.code, "INVALID_PAYLOAD");
  assert.doesNotThrow(() => assertVersi(VERSI, VERSI));
  const basi = (() => {
    try {
      assertVersi("2026-09-27T10:31:11.000000Z", VERSI);
    } catch (caught) {
      return caught;
    }
    return null;
  })();
  assert.equal(basi?.statusCode, 409);
  assert.equal(basi?.code, "TIKET_BERUBAH");
  const rusak = (() => {
    try {
      assertVersi("kemarin", VERSI);
    } catch (caught) {
      return caught;
    }
    return null;
  })();
  assert.equal(rusak?.statusCode, 400);
});

test("the kanban scope narrows per role: provinsi all, kab/kota by kota, pendamping by assignment", () => {
  assert.deepEqual(cakupanPetugas({ admin: true, peran: "provinsi" }), { sql: "TRUE", bindings: [] });
  assert.deepEqual(cakupanPetugas({ admin: false, peran: "provinsi" }), { sql: "TRUE", bindings: [] });

  const pendampingScope = cakupanPetugas({ admin: false, peran: "pendamping", id: PENDAMPING });
  assert.match(pendampingScope.sql, /t\.pendamping = \?/);
  assert.match(pendampingScope.sql, /t\.pendamping IS NULL/);
  assert.deepEqual(pendampingScope.bindings, [PENDAMPING]);

  const kabkotaScope = cakupanPetugas({ admin: false, peran: "kabkota", kotaId: 3201 });
  assert.match(kabkotaScope.sql, /usaha_tabular ut WHERE ut\.id = t\.usaha AND ut\.kota_id = \?/);
  assert.deepEqual(kabkotaScope.bindings, [3201]);

  assert.throws(() => cakupanPetugas({ admin: false, peran: "kabkota", kotaId: null }), (error) => error.code === "KOTA_NOT_ASSIGNED");
  assert.deepEqual(cakupanPetugas({ admin: false, peran: "umkm", id: "user-umkm" }), { sql: "FALSE", bindings: [] });
});

test("cross-officer writes are refused; the unassigned pool can only be claimed", () => {
  const provinsi = { id: "user-provinsi", admin: false, peran: "provinsi" };
  const lain = tiketRow({ pendamping: "user-lain" });
  assert.equal(bolehUbah(provinsi, lain, { status: "dijadwalkan" }), true);

  const pend = { id: PENDAMPING, admin: false, peran: "pendamping" };
  assert.equal(bolehUbah(pend, tiketRow({ pendamping: PENDAMPING }), { status: "berjalan" }), true);
  assert.equal(bolehUbah(pend, lain, { status: "berjalan" }), false);
  assert.equal(bolehUbah(pend, tiketRow({ pendamping: null }), { pendamping: PENDAMPING }), true);
  assert.equal(bolehUbah(pend, tiketRow({ pendamping: null }), { status: "dijadwalkan" }), false);

  const kab = { id: "user-kabkota", admin: false, peran: "kabkota", kotaId: 3201 };
  assert.equal(bolehUbah(kab, tiketRow({ kotaId: 3201 }), { status: "dijadwalkan" }), true);
  assert.equal(bolehUbah(kab, tiketRow({ kotaId: 3273 }), { status: "dijadwalkan" }), false);
  assert.equal(bolehUbah(kab, tiketRow({ kotaId: null }), { status: "dijadwalkan" }), false);

  assert.equal(bolehUbah({ id: "user-umkm", admin: false, peran: "umkm" }, tiketRow(), { status: "berjalan" }), false);
});

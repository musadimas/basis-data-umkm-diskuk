import assert from "node:assert/strict";
import test from "node:test";
import { AKSI_AUDIT, TRANSISI, VERSI, barisAudit, dalamCakupan, statusLabel, transisiUntuk } from "../src/endpoints/klinik/rules.js";

// Pure rules the Playwright mock imports too (Kandidat 06): no database, no ProgramError.

const PENDAMPING = "9be1f0c6-3f4a-4a5b-8f3d-6f2c8b1d4e77";
const tiket = (overrides = {}) => ({ status: "masuk", pendamping: null, kotaId: null, ...overrides });

test("barisAudit yields one row per kind of change and none for an unchanged status", () => {
  const baris = barisAudit({
    statusDari: "masuk",
    statusKe: "dijadwalkan",
    perubahan: { status: "dijadwalkan", pendamping: PENDAMPING, action_plan: "Daftar PIRT", link_meet: "https://meet.example/x" },
  });
  assert.deepEqual(baris, [
    { aksi: "transisi", statusDari: "masuk", statusKe: "dijadwalkan", perubahan: ["status"] },
    { aksi: "penugasan", statusDari: null, statusKe: null, perubahan: ["pendamping"] },
    { aksi: "catatan", statusDari: null, statusKe: null, perubahan: ["link_meet", "action_plan"] },
  ]);
  assert.deepEqual(barisAudit({ statusDari: "masuk", statusKe: "masuk", perubahan: { status: "masuk", catatan: "x" } }).map((b) => b.aksi), ["catatan"]);
  assert.deepEqual(barisAudit({ statusDari: "masuk", statusKe: undefined, perubahan: { prioritas: "tinggi" } }).map((b) => b.aksi), ["catatan"]);
  assert.deepEqual(barisAudit({ statusDari: "masuk", statusKe: "masuk", perubahan: {} }), []);
  assert.deepEqual(AKSI_AUDIT, ["transisi", "penugasan", "catatan"]);
  assert.match("2026-09-27T10:31:12.123456Z", VERSI);
});

test("dalamCakupan mirrors the SQL scope per role", () => {
  assert.equal(dalamCakupan({ admin: false, peran: "provinsi" }, tiket({ pendamping: "x" })), true);
  assert.equal(dalamCakupan({ admin: true, peran: "umkm" }, tiket()), true);

  const kab = { admin: false, peran: "kabkota", kotaId: 3201 };
  assert.equal(dalamCakupan(kab, tiket({ kotaId: 3201 })), true);
  assert.equal(dalamCakupan(kab, tiket({ kotaId: "3201" })), true);
  assert.equal(dalamCakupan(kab, tiket({ kotaId: 3273 })), false);
  assert.equal(dalamCakupan(kab, tiket({ kotaId: null })), false, "a hand-typed business is province-level triage");
  assert.equal(dalamCakupan({ admin: false, peran: "kabkota", kotaId: null }, tiket({ kotaId: null })), false);

  const pend = { id: PENDAMPING, admin: false, peran: "pendamping" };
  assert.equal(dalamCakupan(pend, tiket({ pendamping: PENDAMPING })), true);
  assert.equal(dalamCakupan(pend, tiket({ pendamping: null })), true);
  assert.equal(dalamCakupan(pend, tiket({ pendamping: "user-lain" })), false);
  assert.equal(dalamCakupan({ id: "u", admin: false, peran: "umkm" }, tiket()), false);
});

test("transisiUntuk offers only what this actor may press", () => {
  const prov = { id: "user-provinsi", admin: false, peran: "provinsi" };
  assert.deepEqual(transisiUntuk(prov, tiket({ status: "masuk" })), TRANSISI.masuk);
  assert.deepEqual(transisiUntuk(prov, tiket({ status: "selesai" })), []);
  assert.deepEqual(transisiUntuk(prov, tiket({ status: "batal" })), ["dijadwalkan"]);

  const pend = { id: PENDAMPING, admin: false, peran: "pendamping" };
  assert.deepEqual(transisiUntuk(pend, tiket({ pendamping: null })), [], "the pool can only be claimed first");
  assert.deepEqual(transisiUntuk(pend, tiket({ pendamping: PENDAMPING })), ["dijadwalkan", "batal"]);
  assert.deepEqual(transisiUntuk(pend, tiket({ pendamping: "user-lain" })), []);

  const kab = { id: "user-kabkota", admin: false, peran: "kabkota", kotaId: 3201 };
  assert.deepEqual(transisiUntuk(kab, tiket({ status: "dijadwalkan", kotaId: 3201 })), ["berjalan", "batal"]);
  assert.deepEqual(transisiUntuk(kab, tiket({ status: "dijadwalkan", kotaId: 3273 })), []);
});

test("statusLabel labels all six statuses and leaves an unknown code as it is", () => {
  assert.deepEqual(
    ["masuk", "dijadwalkan", "berjalan", "tindak_lanjut", "selesai", "batal"].map(statusLabel),
    ["Tiket Masuk", "Jadwal Ditetapkan", "Sesi Berjalan", "Tindak Lanjut", "Selesai", "Dibatalkan"],
  );
  assert.equal(statusLabel("aneh"), "aneh");
});

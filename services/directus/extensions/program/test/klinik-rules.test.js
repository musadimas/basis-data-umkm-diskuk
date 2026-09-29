import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import {
  AKSI_AUDIT, ATRIBUT_OUTCOME, HARI, SLOTS, TRANSISI, VERSI, aksiOutcomeUntuk, barisAudit, bolehVerifikasiOutcome, dalamCakupan,
  ketersediaanKonsultan, namaHari, nilaiDikenal, sidikOutcome, statusLabel, tanggalDapatDipesan, transisiUntuk,
} from "../src/endpoints/klinik/rules.js";

const require = createRequire(import.meta.url);

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

// ── R04: direktori konsultan dan outcome ──
test("tanggalDapatDipesan memakai aturan pemesanan: mulai besok, hari kerja, maksimal 30 hari", () => {
  // Rabu 2026-09-30 (Jakarta): besok Kamis 10-01; akhir pekan 10-03/04 tidak muncul.
  const now = new Date("2026-09-30T03:00:00Z");
  assert.deepEqual(tanggalDapatDipesan(now, 5), ["2026-10-01", "2026-10-02", "2026-10-05"]);
  assert.equal(tanggalDapatDipesan(now, 999).length, 22, "dipagari 30 hari");
  assert.equal(tanggalDapatDipesan(now, 0)[0], "2026-10-01", "minimal satu hari");
  // Jakarta lewat tengah malam UTC: 23:30 UTC = 06:30 WIB hari berikutnya, jadi "besok" ikut bergeser.
  assert.equal(tanggalDapatDipesan(new Date("2026-09-30T23:30:00Z"), 1)[0], "2026-10-02");
  assert.equal(namaHari("2026-10-01"), "kamis");
  assert.equal(namaHari("2026-10-03"), null, "akhir pekan tidak punya nama hari kerja");
});

test("ketersediaanKonsultan: jadwal mingguan dikurangi slot poli terpakai dan slot pendamping sibuk", () => {
  const konsultan = { poli: 1, pendamping: "p-1", hari: ["kamis", "jumat"], slot: ["09:00", "10:30"] };
  const tanggal = ["2026-10-01", "2026-10-02", "2026-10-05"]; // kamis, jumat, senin
  const terpakaiPoli = new Set(["1|2026-10-01|09:00", "2|2026-10-01|10:30"]); // poli lain tidak berpengaruh
  const terpakaiPendamping = new Set(["p-1|2026-10-02|10:30"]);
  assert.deepEqual(ketersediaanKonsultan(konsultan, tanggal, { terpakaiPoli, terpakaiPendamping }), [
    { tanggal: "2026-10-01", slot: ["10:30"] },
    { tanggal: "2026-10-02", slot: ["09:00"] },
  ]);
  // Tanpa akun pendamping, kesibukan pendamping tidak dipertimbangkan.
  assert.deepEqual(
    ketersediaanKonsultan({ ...konsultan, pendamping: null }, ["2026-10-02"], { terpakaiPoli: new Set(), terpakaiPendamping }),
    [{ tanggal: "2026-10-02", slot: ["09:00", "10:30"] }],
  );
  // Semua slot terpakai → tidak ada hari yang tampil (bukan hari dengan slot kosong).
  assert.deepEqual(
    ketersediaanKonsultan(konsultan, ["2026-10-01"], { terpakaiPoli: new Set(["1|2026-10-01|09:00", "1|2026-10-01|10:30"]), terpakaiPendamping: new Set() }),
    [],
  );
  // Slot di luar daftar pemesanan tidak pernah dilayani walau tertulis di jadwal.
  assert.deepEqual(
    ketersediaanKonsultan({ ...konsultan, slot: ["08:00", "09:00"] }, ["2026-10-01"], { terpakaiPoli: new Set(), terpakaiPendamping: new Set() }),
    [{ tanggal: "2026-10-01", slot: ["09:00"] }],
  );
  assert.deepEqual(nilaiDikenal(["senin", "minggu", 3], HARI), ["senin"]);
  assert.deepEqual(nilaiDikenal("senin", HARI), []);
  assert.deepEqual(nilaiDikenal(["10:30", "x"], SLOTS), ["10:30"]);
});

test("sidikOutcome tidak bergantung pada urutan item; membedakan atribut dan jenis", () => {
  const a = [{ atribut: "qris", jenis: "kepatuhan" }, { atribut: "npwp_usaha", jenis: "perbaikan" }];
  assert.equal(sidikOutcome(a), sidikOutcome([...a].reverse()));
  assert.notEqual(sidikOutcome(a), sidikOutcome([{ atribut: "qris", jenis: "perbaikan" }, a[1]]));
  assert.notEqual(sidikOutcome(a), sidikOutcome([a[0]]));
});

test("aksi outcome: verifikasi menuntut aktor berbeda dari pengaju; koreksi/cabut hanya verifikator wilayah", () => {
  const prov = { id: "prov-1", admin: false, peran: "provinsi" };
  const kab = { id: "kab-1", admin: false, peran: "kabkota", kotaId: 7 };
  const pend = { id: "pend-1", admin: false, peran: "pendamping" };
  const umkm = { id: "umkm-1", admin: false, peran: "umkm" };
  const diajukan = { status: "diajukan", diajukanOleh: "pend-1" };
  assert.deepEqual(aksiOutcomeUntuk(prov, diajukan, 7), ["verifikasi", "koreksi", "cabut"]);
  assert.deepEqual(aksiOutcomeUntuk({ ...prov, id: "pend-1" }, diajukan, 7), ["koreksi", "cabut"], "pengaju tidak memverifikasi sendiri");
  assert.deepEqual(aksiOutcomeUntuk(kab, diajukan, 7), ["verifikasi", "koreksi", "cabut"]);
  assert.deepEqual(aksiOutcomeUntuk(kab, diajukan, 8), [], "kota lain");
  assert.deepEqual(aksiOutcomeUntuk({ ...kab, kotaId: null }, diajukan, 7), [], "kab/kota tanpa penugasan");
  assert.deepEqual(aksiOutcomeUntuk(kab, diajukan, null), [], "usaha tanpa kota");
  assert.deepEqual(aksiOutcomeUntuk(pend, diajukan, 7), []);
  assert.deepEqual(aksiOutcomeUntuk(umkm, diajukan, 7), []);
  assert.deepEqual(aksiOutcomeUntuk(prov, { status: "terverifikasi", diajukanOleh: "pend-1" }, 7), ["koreksi", "cabut"]);
  assert.deepEqual(aksiOutcomeUntuk(prov, { status: "dicabut", diajukanOleh: "pend-1" }, 7), []);
  assert.equal(bolehVerifikasiOutcome({ admin: true, peran: "umkm" }, null), true);
});

test("15 atribut outcome sama dengan kolom usaha_atribut_jabar dan daftar CHECK di migrasi", async () => {
  const { ATRIBUT_CAMEL } = require("../../directus-extension-operasional/src/usaha-service.js");
  const kolom = Object.values(ATRIBUT_CAMEL).sort();
  assert.deepEqual(Object.keys(ATRIBUT_OUTCOME).sort(), kolom);
  const { readFileSync } = await import("node:fs");
  const migrasi = readFileSync(new URL("../../../migrations/20260929C-klinik-konsultan-csat-outcome.js", import.meta.url), "utf8");
  const daftar = migrasi.match(/const ATRIBUT = \[([\s\S]*?)\];/)[1].match(/"([a-z_]+)"/g).map((item) => item.replaceAll('"', ""));
  assert.deepEqual([...daftar].sort(), kolom);
});

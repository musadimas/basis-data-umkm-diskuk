"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  tanggalJakarta,
  mingguKe,
  targetMingguan,
  isJumatJakarta,
  klasifikasiKirim,
} = require("../src/program-week.js");

test("vektor minggu identik web/backend: mulai 2026-09-28", () => {
  assert.equal(mingguKe("2026-09-28", new Date("2026-09-27T16:59:59Z")), 0);
  assert.equal(mingguKe("2026-09-28", new Date("2026-09-27T17:00:00Z")), 1);
  assert.equal(mingguKe("2026-09-28", new Date("2026-10-04T16:59:59Z")), 1);
  assert.equal(mingguKe("2026-09-28", new Date("2026-10-04T17:30:00Z")), 2);
  assert.equal(tanggalJakarta(new Date("2026-09-27T17:00:00Z")), "2026-09-28");
});

test("targetMingguan: override, null, dan rumus", () => {
  assert.equal(targetMingguan(780000000, 1.2, null), 18000000);
  assert.equal(targetMingguan(420000000, 1.2, null), 9692308);
  assert.equal(targetMingguan(null, 1.2, null), null);
  assert.equal(targetMingguan(360000000, 1.2, 5000000), 5000000);
});

test("Jumat WIB: Jumat 2026-10-02 vs Kamis", () => {
  // 2026-10-02 adalah Jumat; 12:00 WIB = 05:00Z.
  assert.equal(isJumatJakarta(new Date("2026-10-02T05:00:00Z")), true);
  assert.equal(isJumatJakarta(new Date("2026-10-01T05:00:00Z")), false);
  // Batas tengah malam: Kamis 23:59 WIB bukan Jumat; Jumat 00:00 WIB adalah Jumat.
  assert.equal(isJumatJakarta(new Date("2026-10-01T16:59:59Z")), false);
  assert.equal(isJumatJakarta(new Date("2026-10-01T17:00:00Z")), true);
});

test("klasifikasiKirim: online Jumat, replay Sabtu, tolak Kamis", () => {
  const jumat = new Date("2026-10-02T05:00:00Z");
  const sabtu = new Date("2026-10-03T05:00:00Z");
  const kamis = new Date("2026-10-01T05:00:00Z");
  const online = klasifikasiKirim({ serverNow: jumat, clientCreatedAt: jumat });
  assert.equal(online.allowed, true);
  assert.equal(online.provenance, "online");
  const replay = klasifikasiKirim({ serverNow: sabtu, clientCreatedAt: jumat });
  assert.equal(replay.allowed, true);
  assert.equal(replay.provenance, "offline-replay");
  const tolak = klasifikasiKirim({ serverNow: kamis, clientCreatedAt: kamis });
  assert.equal(tolak.allowed, false);
  assert.equal(tolak.reason, "BUKAN_JUMAT");
});

test("klasifikasiKirim: masa depan dan kedaluwarsa ditolak", () => {
  const jumat = new Date("2026-10-02T05:00:00Z");
  const masaDepan = new Date("2026-10-02T06:00:00Z");
  const r1 = klasifikasiKirim({ serverNow: jumat, clientCreatedAt: masaDepan });
  assert.equal(r1.allowed, false);
  assert.equal(r1.reason, "WAKTU_MASA_DEPAN");
  const lama = new Date("2026-09-18T05:00:00Z"); // Jumat 2 minggu lalu
  const r2 = klasifikasiKirim({ serverNow: new Date("2026-10-03T05:00:00Z"), clientCreatedAt: lama });
  assert.equal(r2.allowed, false);
  assert.equal(r2.reason, "REPLAY_KEDALUWARSA");
});

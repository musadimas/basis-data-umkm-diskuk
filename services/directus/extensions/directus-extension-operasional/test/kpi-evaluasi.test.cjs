"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { capaianPersen, layakRekomendasi } = require("../src/kpi-evaluasi.js");

test("capaianPersen: target nol/null → null; 21jt/18jt → 116.7", () => {
  assert.equal(capaianPersen(21000000, 18000000), 116.7);
  assert.equal(capaianPersen(9000000, 18000000), 50);
  assert.equal(capaianPersen(5000, 0), null);
  assert.equal(capaianPersen(5000, null), null);
  assert.equal(capaianPersen(0, 0), null);
});

test("layakRekomendasi: butuh 4 berurutan ≥ target", () => {
  const empat = [2, 3, 4, 5].map((m) => ({ mingguKe: m, omzet: 19000000, target: 18000000, status: "disetujui" }));
  assert.equal(layakRekomendasi(empat), true);
  const tiga = [2, 3, 4].map((m) => ({ mingguKe: m, omzet: 19000000, target: 18000000, status: "disetujui" }));
  assert.equal(layakRekomendasi(tiga), false);
});

test("layakRekomendasi: Wawan minggu 1 di bawah target → run 2–4 = 3 → false; plus minggu 5 → true", () => {
  const sampai4 = [
    { mingguKe: 1, omzet: 16500000, target: 18000000, status: "disetujui" },
    { mingguKe: 2, omzet: 18200000, target: 18000000, status: "disetujui" },
    { mingguKe: 3, omzet: 19000000, target: 18000000, status: "disetujui" },
    { mingguKe: 4, omzet: 20100000, target: 18000000, status: "disetujui" },
  ];
  assert.equal(layakRekomendasi(sampai4), false);
  assert.equal(
    layakRekomendasi([...sampai4, { mingguKe: 5, omzet: 21000000, target: 18000000, status: "disetujui" }]),
    true,
  );
});

test("layakRekomendasi: celah minggu, ditolak, dan target null memutus run", () => {
  assert.equal(
    layakRekomendasi(
      [2, 3, 5, 6].map((m) => ({ mingguKe: m, omzet: 19000000, target: 18000000, status: "disetujui" })),
    ),
    false,
  );
  assert.equal(
    layakRekomendasi([
      { mingguKe: 1, omzet: 19000000, target: 18000000, status: "disetujui" },
      { mingguKe: 2, omzet: 19000000, target: 18000000, status: "ditolak" },
      { mingguKe: 3, omzet: 19000000, target: 18000000, status: "disetujui" },
      { mingguKe: 4, omzet: 19000000, target: 18000000, status: "disetujui" },
      { mingguKe: 5, omzet: 19000000, target: 18000000, status: "disetujui" },
      { mingguKe: 6, omzet: 19000000, target: 18000000, status: "disetujui" },
    ]),
    true,
  );
  assert.equal(
    layakRekomendasi([
      { mingguKe: 1, omzet: 19000000, target: 18000000, status: "disetujui" },
      { mingguKe: 2, omzet: 19000000, target: null, status: "disetujui" },
      { mingguKe: 3, omzet: 19000000, target: 18000000, status: "disetujui" },
      { mingguKe: 4, omzet: 19000000, target: 18000000, status: "disetujui" },
      { mingguKe: 5, omzet: 19000000, target: 18000000, status: "disetujui" },
    ]),
    false,
  );
});

test("layakRekomendasi: target nol memutus run (aturan target nol)", () => {
  assert.equal(
    layakRekomendasi(
      [1, 2, 3, 4].map((m) => ({ mingguKe: m, omzet: 5000, target: 0, status: "disetujui" })),
    ),
    false,
  );
});

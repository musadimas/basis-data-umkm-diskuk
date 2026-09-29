import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import registerKpi from "../src/endpoints/kpi/index.js";
import { canReview, canSubmit } from "../src/endpoints/kpi/service.js";
import { capaian, currentWeek, jakartaDate, longestTargetStreak, pitchingEligible } from "../src/endpoints/kpi/rules.js";
import { mountEndpoint } from "./helpers.js";

const require = createRequire(import.meta.url);
const cakupan = require("../../../analytics-shared/cakupan.cjs");
const { predikat, APPLICATION_ROLE_ID: ROLE } = cakupan;

const ID = "5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11";
const report = (mingguKe, realisasiOmzet, status = "disetujui", target = 100) => ({ mingguKe, realisasiOmzet, target, status });

// Baris akun muatPemanggil; peran selalu dari sini, bukan dari sesi.
const USERS = {
  prov: { id: "prov", app_role: "provinsi", usaha: null, kota_scope: null },
  umkm1: { id: "umkm1", app_role: "umkm", usaha: ID, kota_scope: null },
};
const withUsers = (jawab = async () => ({ rows: [] })) => async (sql, bindings) =>
  sql.includes("FROM directus_users") ? { rows: USERS[bindings[0]] ? [USERS[bindings[0]]] : [USERS.prov] } : jawab(sql, bindings);

test("programme weeks start on tanggal_mulai in Jakarta time and cap at jumlah_minggu", () => {
  // 17:30 UTC on 1 Sep is already 2 Sep in Jakarta.
  assert.equal(jakartaDate(new Date("2026-09-01T17:30:00Z")), "2026-09-02");
  assert.equal(currentWeek("2026-09-02", 12, new Date("2026-09-01T16:00:00Z")), 0);
  assert.equal(currentWeek("2026-09-02", 12, new Date("2026-09-01T17:30:00Z")), 1);
  assert.equal(currentWeek("2026-09-02", 12, new Date("2026-09-09T00:00:00Z")), 2);
  assert.equal(currentWeek("2026-01-01", 12, new Date("2026-09-09T00:00:00Z")), 12);
  assert.equal(currentWeek("garbage", 12), 0);
});

test("the pitching streak counts only approved weeks at or above target, consecutively", () => {
  assert.equal(longestTargetStreak([report(1, 100), report(2, 150), report(3, 99), report(4, 100)]), 2);
  assert.equal(longestTargetStreak([report(1, 100), report(2, 100, "menunggu"), report(3, 100), report(4, 100)]), 2);
  assert.equal(longestTargetStreak([report(5, 100), report(3, 100), report(4, 100), report(6, 100)]), 4);
  assert.equal(pitchingEligible([report(1, 100), report(2, 100), report(3, 100)]), false);
  assert.equal(pitchingEligible([report(7, 100), report(8, 100), report(9, 100), report(10, 100)]), true);
});

test("achievement is a percentage with one decimal", () => {
  assert.equal(capaian(1_120_000, 1_000_000), 112);
  assert.equal(capaian(1, 3), 33.3);
  assert.equal(capaian(1, 0), null);
});

test("participant scope follows pemanggil; admins see everything (01)", () => {
  assert.equal(predikat({ admin: true, peran: "provinsi" }, "peserta", "p").sql, "TRUE");
  assert.equal(predikat({ admin: false, peran: "provinsi" }, "peserta", "p").sql, "TRUE");
  assert.deepEqual(predikat({ admin: false, id: "u1", peran: "pendamping" }, "peserta", "p"), { sql: "p.pendamping = ?", bindings: ["u1"] });
  assert.deepEqual(predikat({ admin: false, peran: "umkm", usahaId: "b1" }, "peserta", "p"), { sql: "p.usaha = ?", bindings: ["b1"] });
  assert.equal(predikat({ admin: false, peran: "umkm", usahaId: null }, "peserta", "p").sql, "FALSE");
  assert.equal(
    (() => {
      try {
        predikat({ admin: false, peran: "kabkota", kotaId: null }, "peserta", "p");
        return null;
      } catch (error) {
        return error?.code;
      }
    })(),
    "KOTA_NOT_ASSIGNED",
  );
  assert.deepEqual(predikat({ admin: false, peran: "kabkota", kotaId: 7 }, "peserta", "p").bindings, [7]);
});

test("only the business submits and only its pendamping or the province reviews", () => {
  const peserta = { usaha: "b1", pendamping: "p1" };
  assert.equal(canSubmit({ admin: false, peran: "umkm", usahaId: "b1" }, peserta), true);
  assert.equal(canSubmit({ admin: false, peran: "umkm", usahaId: "b2" }, peserta), false);
  assert.equal(canSubmit({ admin: false, peran: "umkm", usahaId: null }, { usaha: null }), false);
  assert.equal(canReview({ admin: false, id: "p1", peran: "pendamping" }, peserta), true);
  assert.equal(canReview({ admin: false, id: "p2", peran: "pendamping" }, peserta), false);
  assert.equal(canReview({ admin: false, id: "x", peran: "provinsi" }, peserta), true);
  assert.equal(canReview({ admin: true, id: "x" }, peserta), true);
});

test("every KPI route rejects anonymous callers before database access", async () => {
  const { call, routes, queries } = mountEndpoint(registerKpi);
  assert.equal(routes.length, 6);
  for (const { method, path } of routes) {
    const { nextError } = await call(method, path.replace(/:\w+/g, ID), { accountability: null });
    assert.equal(nextError?.statusCode, 401, `${method} ${path}`);
  }
  assert.equal(queries.length, 0);
});

test("report payloads are validated before any domain query", async () => {
  const domainQueries = [];
  const db = {
    raw: withUsers(async (sql, bindings) => {
      domainQueries.push({ sql, bindings });
      return { rows: [] };
    }),
    transaction: async (fn) => fn(db),
  };
  const { call } = mountEndpoint(registerKpi, { database: db });
  const valid = { mingguKe: 1, realisasiOmzet: 1000, jumlahTransaksi: 3, clientUuid: ID, bukti: [] };
  for (const patch of [
    { mingguKe: 0 },
    { mingguKe: 1.5 },
    { realisasiOmzet: -1 },
    { realisasiOmzet: "1000" + "0".repeat(20) },
    { jumlahTransaksi: 2.5 },
    { clientUuid: "offline-1" },
    { bukti: [ID, ID, ID, ID, ID, ID] },
    { bukti: ["x"] },
  ]) {
    const { res } = await call("POST", `/peserta/${ID}/laporan`, {
      accountability: { user: "umkm1", role: ROLE },
      body: { ...valid, ...patch },
    });
    assert.equal(res.statusCode, 400, JSON.stringify(patch));
  }
  const reject = await call("POST", `/laporan/${ID}/review`, { body: { keputusan: "ditolak" } });
  assert.equal(reject.res.body.errors[0].extensions.code, "CATATAN_WAJIB");
  const pitching = await call("PATCH", `/peserta/${ID}/pitching`, { body: { rekomendasi: "yes" } });
  assert.equal(pitching.res.statusCode, 400);
  assert.equal(domainQueries.length, 0);
});

test("semua route KPI bertanda terjaga dengan peran yang tepat (01)", async () => {
  const { routes } = mountEndpoint(registerKpi);
  assert.equal(routes.length, 6);
  const ekspektasi = [
    ["GET", "/peserta", ["kabkota", "pendamping", "provinsi", "umkm"]],
    ["GET", "/peserta/:id", ["kabkota", "pendamping", "provinsi", "umkm"]],
    ["POST", "/peserta/:id/laporan", ["umkm"]],
    ["PATCH", "/peserta/:id/pitching", ["pendamping", "provinsi"]],
    ["GET", "/laporan", ["pendamping", "provinsi"]],
    ["POST", "/laporan/:id/review", ["pendamping", "provinsi"]],
  ];
  for (const [method, path, peran] of ekspektasi) {
    const route = routes.find((r) => r.method === method && r.path === path);
    const tanda = cakupan.tandaCakupan(route.handler);
    assert.equal(tanda?.jenis, "terjaga", `${method} ${path}`);
    assert.deepEqual([...tanda.peran].sort(), peran, `${method} ${path}`);
  }
});

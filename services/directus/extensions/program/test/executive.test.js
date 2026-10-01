import assert from "node:assert/strict";
import test from "node:test";
import register from "../src/endpoints/executive/index.js";
import { aggregateProgram, completedWeeks } from "../src/endpoints/executive/rules.js";
import { jakartaDate } from "../src/endpoints/kpi/rules.js";
import { mountEndpoint } from "./helpers.js";

const NOW = new Date("2026-09-28T07:00:00Z");
const START = "2026-08-31";
const participant = (overrides = {}) => ({
  id: "11111111-1111-4111-8111-111111111111", usaha: "22222222-2222-4222-8222-222222222222",
  nama: "Usaha Uji", kota_nama: "Bandung", pendamping: "33333333-3333-4333-8333-333333333333",
  tanggal_mulai: START, jumlah_minggu: 12, target_mingguan: 1_000_000,
  omzet_tahunan: 52_000_000, latitude: -6.9, longitude: 107.6,
  laporan: [], ...overrides,
});
const report = (week, amount, status = "disetujui") => ({ minggu_ke: week, realisasi_omzet: amount, status });

test("12-week aggregate excludes rejected reports, handles zero/missing baseline and missing weeks", () => {
  assert.equal(completedWeeks(START, 12, NOW), 4);
  const result = aggregateProgram([
    participant({ laporan: [report(1, 1_200_000), report(2, 900_000), report(3, 1_500_000, "ditolak")] }),
    participant({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", omzet_tahunan: 0, laporan: [report(1, 200_000)] }),
  ], NOW);
  assert.deepEqual(result.kepatuhan, { terverifikasi: 3, diharapkan: 8, persen: 37.5, targetLebihDari: 95, belumDihitung: 0 });
  assert.deepEqual(result.kenaikanOmzet, { persen: 5, pesertaDihitung: 1, sumber: "SIDT tahunan / 52 vs rata-rata laporan disetujui" });
  assert.equal(result.tren.length, 12);
  assert.equal(result.tren[0].target, 2_000_000);
  assert.equal(result.tren[0].realisasi, 1_400_000);
  assert.equal(result.tren[2].realisasi, null);
  assert.equal(result.atRisk.length, 0);
});

test("laporan disetujui minggu berjalan tidak masuk kepatuhan tetapi dihitung terpisah (BUG-015)", () => {
  const weeks = (list) => list.map((w) => report(w, 1_000_000));
  const result = aggregateProgram([participant({ laporan: weeks([1, 2, 3, 4, 5]) })], NOW);
  assert.equal(completedWeeks(START, 12, NOW), 4);
  assert.deepEqual(result.kepatuhan, { terverifikasi: 4, diharapkan: 4, persen: 100, targetLebihDari: 95, belumDihitung: 1 });
  const pendek = aggregateProgram([participant({ jumlah_minggu: 4, laporan: weeks([1, 2, 3, 4, 5]) })], NOW);
  assert.equal(pendek.kepatuhan.belumDihitung, 0, "minggu di luar jumlah_minggu tidak dihitung");
  const kosong = aggregateProgram([participant({ laporan: [report(5, null)] })], NOW);
  assert.equal(kosong.kepatuhan.belumDihitung, 0, "realisasi tidak valid tidak dihitung");
});

test("batas minggu selesai mengikuti tanggal WIB, bukan UTC", () => {
  const laporan = [1, 2, 3, 4, 5].map((w) => report(w, 1_000_000));
  const sebelum = aggregateProgram([participant({ laporan })], new Date("2026-10-04T16:59:59Z"));
  const sesudah = aggregateProgram([participant({ laporan })], new Date("2026-10-04T17:00:00Z"));
  assert.equal(completedWeeks(START, 12, new Date("2026-10-04T16:59:59Z")), 4);
  assert.equal(completedWeeks(START, 12, new Date("2026-10-04T17:00:00Z")), 5);
  assert.deepEqual([sebelum.kepatuhan.terverifikasi, sebelum.kepatuhan.belumDihitung], [4, 1]);
  assert.deepEqual([sesudah.kepatuhan.terverifikasi, sesudah.kepatuhan.belumDihitung], [5, 0]);
});

test("risk needs the latest two completed, consecutive, approved weeks under 70% of SIDT baseline", () => {
  const low = [report(3, 690_000), report(4, 700_000)];
  assert.equal(aggregateProgram([participant({ laporan: low })], NOW).atRisk.length, 1);
  assert.equal(aggregateProgram([participant({ laporan: [report(2, 690_000), report(4, 690_000)] })], NOW).atRisk.length, 0);
  assert.equal(aggregateProgram([participant({ laporan: [report(3, 690_000, "ditolak"), report(4, 690_000)] })], NOW).atRisk.length, 0);
  assert.equal(aggregateProgram([participant({ omzet_tahunan: null, laporan: low })], NOW).atRisk.length, 0);
  const missingAmount = aggregateProgram([participant({ laporan: [report(3, null), report(4, 600_000)] })], NOW);
  assert.equal(missingAmount.kepatuhan.terverifikasi, 1);
  assert.equal(missingAmount.tren[2].realisasi, null);
  assert.equal(missingAmount.atRisk.length, 0);
});

test("unverified and anonymous investors are refused before directory query", async () => {
  const db = { raw: async () => ({ rows: [] }) };
  const app = mountEndpoint(register, { database: db });
  const anonymous = await app.call("GET", "/investor", { accountability: null });
  assert.equal(anonymous.res.statusCode, 401);
  const unverified = await app.call("GET", "/investor");
  assert.equal(unverified.res.statusCode, 403);
});

test("monitoring refuses UMKM and binds the officer's kota scope", async () => {
  const statements = [];
  let role = "umkm";
  const db = { raw: async (sql, bindings) => {
    statements.push({ sql, bindings });
    if (sql.includes("FROM directus_users WHERE id")) return { rows: [{ id: "officer", app_role: role, kota_scope: 3273, usaha: null }] };
    return { rows: [] };
  } };
  const app = mountEndpoint(register, { database: db });
  const denied = await app.call("GET", "/monitoring");
  assert.equal(denied.nextError?.status, 403);
  role = "kabkota";
  const allowed = await app.call("GET", "/monitoring");
  assert.equal(allowed.res.statusCode, 200);
  const statement = statements.find((item) => item.sql.includes("FROM program_peserta p"));
  assert.match(statement.sql, /ut\.kota_id = \?/);
  assert.deepEqual(statement.bindings, [3273]);
});

test("investor filters are SQL-bound and only approved, active, consented profiles enter the directory", async () => {
  const queries = [];
  const db = { raw: async (sql, bindings) => {
    queries.push({ sql, bindings });
    if (sql.includes("investor_verifikasi")) return { rows: [{ pengguna: "verified" }] };
    return { rows: [] };
  } };
  const app = mountEndpoint(register, { database: db });
  const found = await app.call("GET", "/investor", { query: { modal: "menengah", skema: "kur", kbli: "107" } });
  assert.equal(found.res.statusCode, 200);
  const verification = queries.find((q) => q.sql.includes("investor_verifikasi"));
  assert.match(verification.sql, /du\.app_role IS NULL AND du\.role = \? AND du\.status = 'active'/);
  assert.deepEqual(verification.bindings, ["00000000-0000-4000-8000-000000000001", "5e5d15ec-b985-4cc4-a92d-783b7b7806bb"]);
  const query = queries.find((q) => q.sql.includes("FROM investor_profil"));
  assert.match(query.sql, /disetujui_berbagi_pada IS NOT NULL/);
  assert.match(query.sql, /disetujui_kurator_pada IS NOT NULL/);
  assert.match(query.sql, /dicabut_pada IS NULL/);
  assert.deepEqual(query.bindings, [50_000_000, 500_000_000, "kur", "107%"]);
  const invalid = await app.call("GET", "/investor", { query: { kbli: "10'; DROP TABLE investor_profil" } });
  assert.equal(invalid.res.statusCode, 400);
});

test("monitoring recompute uses a unique participant/week insert and no task for unassigned risk", async () => {
  const queries = [];
  const start = jakartaDate(new Date(Date.now() - 56 * 86_400_000));
  const last = completedWeeks(start, 12);
  const db = { raw: async (sql, bindings) => {
    queries.push({ sql, bindings });
    if (sql.includes("FROM directus_users WHERE id")) return { rows: [{ id: "operator", app_role: "provinsi", kota_scope: null, usaha: null }] };
    if (sql.includes("FROM program_peserta p")) return { rows: [participant({ tanggal_mulai: start, jumlah_minggu: 12 })] };
    if (sql.includes("FROM kpi_laporan")) return { rows: [
      { peserta: participant().id, ...report(last - 1, 600_000) },
      { peserta: participant().id, ...report(last, 600_000) },
    ] };
    if (sql.includes("INSERT INTO pendamping_tugas_risiko")) return { rows: [{ id: "task" }] };
    return { rows: [] };
  } };
  const app = mountEndpoint(register, { database: db });
  // This test checks the query's idempotent contract, while math is tested at a fixed date above.
  const response = await app.call("POST", "/monitoring/recompute", { accountability: { user: "operator", role: "7d6d493c-1a6d-4c59-9e74-40d42a7862eb" } });
  assert.equal(response.res.statusCode, 200);
  assert.equal(response.res.body.data.dibuat, 1);
  for (const task of queries.filter((q) => q.sql.includes("INSERT INTO pendamping_tugas_risiko"))) {
    assert.match(task.sql, /ON CONFLICT \(peserta, minggu_akhir\) DO NOTHING/);
  }
});

test("a verified investor sees sourced deal fields, receives a PDF and persists one LOI on retry", async () => {
  const businessId = "22222222-2222-4222-8222-222222222222";
  const productId = "44444444-4444-4444-8444-444444444444";
  const key = "55555555-5555-4555-8555-555555555555";
  let saved = null;
  const audits = [];
  const db = { raw: async (sql, bindings = []) => {
    if (sql.includes("investor_verifikasi")) return { rows: [{ pengguna: "verified" }] };
    if (sql.includes("SELECT ip.usaha, ip.jenama")) return { rows: [{
      usaha: businessId, nama: "Usaha Uji", jenama: "Jenama Uji", kota_nama: "Bandung",
      kode_kbli: "10710", talent_index: 82, kebutuhan_modal: 50_000_000,
      margin_persen: 18, margin_sumber: "deklarasi", kapasitas_pasok: "1000 unit/bulan",
      skema: ["kur"], pitch_deck: null, produk_id: productId,
    }] };
    if (sql.includes("INSERT INTO investor_akses_audit")) { audits.push(bindings[2]); return { rows: [] }; }
    if (sql.includes("SELECT l.minggu_ke")) return { rows: [
      { minggu_ke: 4, realisasi_omzet: 1_300_000 }, { minggu_ke: 3, realisasi_omzet: 1_000_000 },
    ] };
    if (sql.includes("FROM directus_users WHERE id")) return { rows: [{ first_name: "Investor", last_name: "Uji", email: "investor@example.invalid" }] };
    if (sql.includes("SELECT id, produk FROM produk_loi")) return { rows: saved ? [saved] : [] };
    if (sql.includes("INSERT INTO produk_loi")) { saved = { id: "loi-1", produk: productId }; return { rows: [saved] }; }
    return { rows: [] };
  } };
  const app = mountEndpoint(register, { database: db });
  const card = await app.call("GET", `/investor/${businessId}`);
  assert.equal(card.res.statusCode, 200);
  assert.equal(card.res.body.data.pertumbuhanOmzetMingguan, 30);
  assert.equal(card.res.body.data.marginSumber, "deklarasi");
  assert.equal(card.res.body.data.talentIndexSumber, "Talent Scouting disetujui");
  const pdf = await app.call("GET", `/investor/${businessId}/pdf`);
  assert.equal(pdf.res.statusCode, 200);
  assert.equal(pdf.res.headers["Content-Type"], "application/pdf");
  assert.equal(pdf.res.body.subarray(0, 5).toString(), "%PDF-");
  const body = { pesan: "Tertarik bekerja sama", idempotencyKey: key };
  const first = await app.call("POST", `/investor/${businessId}/loi`, { body });
  const second = await app.call("POST", `/investor/${businessId}/loi`, { body });
  assert.equal(first.res.body.data.id, "loi-1");
  assert.equal(first.res.body.data.duplikat, false);
  assert.equal(second.res.body.data.duplikat, true);
  assert.deepEqual(audits, ["detail", "pdf", "loi", "loi"]);
});

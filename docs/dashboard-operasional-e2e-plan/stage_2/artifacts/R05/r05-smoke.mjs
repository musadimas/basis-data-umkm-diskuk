// R05 privacy / role / regression smoke (real HTTP against the clone Directus 127.0.0.1:8156, DB r04_clone).
// Clone only. Checks marked `known: true` document defects that this gate FOUND; they are recorded as FAIL
// (verdict is not softened) and are listed again in receipt_R05_acceptance.md.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";

const BASE = process.env.R05_BASE ?? "http://127.0.0.1:8156";
const PASSWORD = "R04-uji-Pass#2026"; // clone-only
const HERE = path.dirname(fileURLToPath(import.meta.url));
const results = [];

function sql(query) {
  const run = spawnSync("docker", ["exec", "-i", "diskuk-operasional-e2e-postgis-1", "sh", "-c", 'psql -U "$POSTGRES_USER" -d r04_clone -X -q -At -F "|" -c "$0"', query], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`SQL gagal: ${run.stderr}`);
  return run.stdout.trim();
}
const lines = (query) => (sql(query) ? sql(query).split("\n") : []);
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
function check(id, deskripsi, ok, detail = "", { known = false } = {}) {
  results.push({ id, deskripsi, ok: Boolean(ok), known, detail: String(detail).slice(0, 500) });
  console.log(`${ok ? "PASS" : known ? "FAIL(known defect)" : "FAIL"} [${id}] ${deskripsi}${detail ? ` — ${String(detail).slice(0, 240)}` : ""}`);
}
async function api(method, route, { token, json, form, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    h["content-type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) body = form;
  const res = await fetch(BASE + route, { method, headers: h, body });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed, data: parsed?.data, code: parsed?.errors?.[0]?.extensions?.code, text };
}
const login = async (email) => (await api("POST", "/auth/login", { json: { email, password: PASSWORD } })).data.access_token;

const AKUN = {
  prov: "dummy_admin@diskuk.jabarprov.go.id",
  kabSubang: "dummy_admin.subang@jabarprov.go.id",
  kabSumedang: "r04_kab.sumedang@example.com",
  pend: "dummy_coach.pendamping@jabarprov.go.id",
  umkm: "dummy_wawan.leathercraft@gmail.com",
};
const tok = {};
for (const [k, email] of Object.entries(AKUN)) tok[k] = await login(email);
const USAHA_SUBANG = "d0000000-0000-4000-8000-000000000005";
const USAHA_SUMEDANG = "d0000000-0000-4000-8000-000000000002";

// ── R05.A empat role, scoping wilayah ──────────────────────────────────────────────────────────
const me = Object.fromEntries(await Promise.all(Object.entries(tok).map(async ([k, t]) => [k, (await api("GET", "/operasional/me", { token: t })).data?.role])));
check("R05.A1", "empat role login dan dikenali server (provinsi, kabkota, pendamping, umkm)", me.prov === "provinsi" && me.kabSubang === "kabkota" && me.kabSumedang === "kabkota" && me.pend === "pendamping" && me.umkm === "umkm", JSON.stringify(me));
const lintasKota = {
  kabSubangKeSumedang: (await api("GET", `/operasional/usaha/${USAHA_SUMEDANG}`, { token: tok.kabSubang })).status,
  kabSubangKeSubang: (await api("GET", `/operasional/usaha/${USAHA_SUBANG}`, { token: tok.kabSubang })).status,
  kabSumedangKeSubang: (await api("GET", `/operasional/usaha/${USAHA_SUBANG}`, { token: tok.kabSumedang })).status,
  provKeSumedang: (await api("GET", `/operasional/usaha/${USAHA_SUMEDANG}`, { token: tok.prov })).status,
  umkm: (await api("GET", `/operasional/usaha/${USAHA_SUBANG}`, { token: tok.umkm })).status,
  pendamping: (await api("GET", `/operasional/usaha/${USAHA_SUBANG}`, { token: tok.pend })).status,
  anonim: (await api("GET", `/operasional/usaha/${USAHA_SUBANG}`)).status,
};
check("R05.A2", "IDOR usaha: kab/kota lintas kota 404, kota sendiri 200, provinsi 200, umkm/pendamping 403, anonim 401", lintasKota.kabSubangKeSumedang === 404 && lintasKota.kabSubangKeSubang === 200 && lintasKota.kabSumedangKeSubang === 404 && lintasKota.provKeSumedang === 200 && lintasKota.umkm === 403 && lintasKota.pendamping === 403 && lintasKota.anonim === 401, JSON.stringify(lintasKota));
const tab = async (token, query) => (await api("GET", `/v1/analytics/tabular?${query}`, { token })).data?.rows?.map((r) => r.id) ?? [];
const tProv = await tab(tok.prov, "q=nanas&pageSize=5");
const tSumedang = await tab(tok.kabSumedang, "q=nanas&pageSize=5");
const tSubangPaksa = await tab(tok.kabSubang, "q=nanas&pageSize=5&kota_id=2");
check("R05.A3", "pencarian Tabular (trigram): provinsi menemukan, kab/kota lain 0 baris, kab/kota Subang tetap ter-scope walau klien mengirim kota_id=2", tProv.includes(USAHA_SUBANG) && tSumedang.length === 0 && tSubangPaksa.includes(USAHA_SUBANG), `prov=${tProv.length} sumedang=${tSumedang.length} subang(kota_id=2)=${tSubangPaksa.length}`);
const pendek = await api("GET", "/v1/analytics/tabular?q=ab", { token: tok.prov });
check("R05.A4", "kueri pencarian terlalu pendek → 400 Q_TOO_SHORT (bukan 500)", pendek.status === 400, `${pendek.status} ${pendek.code}`);
const exe = Object.fromEntries(await Promise.all(Object.entries(tok).map(async ([k, t]) => [k, (await api("GET", "/v1/program/executive/monitoring", { token: t })).status])));
const exeAnon = (await api("GET", "/v1/program/executive/monitoring")).status;
check("R05.A5", "monitoring eksekutif (R02): provinsi/kab-kota 200, pendamping/umkm 403, anonim 401", exe.prov === 200 && exe.kabSubang === 200 && exe.kabSumedang === 200 && exe.pend === 403 && exe.umkm === 403 && exeAnon === 401, JSON.stringify({ ...exe, anonim: exeAnon }));
const bacaKpi = async (t) => ((await api("GET", "/v1/program/kpi/peserta", { token: t })).data ?? []).map((p) => p.id);
const kpiProv = await bacaKpi(tok.prov), kpiSubang = await bacaKpi(tok.kabSubang), kpiSumedang = await bacaKpi(tok.kabSumedang), kpiUmkm = await bacaKpi(tok.umkm);
const pesertaSubang = lines(`SELECT p.id FROM program_peserta p JOIN usaha_tabular ut ON ut.id = p.usaha WHERE ut.kota_id = 1 AND p.status = 'aktif'`);
check("R05.A6", "KPI: daftar peserta ter-scope (provinsi semua aktif, kab/kota Subang = SQL kota 1, kab/kota Sumedang kosong, umkm hanya miliknya)", kpiProv.length === Number(sql(`SELECT COUNT(*) FROM program_peserta WHERE status = 'aktif'`)) && JSON.stringify([...kpiSubang].sort()) === JSON.stringify([...pesertaSubang].sort()) && kpiSumedang.length === 0 && kpiUmkm.length === 1, JSON.stringify({ prov: kpiProv.length, subang: kpiSubang.length, sumedang: kpiSumedang.length, umkm: kpiUmkm.length }));

// ── R05.B pemindaian PII pada seluruh respons publik ───────────────────────────────────────────
// Needle ketat (semua endpoint publik): NIK, kontak tiket klinik, e-mail akun. NIB dan WA bisnis sengaja publik
// di katalog produk tayang (allowlist Y06/Y10), jadi hanya dipindai di endpoint lain.
const ketat = [
  ...lines(`SELECT nik FROM pelaku_usaha WHERE nik IS NOT NULL`),
  ...lines(`SELECT whatsapp FROM konsultasi_tiket`),
  ...lines(`SELECT email FROM konsultasi_tiket WHERE email IS NOT NULL`),
  ...lines(`SELECT email FROM directus_users`),
].filter((v) => v && v.length >= 8);
const bisnis = [...lines(`SELECT nib FROM usaha WHERE nib IS NOT NULL`), ...lines(`SELECT nomor_whatsapp FROM usaha WHERE nomor_whatsapp IS NOT NULL`)].filter((v) => v && v.length >= 8);
const publik = [
  "/v1/program/kegiatan", "/v1/program/fasilitasi", "/v1/program/klinik/poli", "/v1/program/klinik/statistik", "/v1/program/klinik/konsultan",
  "/items/produk", "/items/faq", "/items/kontak_hotline", "/items/kota", "/items/konsultasi_poli", "/v1/analytics/tabular/status",
  "/v1/program/passport/verify/ABCDEFGHJKLM", "/v1/program/registrasi/sertifikat/SK0000000000", "/server/info",
];
const teksPublik = {};
for (const rute of publik) teksPublik[rute] = (await api("GET", rute)).text;
const bocor = Object.entries(teksPublik).flatMap(([rute, teks]) => [
  ...ketat.filter((n) => teks.includes(n)),
  ...(rute === "/items/produk" ? [] : bisnis.filter((n) => teks.includes(n))),
].map((n) => `${rute}:${n.slice(0, 4)}…`));
check("R05.B1", `${publik.length} endpoint publik tanpa login: tidak memuat NIK, kontak tiket, e-mail akun (${ketat.length} nilai), atau NIB/WA bisnis di luar katalog produk (${bisnis.length} nilai)`, bocor.length === 0 && ketat.length >= 5, bocor.join(",") || "tanpa kebocoran");
check("R05.B2", "tidak ada pola 16 digit (NIK) pada respons publik", Object.values(teksPublik).every((t) => !/\b\d{16}\b/.test(t)));
const privat = ["/items/konsultasi_tiket", "/items/konsultasi_tiket_audit", "/items/konsultasi_outcome", "/items/konsultasi_tiket_csat", "/items/klinik_konsultan", "/items/notifikasi_outbox", "/items/directus_users", "/items/pelaku_usaha", "/items/kegiatan_pendaftaran", "/items/kegiatan_sertifikat", "/items/talent_passport", "/items/produk_loi"];
const bacaAnon = await Promise.all(privat.map(async (r) => [r, (await api("GET", r)).status]));
const bacaUmkm = await Promise.all(privat.map(async (r) => [r, ((await api("GET", r, { token: tok.umkm })).data ?? []).length ?? 0, (await api("GET", r, { token: tok.umkm })).status]));
check("R05.B3", "koleksi privat tidak terbaca lewat /items oleh anonim (401/403) maupun umkm (403 atau nol baris)", bacaAnon.every(([, s]) => [401, 403].includes(s)) && bacaUmkm.every(([, n, s]) => s === 403 || (s === 200 && n === 0)), JSON.stringify({ anon: bacaAnon.filter(([, s]) => ![401, 403].includes(s)), umkm: bacaUmkm.filter(([, n, s]) => !(s === 403 || (s === 200 && n === 0))) }));

// ── R05.C enumerasi NIB/NIK ────────────────────────────────────────────────────────────────────
const nibAda = lines(`SELECT u.nib FROM usaha u JOIN directus_users d ON d.usaha = u.id WHERE u.nib IS NOT NULL LIMIT 1`)[0];
const loginAneh = async (email) => api("POST", "/auth/login", { json: { email, password: "salah-salah-123" } });
const a = await loginAneh(nibAda);
const b = await loginAneh("1111111111111");
const c = await loginAneh(`tidak-ada-${randomUUID().slice(0, 8)}@example.com`);
check("R05.C1", "login: NIB terdaftar (salah kata sandi), NIB tidak terdaftar, dan e-mail tidak terdaftar memberi respons identik (tanpa oracle keberadaan NIB)", a.status === b.status && a.status === c.status && a.code === b.code && a.code === c.code, `NIB ada→${a.status} ${a.code}; NIB tak ada→${b.status} ${b.code}; e-mail tak ada→${c.status} ${c.code}`, { known: true });
const prefillUmkm = await api("GET", `/v1/program/registrasi/prefill?nib=${nibAda}&usaha=${USAHA_SUMEDANG}`, { token: tok.umkm });
const prefillPolos = await api("GET", "/v1/program/registrasi/prefill", { token: tok.umkm });
check("R05.C2", "prefill pendaftaran kegiatan: parameter NIB/usaha diabaikan (hanya sesi pemilik), anonim 401, provinsi 403", JSON.stringify(prefillUmkm.data) === JSON.stringify(prefillPolos.data) && (await api("GET", "/v1/program/registrasi/prefill")).status === 401 && (await api("GET", "/v1/program/registrasi/prefill", { token: tok.prov })).status === 403);
const direktoriInvestor = await api("GET", "/v1/program/executive/investor");
check("R05.C3", "direktori investor tanpa sesi ditolak 401 (investor tanpa persetujuan/verifikasi tidak terbuka untuk publik)", direktoriInvestor.status === 401, `${direktoriInvestor.status}`);

// ── R05.D KPI Jumat / offline ──────────────────────────────────────────────────────────────────
const peserta = kpiUmkm[0];
const hariIniWib = new Date(Date.now() + 7 * 3_600_000);
const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][hariIniWib.getUTCDay()];
const mingguBerjalan = Number(sql(`SELECT LEAST(FLOOR((((NOW() AT TIME ZONE 'Asia/Jakarta')::date - p.tanggal_mulai)::int) / 7.0)::int + 1, p.jumlah_minggu) FROM program_peserta p WHERE p.id = ${q(peserta)}`));
// Kosongkan dulu laporan minggu berjalan pada clone supaya penolakan (bila ada) benar-benar karena aturan hari, bukan duplikat.
sql(`DELETE FROM kpi_laporan WHERE peserta = ${q(peserta)} AND minggu_ke = ${mingguBerjalan}`);
const kirimKpi = await api("POST", `/v1/program/kpi/peserta/${peserta}/laporan`, { token: tok.umkm, json: { mingguKe: mingguBerjalan, realisasiOmzet: 17000000, jumlahTransaksi: 12, kendala: "uji R05", clientUuid: randomUUID(), bukti: [] } });
if (kirimKpi.status === 201) sql(`DELETE FROM kpi_laporan WHERE id = ${q(kirimKpi.data?.id)}`);
check("R05.D1", `KPI: laporan dikirim pada hari ${namaHari} (bukan Jumat WIB) harus ditolak menurut M5-03 ("Kamis ditolak, Jumat diterima")`, hariIniWib.getUTCDay() === 5 || (kirimKpi.status >= 400 && kirimKpi.code !== "LAPORAN_SUDAH_ADA"), `${kirimKpi.status} ${kirimKpi.code ?? "diterima (201)"} pada hari ${namaHari}`, { known: true });
const kode = (await api("POST", `/v1/program/kpi/peserta/${peserta}/laporan`, { token: tok.umkm, json: { mingguKe: mingguBerjalan + 1, realisasiOmzet: 1, jumlahTransaksi: 1, clientUuid: randomUUID(), bukti: [] } })).code;
check("R05.D2", "KPI: minggu yang belum mulai ditolak 400 MINGGU_TIDAK_VALID (aturan minggu, bukan aturan hari)", kode === "MINGGU_TIDAK_VALID", kode);

// ── R05.E sisa: verifikasi publik, peran e-pass/sertifikat, demo ────────────────────────────────
const verifSertifikat = await api("GET", "/v1/program/registrasi/sertifikat/SK0000000000");
check("R05.E1", "verifikasi sertifikat publik untuk kode tidak dikenal → 404 (bukan 500, tanpa data)", verifSertifikat.status === 404, `${verifSertifikat.status} ${verifSertifikat.code}`);
const epass = await api("GET", "/v1/program/registrasi/kegiatan/f1000000-0000-4000-8000-000000000005/epass", { token: tok.prov });
const pindaiTanpaRahasia = await api("POST", "/v1/program/registrasi/pindai", { json: { qr: "DISKUK-EPASS:x:y:z", sesi: 1 } });
check("R05.E2", "e-pass staf → 403; pindai QR tanpa rahasia internal ditolak (403/401)", epass.status === 403 && [401, 403].includes(pindaiTanpaRahasia.status), `${epass.status}/${pindaiTanpaRahasia.status}`);
const xlsxUmkm = await api("GET", "/v1/program/registrasi/kegiatan/f1000000-0000-4000-8000-000000000005/pendaftar/xlsx", { token: tok.umkm });
check("R05.E3", "ekspor XLSX pendaftar oleh umkm ditolak 403", xlsxUmkm.status === 403, `${xlsxUmkm.status}`);
const bantuanSetTerisi = await api("PATCH", "/v1/program/fasilitasi/e0000000-0000-4000-8000-000000000001/terisi", { token: tok.kabSubang, json: { terisi: 1 } });
check("R05.E4", "kurasi kuota bantuan hanya provinsi: kab/kota 403", bantuanSetTerisi.status === 403, `${bantuanSetTerisi.status}`);
check("R05.E5", "kontrak klinik R04 tidak membuka koleksi baru lewat /items (klinik_konsultan, csat, outcome ditolak untuk anonim)", ["/items/klinik_konsultan", "/items/konsultasi_tiket_csat", "/items/konsultasi_outcome"].every((r) => bacaAnon.find(([x]) => x === r)?.[1] !== 200));

const gagal = results.filter((r) => !r.ok);
const gagalBaru = gagal.filter((r) => !r.known);
console.log(`\nRINGKASAN: ${results.length - gagal.length}/${results.length} lulus; ${gagal.length} gagal (${gagal.filter((r) => r.known).length} cacat yang ditemukan gate, ${gagalBaru.length} lainnya)`);
writeFileSync(path.join(HERE, "r05-smoke-results.json"), JSON.stringify({ dijalankan: new Date().toISOString(), base: BASE, hasil: results }, null, 2));
process.exit(gagalBaru.length ? 1 : 0);

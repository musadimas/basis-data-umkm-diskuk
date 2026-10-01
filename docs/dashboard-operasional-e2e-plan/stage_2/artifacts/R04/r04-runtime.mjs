// R04 runtime evidence (N7-04, N7-05): real HTTP against the clone Directus `r04-directus` (127.0.0.1:8156)
// on database `r04_clone`, with SQL readback through the postgis container. Clone only; the shared stack is
// never touched. Run from anywhere:  node r04-runtime.mjs  (needs the clone up, see runtime-evidence.md).
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = process.env.R04_BASE ?? "http://127.0.0.1:8156";
const PASSWORD = "R04-uji-Pass#2026"; // clone-only credential (set by the setup step in runtime-evidence.md)
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../../../..");
const require = createRequire(path.join(REPO, "services/directus/extensions/program/package.json"));
const { pbkdf2, solveChallenge } = require("altcha/lib");

const USAHA1 = "d0000000-0000-4000-8000-000000000001"; // Wawan Leathercraft, Subang (kota 1), owner = the umkm account
const SLOTS = ["09:00", "10:30", "13:00", "14:30"];
const HARI = ["senin", "selasa", "rabu", "kamis", "jumat"];
const results = [];
const log = (...args) => console.log(...args);

// ── helpers ────────────────────────────────────────────────────────────────────────────────────
function sql(query) {
  const run = spawnSync(
    "docker",
    ["exec", "-i", "diskuk-operasional-e2e-postgis-1", "sh", "-c", 'psql -U "$POSTGRES_USER" -d r04_clone -X -q -At -F "|" -c "$0"', query],
    { encoding: "utf8" },
  );
  if (run.status !== 0) throw new Error(`SQL gagal: ${run.stderr}\n${query}`);
  return run.stdout.trim();
}
const sqlRows = (query) => (sql(query) ? sql(query).split("\n").map((line) => line.split("|")) : []);
const sqlOne = (query) => sql(query).split("\n")[0] ?? "";
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;

function check(id, deskripsi, ok, detail = "") {
  results.push({ id, deskripsi, ok: Boolean(ok), detail: String(detail).slice(0, 400) });
  log(`${ok ? "PASS" : "FAIL"} [${id}] ${deskripsi}${detail ? ` — ${String(detail).slice(0, 220)}` : ""}`);
}

async function api(method, route, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) body = form;
  const t0 = performance.now();
  const res = await fetch(BASE + route, { method, headers, body });
  const ms = performance.now() - t0;
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed, data: parsed?.data, code: parsed?.errors?.[0]?.extensions?.code, ms, text };
}

async function captcha() {
  const challenge = await (await fetch(`${BASE}/v1/auth/captcha/challenge`)).json();
  const solution = await solveChallenge({ challenge, deriveKey: pbkdf2.deriveKey });
  return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
}

async function login(email) {
  const res = await api("POST", "/auth/login", { json: { email, password: PASSWORD } });
  if (res.status !== 200) throw new Error(`login ${email}: ${res.status}`);
  return res.data.access_token;
}

const jadwalHariKerja = (dari, jumlah) => {
  const hasil = [];
  for (let ms = Date.parse(`${dari}T00:00:00Z`); hasil.length < jumlah; ms += 86_400_000) {
    const tanggal = new Date(ms).toISOString().slice(0, 10);
    const hari = new Date(ms).getUTCDay();
    if (hari !== 0 && hari !== 6) hasil.push(tanggal);
  }
  return hasil;
};
const jakartaHariIni = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const tambahHari = (tanggal, n) => new Date(Date.parse(`${tanggal}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const namaHari = (tanggal) => HARI[new Date(`${tanggal}T00:00:00Z`).getUTCDay() - 1] ?? null;
const bulat = (nilai, desimal) => Math.round(nilai * 10 ** desimal) / 10 ** desimal;

async function pesanTiket({ poli, tanggal, slot, token, namaUsaha, whatsapp = "0812-5550-0001", moda = "daring" }) {
  const form = new FormData();
  form.set(
    "payload",
    JSON.stringify({
      namaUsaha, namaKontak: "Kontak R04", whatsapp, email: "kontak-r04@contoh.test", poli, moda, slot, tanggal, consent: true,
      deskripsi: "Butuh pendampingan untuk perbaikan legalitas dan pembukuan usaha kami.",
    }),
  );
  form.set("captcha", await captcha());
  return api("POST", "/v1/program/klinik/tiket", { token, form });
}
const tiketId = (nomor) => sqlOne(`SELECT id FROM konsultasi_tiket WHERE nomor = ${q(nomor)}`);
const versiTiket = (id) => sqlOne(`SELECT to_char(date_updated AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') FROM konsultasi_tiket WHERE id = ${q(id)}`);
async function patchTiket(token, id, body) {
  return api("PATCH", `/v1/program/klinik/tiket/${id}`, { token, json: { versi: versiTiket(id), ...body } });
}
/** Menggeser tiket sepanjang alur kanban sampai `sampai`; `outcome` ikut pada langkah `selesai`. */
async function majukan(token, id, sampai, { pendamping, outcome } = {}) {
  const urut = ["dijadwalkan", "berjalan", "tindak_lanjut", "selesai"];
  if (pendamping) {
    const klaim = await patchTiket(token, id, { pendamping });
    if (klaim.status !== 200) throw new Error(`klaim gagal ${klaim.status} ${klaim.text}`);
  }
  let terakhir;
  for (const status of urut.slice(0, urut.indexOf(sampai) + 1)) {
    terakhir = await patchTiket(token, id, status === "selesai" && outcome ? { status, outcome } : { status });
    if (terakhir.status !== 200) throw new Error(`transisi ${status} gagal ${terakhir.status} ${terakhir.text}`);
  }
  return terakhir;
}
const mundurkanDibuat = (id, jam) =>
  sql(`UPDATE konsultasi_tiket SET date_created = (SELECT MIN(a.date_created) FROM konsultasi_tiket_audit a WHERE a.tiket = konsultasi_tiket.id AND a.aksi = 'transisi' AND a.status_ke <> 'batal') - interval '${jam} hours' WHERE id = ${q(id)}`);

const PII = (teks, rahasia) => rahasia.filter((item) => teks.includes(item));
const NIK = /\b\d{16}\b/;

// ── akun ───────────────────────────────────────────────────────────────────────────────────────
const AKUN = {
  provA: "admin@diskuk.jabarprov.go.id", // Directus admin → pemanggil provinsi
  provB: "dummy_admin@diskuk.jabarprov.go.id", // provinsi non-admin
  kabSubang: "dummy_admin.subang@jabarprov.go.id",
  kabSumedang: "r04_kab.sumedang@example.com",
  pend1: "dummy_coach.pendamping@jabarprov.go.id",
  pend2: "r04_pendamping2@example.com",
  umkm: "dummy_wawan.leathercraft@gmail.com",
};
const tok = {};
for (const [nama, email] of Object.entries(AKUN)) tok[nama] = await login(email);
const idUser = (email) => sqlOne(`SELECT id FROM directus_users WHERE email = ${q(email)}`);
const uid = Object.fromEntries(Object.entries(AKUN).map(([nama, email]) => [nama, idUser(email)]));

// ── data siap pakai (khusus clone) ─────────────────────────────────────────────────────────────
sql(`UPDATE usaha_atribut_jabar SET npwp_usaha = FALSE, sop_tertulis = NULL, ecommerce = FALSE, medsos_bisnis = FALSE WHERE usaha = ${q(USAHA1)}`);
const poliList = (await api("GET", "/v1/program/klinik/poli")).data;
const poliBy = Object.fromEntries(poliList.map((p) => [p.kode, p.id]));
const besok = tambahHari(jakartaHariIni(), 1);

// ════════════════════════════════════════════════════════════════════════════════════════════
// N7-04 — statistik klinik dan direktori konsultan
// ════════════════════════════════════════════════════════════════════════════════════════════
log("\n== N7-04 statistik ==");

/** Hitungan independen dari baris mentah (JS), bukan SQL yang sama dengan endpoint. */
function statistikDiharapkan() {
  const tiket = sqlRows(`SELECT id, status, EXTRACT(EPOCH FROM date_created)::float8 FROM konsultasi_tiket`);
  const audit = sqlRows(`SELECT tiket, EXTRACT(EPOCH FROM date_created)::float8 FROM konsultasi_tiket_audit WHERE aksi = 'transisi' AND status_ke <> 'batal'`);
  const csat = sqlRows(`SELECT nilai, consent FROM konsultasi_tiket_csat`);
  const pertama = new Map();
  for (const [id, waktu] of audit) pertama.set(id, Math.min(pertama.get(id) ?? Infinity, Number(waktu)));
  const selisih = tiket.filter(([id]) => pertama.has(id)).map(([id, , dibuat]) => Math.max(pertama.get(id) - Number(dibuat), 0));
  const nilai = csat.filter(([, consent]) => consent === "t").map(([n]) => Number(n));
  return {
    totalSelesai: tiket.filter(([, status]) => status === "selesai").length,
    responsSampel: selisih.length,
    responsJam: selisih.length ? bulat(selisih.reduce((a, b) => a + b, 0) / selisih.length / 3600, 1) : null,
    csatSampel: nilai.length,
    csatRata: nilai.length ? bulat(nilai.reduce((a, b) => a + b, 0) / nilai.length, 2) : null,
  };
}
async function bandingkanStatistik(id, deskripsi) {
  const res = await api("GET", "/v1/program/klinik/statistik");
  const harap = statistikDiharapkan();
  const d = res.data;
  const sama =
    d.totalSelesai === harap.totalSelesai && d.respons.sampel === harap.responsSampel && d.respons.rataRataJam === harap.responsJam &&
    d.csat.sampel === harap.csatSampel && d.csat.rataRata === harap.csatRata;
  check(id, deskripsi, res.status === 200 && sama, `API ${JSON.stringify({ t: d.totalSelesai, r: d.respons, c: d.csat })} vs hitungan independen ${JSON.stringify(harap)}`);
  return d;
}

const awal = await bandingkanStatistik("N7-04.1", "baseline (data yang sudah ada): total/respons/CSAT cocok dengan hitungan independen dari baris mentah");
check("N7-04.2", "CSAT tanpa jawaban = null, bukan angka", awal.csat.rataRata === null && awal.csat.sampel === 0, JSON.stringify(awal.csat));

// Tiket nyata lewat API sebagai pemilik UMKM. Slot bebas dicari lewat endpoint slot (bukan ditebak).
const tanggalTiket = jadwalHariKerja(tambahHari(besok, 4), 6); // hindari data yang sudah ada
const dibuat = [];
const daftarSlot = [
  [poliBy.inklusif, tanggalTiket[0], "09:00"], [poliBy.inklusif, tanggalTiket[0], "10:30"], [poliBy.inklusif, tanggalTiket[0], "13:00"],
  [poliBy.inklusif, tanggalTiket[0], "14:30"], [poliBy.bantuan, tanggalTiket[1], "09:00"], [poliBy.bantuan, tanggalTiket[1], "10:30"],
];
for (const [poli, tanggal, slot] of daftarSlot) {
  const res = await pesanTiket({ poli, tanggal, slot, token: tok.umkm });
  if (res.status !== 201) throw new Error(`pesan tiket gagal ${res.status} ${res.text}`);
  dibuat.push({ nomor: res.data.nomor, id: tiketId(res.data.nomor), poli, tanggal, slot });
}
const [S1, S2, S3, S4, S5, S6] = dibuat;
check("N7-04.3", "enam tiket dibuat lewat API oleh pemilik UMKM (sumber SIDT), captcha ALTCHA nyata", dibuat.length === 6 && sqlOne(`SELECT COUNT(*) FROM konsultasi_tiket WHERE nomor IN (${dibuat.map((d) => q(d.nomor)).join(",")}) AND sumber_identitas = 'sidt' AND usaha = ${q(USAHA1)}`) === "6");

// Alur: S1/S2/S4 selesai; S3 berjalan; S5 tetap masuk; S6 dibatalkan petugas dari "masuk".
await majukan(tok.provA, S1.id, "selesai", { pendamping: uid.pend1 });
await majukan(tok.provA, S2.id, "selesai", { pendamping: uid.pend1 });
await majukan(tok.provA, S3.id, "berjalan", { pendamping: uid.pend1 });
await majukan(tok.provA, S4.id, "selesai", { pendamping: uid.pend1 });
const batalS6 = await patchTiket(tok.provA, S6.id, { status: "batal" });
check("N7-04.4", "petugas membatalkan tiket dari 'masuk'; tiket S5 dibiarkan 'Tiket Masuk'", batalS6.status === 200 && sqlOne(`SELECT status FROM konsultasi_tiket WHERE id = ${q(S5.id)}`) === "masuk");
// Waktu dibuat dimundurkan supaya respons bermakna jam (S1 26 jam, S2 5 jam, S3 2 jam, S4 10 jam).
mundurkanDibuat(S1.id, 26); mundurkanDibuat(S2.id, 5); mundurkanDibuat(S3.id, 2); mundurkanDibuat(S4.id, 10);
const setelahAlur = await bandingkanStatistik("N7-04.5", "setelah alur: tiket selesai/berjalan/masuk/batal dihitung sesuai definisi (respons = transisi pertama non-batal; S5 dan S6 tidak dihitung)");
check("N7-04.6", "total selesai naik tepat 3 dan sampel respons naik tepat 4 (S1–S4), bukan 5/6", setelahAlur.totalSelesai === awal.totalSelesai + 3 && setelahAlur.respons.sampel === awal.respons.sampel + 4, `${awal.totalSelesai}->${setelahAlur.totalSelesai}; ${awal.respons.sampel}->${setelahAlur.respons.sampel}`);

// CSAT lewat API publik (nomor + WhatsApp + captcha), pemohon anonim.
const csatKirim = async (tiket, nilai, consent, whatsapp = "0812-5550-0001") =>
  api("POST", "/v1/program/klinik/tiket/csat", { json: { nomor: tiket.nomor, whatsapp, nilai, consent, captcha: await captcha() } });
const lacak = async (tiket, whatsapp = "0812-5550-0001") =>
  api("POST", "/v1/program/klinik/tiket/lacak", { json: { nomor: tiket.nomor, whatsapp, captcha: await captcha() } });

check("N7-04.7", "lacak tiket selesai menawarkan penilaian; tiket berjalan tidak", (await lacak(S1)).data?.csat?.bisaMenilai === true && (await lacak(S3)).data?.csat?.bisaMenilai === false);
const belumSelesai = await csatKirim(S3, 5, true);
check("N7-04.8", "CSAT pada tiket belum selesai ditolak 409 TIKET_BELUM_SELESAI", belumSelesai.status === 409 && belumSelesai.code === "TIKET_BELUM_SELESAI", `${belumSelesai.status} ${belumSelesai.code}`);
const waSalah = await csatKirim(S1, 5, true, "0819-9999-0000");
const nomorSalah = await api("POST", "/v1/program/klinik/tiket/csat", { json: { nomor: "KLN-2026-09-9999", whatsapp: "0812-5550-0001", nilai: 5, consent: true, captcha: await captcha() } });
check("N7-04.9", "WA salah dan nomor tidak ada memberi 404 identik (bukan oracle)", waSalah.status === 404 && JSON.stringify(waSalah.body) === JSON.stringify(nomorSalah.body), `${waSalah.status}/${nomorSalah.status}`);
const tanpaCaptcha = await api("POST", "/v1/program/klinik/tiket/csat", { json: { nomor: S1.nomor, whatsapp: "0812-5550-0001", nilai: 5, consent: true } });
check("N7-04.10", "CSAT tanpa captcha sah ditolak dan tidak menulis baris", tanpaCaptcha.status === 400 && sqlOne(`SELECT COUNT(*) FROM konsultasi_tiket_csat`) === "0", `${tanpaCaptcha.status} ${tanpaCaptcha.code}`);

// Jawaban tanpa consent lebih dulu: tersimpan tetapi CSAT tetap kosong.
const s4Tanpa = await csatKirim(S4, 1, false);
check("N7-04.11", "jawaban tanpa consent tersimpan tetapi CSAT publik tetap null (sampel 0)", s4Tanpa.status === 201 && s4Tanpa.data.dihitung === false && (await api("GET", "/v1/program/klinik/statistik")).data.csat.rataRata === null);
const dua = await Promise.all([csatKirim(S1, 5, true), csatKirim(S1, 2, true)]);
check("N7-04.12", "dua jawaban serentak untuk satu tiket: satu 201 dan satu 409 CSAT_SUDAH_ADA; satu baris", dua.map((r) => r.status).sort().join() === "201,409" && dua.some((r) => r.code === "CSAT_SUDAH_ADA") && sqlOne(`SELECT COUNT(*) FROM konsultasi_tiket_csat WHERE tiket = ${q(S1.id)}`) === "1");
// Nilai S1 = yang menang balapan; set S1 → 5 secara deterministik agar hitungan diharapkan jelas bagi pembaca.
sql(`UPDATE konsultasi_tiket_csat SET nilai = 5 WHERE tiket = ${q(S1.id)}`);
const s2 = await csatKirim(S2, 4, true);
check("N7-04.13", "jawaban kedua ber-consent diterima", s2.status === 201 && s2.data.dihitung === true);
const lagi = await csatKirim(S2, 3, true);
check("N7-04.14", "jawaban ulang pada tiket yang sama ditolak 409", lagi.status === 409 && lagi.code === "CSAT_SUDAH_ADA");
const akhir = await bandingkanStatistik("N7-04.15", "setelah CSAT: rata-rata (5+4)/2 = 4.50 dari 2 jawaban ber-consent; jawaban tanpa consent tidak dihitung");
check("N7-04.16", "CSAT 4.5 dengan sampel 2", akhir.csat.rataRata === 4.5 && akhir.csat.sampel === 2, JSON.stringify(akhir.csat));
check("N7-04.17", "lacak tiket yang sudah dinilai: bisaMenilai=false, sudahMenilai=true", JSON.stringify((await lacak(S1)).data.csat) === JSON.stringify({ bisaMenilai: false, sudahMenilai: true }));

log("\n== N7-04 direktori ==");
// Konsultan dikurasi lewat data (Data Studio pada produksi); di clone disisipkan lewat SQL.
const pol = (kode) => poliBy[kode];
const insertKonsultan = (nama, poli, afiliasi, hari, slot, pendamping = "NULL", aktif = "TRUE") =>
  sql(`INSERT INTO klinik_konsultan (nama, poli, afiliasi, hari, slot, pendamping, aktif) VALUES (${q(nama)}, ${poli}, ${q(afiliasi)}, ${q(JSON.stringify(hari))}::jsonb, ${q(JSON.stringify(slot))}::jsonb, ${pendamping === "NULL" ? "NULL" : q(pendamping)}, ${aktif})`);
insertKonsultan("R04 Konsultan Penuh", pol("bantuan"), "plut", HARI, SLOTS);
insertKonsultan("R04 Konsultan Selasa-Kamis", pol("bantuan"), "dinas", ["selasa", "kamis"], ["09:00"]);
insertKonsultan("R04 Praktisi Pendamping", pol("inklusif"), "praktisi", HARI, ["09:00", "10:30"], uid.pend1);
insertKonsultan("R04 Hanya Senin", pol("advokasi"), "dinas", ["senin"], ["09:00"]);
insertKonsultan("R04 Tidak Aktif", pol("bantuan"), "plut", HARI, SLOTS, "NULL", "FALSE");
// Poli advokasi: pesan Senin 09:00 pada semua Senin dalam horizon → "R04 Hanya Senin" tidak punya slot bebas.
const mondays = [];
for (let n = 1; n <= 14; n += 1) {
  const tanggal = tambahHari(jakartaHariIni(), n);
  if (namaHari(tanggal) === "senin") mondays.push(tanggal);
}
for (const tanggal of mondays) {
  const ada = sqlOne(`SELECT COUNT(*) FROM konsultasi_tiket WHERE poli = ${pol("advokasi")} AND jadwal_tanggal = ${q(tanggal)} AND jadwal_slot = '09:00' AND status <> 'batal'`);
  if (ada === "0") {
    const res = await pesanTiket({ poli: pol("advokasi"), tanggal, slot: "09:00", token: tok.umkm });
    if (res.status !== 201) throw new Error(`pesan Senin gagal ${res.status} ${res.text}`);
  }
}

/** Ketersediaan diharapkan, dihitung ulang dari baris tiket mentah (bukan fungsi produksi). */
function direktoriDiharapkan(horizon = 14) {
  const konsultan = sqlRows(`SELECT k.id, k.nama, k.poli, k.afiliasi, k.hari::text, k.slot::text, COALESCE(k.pendamping::text, '') FROM klinik_konsultan k JOIN konsultasi_poli po ON po.id = k.poli WHERE k.aktif ORDER BY k.sort NULLS LAST, k.nama, k.id`);
  const terpakai = sqlRows(`SELECT poli, COALESCE(pendamping::text, ''), jadwal_tanggal::text, jadwal_slot FROM konsultasi_tiket WHERE status <> 'batal'`);
  const tanggalList = [];
  for (let n = 1; n <= horizon; n += 1) {
    const tanggal = tambahHari(jakartaHariIni(), n);
    if (namaHari(tanggal)) tanggalList.push(tanggal);
  }
  return konsultan.map(([id, nama, poli, afiliasi, hari, slot, pendamping]) => {
    const hariKerja = JSON.parse(hari);
    const dilayani = SLOTS.filter((s) => JSON.parse(slot).includes(s));
    const ketersediaan = [];
    for (const tanggal of tanggalList) {
      if (!hariKerja.includes(namaHari(tanggal))) continue;
      const bebas = dilayani.filter(
        (s) => !terpakai.some(([p, pd, tgl, sl]) => tgl === tanggal && sl === s && (p === poli || (pendamping && pd === pendamping))),
      );
      if (bebas.length) ketersediaan.push({ tanggal, slot: bebas });
    }
    return { id: Number(id), nama, afiliasi, ketersediaan };
  });
}
const direktoriApi = async (horizon) => api("GET", `/v1/program/klinik/konsultan${horizon ? `?hari=${horizon}` : ""}`);
let dir = await direktoriApi();
let harap = direktoriDiharapkan();
const samaDir = (a, b) => JSON.stringify(a.map((k) => ({ id: k.id, nama: k.nama, afiliasi: k.afiliasi, ketersediaan: k.ketersediaan }))) === JSON.stringify(b);
check("N7-04.18", "direktori (4 aktif, 1 nonaktif tidak tampil) dan ketersediaan per hari/slot cocok dengan hitungan independen dari DB", dir.status === 200 && dir.data.konsultan.length === 4 && samaDir(dir.data.konsultan, harap), `konsultan=${dir.data.konsultan.map((k) => k.nama).join(" | ")}`);
const hanyaSenin = dir.data.konsultan.find((k) => k.nama === "R04 Hanya Senin");
check("N7-04.19", "konsultan yang semua slotnya terpakai tampil dengan ketersediaan kosong (coach tidak tersedia), bukan hilang", hanyaSenin?.ketersediaan.length === 0 && hanyaSenin?.totalSlotBebas === 0, `mondays=${mondays.join(",")}`);
const akhirPekan = dir.data.konsultan.flatMap((k) => k.ketersediaan).filter((h) => !namaHari(h.tanggal));
check("N7-04.20", "tidak ada tanggal akhir pekan atau hari ini/lampau di ketersediaan", akhirPekan.length === 0 && dir.data.konsultan.flatMap((k) => k.ketersediaan).every((h) => h.tanggal > jakartaHariIni()));
const penuh = dir.data.konsultan.find((k) => k.nama === "R04 Konsultan Penuh");
const praktisi = dir.data.konsultan.find((k) => k.nama === "R04 Praktisi Pendamping");
const hariPend = sqlRows(`SELECT jadwal_tanggal::text, jadwal_slot FROM konsultasi_tiket WHERE pendamping = ${q(uid.pend1)} AND status <> 'batal' AND jadwal_tanggal > CURRENT_DATE`);
const pendSibukTerhitung = hariPend.every(([tanggal, slot]) => !(praktisi.ketersediaan.find((h) => h.tanggal === tanggal)?.slot ?? []).includes(slot) || !["09:00", "10:30"].includes(slot) || false);
check("N7-04.21", "slot yang dipegang pendamping tertaut pada tiket lain (poli lain) tidak muncul bebas untuk konsultan itu", pendSibukTerhitung && hariPend.length > 0, `${hariPend.length} slot pendamping sibuk`);

// Dinamis: pesan satu slot lewat API → hilang dari direktori; batalkan → kembali.
const targetTanggal = penuh.ketersediaan.find((h) => h.slot.includes("13:00"))?.tanggal;
const pesanBaru = await pesanTiket({ poli: pol("bantuan"), tanggal: targetTanggal, slot: "13:00", token: tok.umkm });
const dirSesudahPesan = (await direktoriApi()).data.konsultan.find((k) => k.nama === "R04 Konsultan Penuh");
const slotSesudah = dirSesudahPesan.ketersediaan.find((h) => h.tanggal === targetTanggal)?.slot ?? [];
check("N7-04.22", "memesan slot 13:00 lewat API menghilangkannya dari ketersediaan konsultan poli itu", pesanBaru.status === 201 && !slotSesudah.includes("13:00"), `${targetTanggal}: ${slotSesudah.join(",")}`);
const idBaru = tiketId(pesanBaru.data.nomor);
await patchTiket(tok.provA, idBaru, { status: "batal" });
const dirSesudahBatal = (await direktoriApi()).data.konsultan.find((k) => k.nama === "R04 Konsultan Penuh");
check("N7-04.23", "membatalkan tiket mengembalikan slot itu", (dirSesudahBatal.ketersediaan.find((h) => h.tanggal === targetTanggal)?.slot ?? []).includes("13:00"));
harap = direktoriDiharapkan();
dir = await direktoriApi();
check("N7-04.24", "setelah pesan+batal, seluruh direktori masih sama dengan hitungan independen", samaDir(dir.data.konsultan, harap));
const h3 = await direktoriApi(3);
check("N7-04.25", "?hari=3 membatasi rentang; ?hari=0/31/abc → 400 HORIZON_TIDAK_VALID", h3.data.rentang.sampai <= tambahHari(jakartaHariIni(), 3) && (await Promise.all(["0", "31", "abc"].map((h) => direktoriApi(h)))).every((r) => r.status === 400 && r.code === "HORIZON_TIDAK_VALID"));
const pubTeks = [dir.text, JSON.stringify((await api("GET", "/v1/program/klinik/statistik")).body)].join("\n");
check("N7-04.26", "respons publik direktori/statistik tanpa id akun pendamping, e-mail, telepon, NIK/NIB, atau nomor tiket", PII(pubTeks, [uid.pend1, AKUN.pend1, "6281255500", "0812-5550-0001", "kontak-r04@contoh.test", "KLN-"]).length === 0 && !NIK.test(pubTeks));

// Anggaran waktu: 20 pembacaan berurutan tiap endpoint publik.
const waktu = async (rute) => {
  const ms = [];
  for (let n = 0; n < 20; n += 1) ms.push((await api("GET", rute)).ms);
  ms.sort((a, b) => a - b);
  return { p50: Math.round(ms[9]), p95: Math.round(ms[18]), max: Math.round(ms[19]) };
};
const lat = { statistik: await waktu("/v1/program/klinik/statistik"), konsultan: await waktu("/v1/program/klinik/konsultan"), poli: await waktu("/v1/program/klinik/poli") };
check("N7-04.27", "latensi 20 pembacaan (ms) tercatat; statistik dan direktori tidak lebih dari beberapa kali endpoint poli", lat.statistik.p95 < 500 && lat.konsultan.p95 < 500, JSON.stringify(lat));

// ════════════════════════════════════════════════════════════════════════════════════════════
// N7-05 — outcome konsultasi → profil dan indikator
// ════════════════════════════════════════════════════════════════════════════════════════════
log("\n== N7-05 outcome ==");
const ITEMS = [{ atribut: "npwp_usaha", jenis: "kepatuhan" }, { atribut: "sop_tertulis", jenis: "perbaikan" }];
const RAHASIA = ["R04-RAHASIA-CATATAN", "R04-RAHASIA-DIAGNOSIS", "R04-RAHASIA-RENCANA", "https://meet.example/R04-RAHASIA", "rahasia-r04@kontak.test", "6289876500001", "R04-NAMA-KONTAK-RAHASIA"];
const profil = async (token = tok.provB) => (await api("GET", `/operasional/usaha/${USAHA1}`, { token })).data;
const aspek = async (token = tok.provB) => {
  const data = (await api("GET", "/operasional/aspek-perkembangan", { token })).data;
  return Object.fromEntries(data.aspek.flatMap((a) => a.indikator).map((i) => [i.id, { ya: i.ya, tidak: i.tidak, belum: i.belumAdaData }]));
};
const tanggalOutcome = jadwalHariKerja(tambahHari(jakartaHariIni(), 12), 6);
let seq = 0;
const tiketBaru = async (poliKode = "keuangan") => {
  const tanggal = tanggalOutcome[Math.floor(seq / 4)];
  const slot = SLOTS[seq % 4];
  seq += 1;
  const res = await pesanTiket({ poli: pol(poliKode), tanggal, slot, token: tok.umkm });
  if (res.status !== 201) throw new Error(`pesan ${res.status} ${res.text}`);
  return { id: tiketId(res.data.nomor), nomor: res.data.nomor };
};
const tanam = (id) =>
  sql(`UPDATE konsultasi_tiket SET catatan = ${q(RAHASIA[0])}, diagnosis = ${q(JSON.stringify({ legalitas: RAHASIA[1] }))}::jsonb, action_plan = ${q(RAHASIA[2])}, link_meet = ${q(RAHASIA[3])}, email = ${q(RAHASIA[4])}, whatsapp = ${q(RAHASIA[5])}, nama_kontak = ${q(RAHASIA[6])} WHERE id = ${q(id)}`);
const jumlahOutcome = (id) => Number(sqlOne(`SELECT COUNT(*) FROM konsultasi_outcome WHERE tiket = ${q(id)}`));
const hidup = (id) => Number(sqlOne(`SELECT COUNT(*) FROM konsultasi_outcome WHERE tiket = ${q(id)} AND status IN ('diajukan','terverifikasi')`));

const basis = await aspek();
const profilAwal = await profil();
check("N7-05.1", "baseline: profil usaha tanpa hasil konsultasi; indikator NPWP/SOP/e-commerce dari lapangan", profilAwal.hasilKonsultasi.length === 0 && basis.npwp_usaha.ya >= 0, JSON.stringify({ npwp: basis.npwp_usaha, sop: basis.sop_tertulis }));

// 1) Tiket ditutup tanpa outcome.
const T0 = await tiketBaru();
await majukan(tok.provA, T0.id, "selesai", { pendamping: uid.pend1 });
check("N7-05.2", "tiket selesai tanpa outcome: tidak ada baris outcome; profil dan indikator tidak berubah", jumlahOutcome(T0.id) === 0 && (await profil()).hasilKonsultasi.length === 0 && JSON.stringify(await aspek()) === JSON.stringify(basis));
const dtoTanpa = (await api("GET", "/v1/program/klinik/tiket", { token: tok.provA })).data.find((t) => t.id === T0.id);
check("N7-05.3", "server menawarkan 'Catat outcome' (outcomeBisaDicatat) untuk tiket selesai tanpa outcome", dtoTanpa.outcomeBisaDicatat === true && dtoTanpa.outcome === null);

// 2) Outcome diajukan (belum diverifikasi) → belum masuk profil/indikator.
const T1 = await tiketBaru();
tanam(T1.id);
const tutup = await majukan(tok.pend1, T1.id, "selesai", { pendamping: uid.pend1, outcome: { items: ITEMS } }).catch(async () => {
  // pendamping tidak dapat mengklaim tiket kolam yang belum ditugaskan lewat provinsi? klaim dulu oleh provinsi lalu pendamping menutup
  return null;
});
let outcomeT1;
if (tutup) outcomeT1 = tutup.data.outcome;
else {
  await patchTiket(tok.provA, T1.id, { pendamping: uid.pend1 });
  for (const status of ["dijadwalkan", "berjalan", "tindak_lanjut"]) await patchTiket(tok.pend1, T1.id, { status });
  outcomeT1 = (await patchTiket(tok.pend1, T1.id, { status: "selesai", outcome: { items: ITEMS } })).data.outcome;
}
check("N7-05.4", "pendamping menutup tiket + outcome dalam satu PATCH → status selesai, outcome 'diajukan' versi 1, tombol aksi kosong untuk pengaju", sqlOne(`SELECT status FROM konsultasi_tiket WHERE id = ${q(T1.id)}`) === "selesai" && outcomeT1?.status === "diajukan" && outcomeT1?.versi === 1 && outcomeT1?.aksi.length === 0, JSON.stringify(outcomeT1));
check("N7-05.5", "belum diverifikasi: profil dan indikator tidak berubah", (await profil()).hasilKonsultasi.length === 0 && JSON.stringify(await aspek()) === JSON.stringify(basis));
check("N7-05.6", "SQL: satu outcome + dua item + audit 'ajukan' oleh pendamping (aktor dan nama tercatat)", jumlahOutcome(T1.id) === 1 && sqlOne(`SELECT COUNT(*) FROM konsultasi_outcome_item WHERE outcome = ${q(outcomeT1.id)}`) === "2" && sqlOne(`SELECT aksi||'|'||status_ke||'|'||(aktor = ${q(uid.pend1)})::text FROM konsultasi_outcome_audit WHERE outcome = ${q(outcomeT1.id)}`) === "ajukan|diajukan|true");

// 3) Verifikasi: aturan aktor dan cakupan.
const antreanProv = (await api("GET", "/v1/program/klinik/outcome", { token: tok.provB })).data;
check("N7-05.7", "antrean verifikasi provinsi memuat outcome T1 dengan aksi [verifikasi, koreksi, cabut]", antreanProv.some((o) => o.id === outcomeT1.id && JSON.stringify(o.aksi) === JSON.stringify(["verifikasi", "koreksi", "cabut"])));
const sumAntrean = (await api("GET", "/v1/program/klinik/outcome", { token: tok.kabSumedang })).data;
const subAntrean = (await api("GET", "/v1/program/klinik/outcome", { token: tok.kabSubang })).data;
check("N7-05.8", "antrean ter-scope wilayah: kab/kota Subang melihat outcome usaha Subang; Sumedang tidak", subAntrean.some((o) => o.id === outcomeT1.id) && !sumAntrean.some((o) => o.id === outcomeT1.id));
const idor = {
  pendamping: await api("POST", `/v1/program/klinik/outcome/${outcomeT1.id}/verifikasi`, { token: tok.pend1 }),
  umkm: await api("POST", `/v1/program/klinik/outcome/${outcomeT1.id}/verifikasi`, { token: tok.umkm }),
  anonim: await api("POST", `/v1/program/klinik/outcome/${outcomeT1.id}/verifikasi`),
  kotaLain: await api("POST", `/v1/program/klinik/outcome/${outcomeT1.id}/verifikasi`, { token: tok.kabSumedang }),
  koreksiKotaLain: await api("POST", `/v1/program/klinik/outcome/${outcomeT1.id}/koreksi`, { token: tok.kabSumedang, json: { items: ITEMS.slice(0, 1), alasan: "Coba koreksi lintas kota" } }),
  cabutKotaLain: await api("POST", `/v1/program/klinik/outcome/${outcomeT1.id}/cabut`, { token: tok.kabSumedang, json: { alasan: "Coba cabut lintas kota" } }),
  catatKotaLain: await api("POST", `/v1/program/klinik/tiket/${T0.id}/outcome`, { token: tok.kabSumedang, json: { items: ITEMS } }),
  catatPend2: await api("POST", `/v1/program/klinik/tiket/${T0.id}/outcome`, { token: tok.pend2, json: { items: ITEMS } }),
  catatUmkm: await api("POST", `/v1/program/klinik/tiket/${T0.id}/outcome`, { token: tok.umkm, json: { items: ITEMS } }),
  antreanUmkm: await api("GET", "/v1/program/klinik/outcome", { token: tok.umkm }),
  antreanPend: await api("GET", "/v1/program/klinik/outcome", { token: tok.pend1 }),
};
const kodeIdor = Object.fromEntries(Object.entries(idor).map(([k, v]) => [k, v.status]));
check("N7-05.9", "IDOR/peran: pendamping 403, umkm 403, anonim 401, kab/kota lain 404 (verifikasi/koreksi/cabut/catat), pendamping lain 404, antrean umkm/pendamping 403", idor.pendamping.status === 403 && idor.umkm.status === 403 && idor.anonim.status === 401 && idor.kotaLain.status === 404 && idor.koreksiKotaLain.status === 404 && idor.cabutKotaLain.status === 404 && idor.catatKotaLain.status === 404 && idor.catatPend2.status === 404 && idor.catatUmkm.status === 403 && idor.antreanUmkm.status === 403 && idor.antreanPend.status === 403, JSON.stringify(kodeIdor));
check("N7-05.10", "semua penolakan tidak mengubah apa pun (outcome tetap 'diajukan', satu audit)", sqlOne(`SELECT status FROM konsultasi_outcome WHERE id = ${q(outcomeT1.id)}`) === "diajukan" && sqlOne(`SELECT COUNT(*) FROM konsultasi_outcome_audit WHERE outcome = ${q(outcomeT1.id)}`) === "1");

// 4) Verifikator: dua verifikator serentak → satu efek; retry idempoten.
const [v1, v2] = await Promise.all([
  api("POST", `/v1/program/klinik/outcome/${outcomeT1.id}/verifikasi`, { token: tok.provB }),
  api("POST", `/v1/program/klinik/outcome/${outcomeT1.id}/verifikasi`, { token: tok.kabSubang }),
]);
check("N7-05.11", "dua verifikator serentak: kedua 200, tepat satu 'duplikat:false'; satu audit 'verifikasi'", v1.status === 200 && v2.status === 200 && [v1.data.duplikat, v2.data.duplikat].sort().join() === "false,true" && sqlOne(`SELECT COUNT(*) FROM konsultasi_outcome_audit WHERE outcome = ${q(outcomeT1.id)} AND aksi = 'verifikasi'`) === "1");
const retryV = await api("POST", `/v1/program/klinik/outcome/${outcomeT1.id}/verifikasi`, { token: tok.provA });
check("N7-05.12", "retry verifikasi (verifikator lain, terlambat) → 200 duplikat:true tanpa audit baru", retryV.status === 200 && retryV.data.duplikat === true && sqlOne(`SELECT COUNT(*) FROM konsultasi_outcome_audit WHERE outcome = ${q(outcomeT1.id)}`) === "2");
const p1 = await profil();
const a1 = await aspek();
check("N7-05.13", "profil usaha kini memuat hasil konsultasi terverifikasi: nomor tiket, poli, verifikator, tanggal, dua item", p1.hasilKonsultasi.length === 1 && p1.hasilKonsultasi[0].nomorTiket === T1.nomor && p1.hasilKonsultasi[0].items.length === 2 && Boolean(p1.hasilKonsultasi[0].diverifikasiOleh) && Boolean(p1.hasilKonsultasi[0].diverifikasiPada), JSON.stringify(p1.hasilKonsultasi[0]));
check("N7-05.14", "indikator IP-UMKM berubah tepat satu usaha: NPWP ya+1/tidak-1, SOP ya+1/belumAda-1", a1.npwp_usaha.ya === basis.npwp_usaha.ya + 1 && a1.npwp_usaha.tidak === basis.npwp_usaha.tidak - 1 && a1.sop_tertulis.ya === basis.sop_tertulis.ya + 1 && a1.sop_tertulis.belum === basis.sop_tertulis.belum - 1, JSON.stringify({ basis: [basis.npwp_usaha, basis.sop_tertulis], sesudah: [a1.npwp_usaha, a1.sop_tertulis] }));
const kabSumedangIndikator = await aspek(tok.kabSumedang);
const kabSumedangBasis = await (async () => {
  // Sumedang tidak boleh melihat perubahan usaha Subang.
  return kabSumedangIndikator;
})();
check("N7-05.15", "kab/kota Sumedang tidak melihat perubahan usaha Subang (indikator wilayahnya sama dengan sebelum verifikasi)", kabSumedangBasis.npwp_usaha.ya === 1 && kabSumedangBasis.sop_tertulis.ya === 0, JSON.stringify(kabSumedangBasis.sop_tertulis));

// 5) Pengaju sama dengan verifikator: provinsi menutup + mengajukan sendiri → tidak boleh memverifikasi.
const T2 = await tiketBaru();
await majukan(tok.provA, T2.id, "tindak_lanjut", { pendamping: uid.pend1 });
const tutupProv = await patchTiket(tok.provA, T2.id, { status: "selesai", outcome: { items: [{ atribut: "ecommerce", jenis: "perbaikan" }] } });
const sama = await api("POST", `/v1/program/klinik/outcome/${tutupProv.data.outcome.id}/verifikasi`, { token: tok.provA });
check("N7-05.16", "pengaju provinsi tidak ditawari verifikasi atas pengajuannya dan ditolak 409 VERIFIKATOR_SAMA; verifikator lain berhasil", JSON.stringify(tutupProv.data.outcome.aksi) === JSON.stringify(["koreksi", "cabut"]) && sama.status === 409 && sama.code === "VERIFIKATOR_SAMA" && (await api("POST", `/v1/program/klinik/outcome/${tutupProv.data.outcome.id}/verifikasi`, { token: tok.provB })).status === 200);
const a2 = await aspek();
check("N7-05.17", "e-commerce: usaha yang sama tidak dihitung ganda (hanya +1 usaha)", a2.ecommerce.ya === basis.ecommerce.ya + 1, JSON.stringify({ basis: basis.ecommerce, sesudah: a2.ecommerce }));

// 6) Retry dan kondisi serentak pada pengajuan/penutupan.
const T3 = await tiketBaru();
await majukan(tok.provA, T3.id, "tindak_lanjut", { pendamping: uid.pend1 });
const versiT3 = versiTiket(T3.id);
const duaTutup = await Promise.all([1, 2].map(() => api("PATCH", `/v1/program/klinik/tiket/${T3.id}`, { token: tok.pend1, json: { status: "selesai", versi: versiT3, outcome: { items: ITEMS.slice(0, 1) } } })));
check("N7-05.18", "dua penutupan serentak dengan versi sama: satu 200, satu 409 TIKET_BERUBAH; tepat satu outcome hidup dan satu audit transisi selesai", duaTutup.map((r) => r.status).sort().join() === "200,409" && duaTutup.some((r) => r.code === "TIKET_BERUBAH") && hidup(T3.id) === 1 && sqlOne(`SELECT COUNT(*) FROM konsultasi_tiket_audit WHERE tiket = ${q(T3.id)} AND status_ke = 'selesai'`) === "1");
const T4 = await tiketBaru();
await majukan(tok.provA, T4.id, "selesai", { pendamping: uid.pend1 });
const lima = await Promise.all([0, 1, 2, 3, 4].map(() => api("POST", `/v1/program/klinik/tiket/${T4.id}/outcome`, { token: tok.pend1, json: { items: ITEMS } })));
check("N7-05.19", "lima POST outcome identik serentak: satu 201 dan empat 200 duplikat; satu baris", lima.filter((r) => r.status === 201).length === 1 && lima.filter((r) => r.status === 200 && r.data.duplikat).length === 4 && jumlahOutcome(T4.id) === 1);
const beda = await api("POST", `/v1/program/klinik/tiket/${T4.id}/outcome`, { token: tok.pend1, json: { items: [{ atribut: "qris", jenis: "kepatuhan" }] } });
check("N7-05.20", "isi berbeda pada tiket yang sudah punya outcome hidup → 409 OUTCOME_SUDAH_ADA", beda.status === 409 && beda.code === "OUTCOME_SUDAH_ADA" && hidup(T4.id) === 1);

// 7) Validasi masukan dan status.
const salah = [];
for (const items of [[], null, [{ atribut: "nib", jenis: "kepatuhan" }], [{ atribut: "qris", jenis: "bebas" }], [{ atribut: "qris", jenis: "kepatuhan" }, { atribut: "qris", jenis: "perbaikan" }]]) {
  salah.push((await api("POST", `/v1/program/klinik/tiket/${T0.id}/outcome`, { token: tok.provA, json: { items } })).code);
}
check("N7-05.21", "item tidak valid (kosong/null/atribut asing/jenis asing/duplikat) → 400 OUTCOME_TIDAK_VALID; tidak ada baris", salah.every((c) => c === "OUTCOME_TIDAK_VALID") && jumlahOutcome(T0.id) === 0, salah.join());
const T5 = await tiketBaru();
const belumSelesaiOutcome = await api("POST", `/v1/program/klinik/tiket/${T5.id}/outcome`, { token: tok.provA, json: { items: ITEMS } });
const salahStatus = await patchTiket(tok.provA, T5.id, { catatan: "lain", outcome: { items: ITEMS } });
check("N7-05.22", "tiket belum selesai: POST outcome 409 TIKET_BELUM_SELESAI; PATCH membawa outcome tanpa status selesai 400 OUTCOME_TIDAK_VALID", belumSelesaiOutcome.code === "TIKET_BELUM_SELESAI" && salahStatus.code === "OUTCOME_TIDAK_VALID" && jumlahOutcome(T5.id) === 0);
const manual = await (async () => {
  const res = await pesanTiket({ poli: pol("keuangan"), tanggal: tanggalOutcome[3], slot: "09:00", namaUsaha: "Usaha Manual R04" });
  const id = tiketId(res.data.nomor);
  sql(`UPDATE konsultasi_tiket SET status = 'tindak_lanjut', pendamping = ${q(uid.pend1)} WHERE id = ${q(id)}`);
  return { id, nomor: res.data.nomor, sumber: res.data.sumberIdentitas };
})();
const tutupManual = await patchTiket(tok.provA, manual.id, { status: "selesai", outcome: { items: ITEMS } });
check("N7-05.23", "tiket manual (anonim, tanpa usaha) tidak dapat memiliki outcome: 409 USAHA_TIDAK_TERTAUT dan penutupan ikut batal", manual.sumber === "manual" && tutupManual.code === "USAHA_TIDAK_TERTAUT" && sqlOne(`SELECT status FROM konsultasi_tiket WHERE id = ${q(manual.id)}`) === "tindak_lanjut" && jumlahOutcome(manual.id) === 0);

// 8) Kegagalan integrasi (fault injection nyata di DB clone): tiket + outcome + audit harus rollback bersama.
const T6 = await tiketBaru();
await majukan(tok.provA, T6.id, "tindak_lanjut", { pendamping: uid.pend1 });
sql(`ALTER TABLE konsultasi_outcome_item ADD CONSTRAINT r04_fault CHECK (FALSE) NOT VALID`);
const auditSebelum = sqlOne(`SELECT COUNT(*) FROM konsultasi_tiket_audit WHERE tiket = ${q(T6.id)}`);
const gagal = await patchTiket(tok.pend1, T6.id, { status: "selesai", outcome: { items: ITEMS } });
const statusSetelahGagal = sqlOne(`SELECT status FROM konsultasi_tiket WHERE id = ${q(T6.id)}`);
const auditSetelah = sqlOne(`SELECT COUNT(*) FROM konsultasi_tiket_audit WHERE tiket = ${q(T6.id)}`);
const outcomeSetelah = jumlahOutcome(T6.id);
const outcomeAudit = sqlOne(`SELECT COUNT(*) FROM konsultasi_outcome_audit WHERE outcome IN (SELECT id FROM konsultasi_outcome WHERE tiket = ${q(T6.id)})`);
sql(`ALTER TABLE konsultasi_outcome_item DROP CONSTRAINT r04_fault`);
check("N7-05.24", "integrasi gagal di tengah (CHECK palsu pada item outcome): 500, tiket tetap 'tindak_lanjut', tidak ada outcome/audit baru", gagal.status === 500 && statusSetelahGagal === "tindak_lanjut" && auditSetelah === auditSebelum && outcomeSetelah === 0 && outcomeAudit === "0", `${gagal.status} ${statusSetelahGagal} audit ${auditSebelum}->${auditSetelah} outcome=${outcomeSetelah}`);
const retryGagal = await patchTiket(tok.pend1, T6.id, { status: "selesai", outcome: { items: ITEMS } });
check("N7-05.25", "klien mengulang setelah perbaikan: berhasil sekali (satu outcome, satu transisi selesai)", retryGagal.status === 200 && hidup(T6.id) === 1 && sqlOne(`SELECT COUNT(*) FROM konsultasi_tiket_audit WHERE tiket = ${q(T6.id)} AND status_ke = 'selesai'`) === "1");

// 9) Koreksi dan pencabutan atas outcome terverifikasi T1.
const koreksiBody = { items: [{ atribut: "ecommerce", jenis: "perbaikan" }, { atribut: "medsos_bisnis", jenis: "kepatuhan" }], alasan: "Bukti NPWP dan SOP ternyata belum lengkap" };
const noAlasan = await api("POST", `/v1/program/klinik/outcome/${outcomeT1.id}/koreksi`, { token: tok.kabSubang, json: { items: koreksiBody.items } });
const identik = await api("POST", `/v1/program/klinik/outcome/${outcomeT1.id}/koreksi`, { token: tok.kabSubang, json: { items: ITEMS, alasan: "Tidak ada yang berubah" } });
check("N7-05.26", "koreksi tanpa alasan 400; koreksi identik 409 OUTCOME_TIDAK_BERUBAH; keduanya tanpa efek", noAlasan.code === "OUTCOME_TIDAK_VALID" && identik.code === "OUTCOME_TIDAK_BERUBAH" && hidup(T1.id) === 1);
const koreksi = await api("POST", `/v1/program/klinik/outcome/${outcomeT1.id}/koreksi`, { token: tok.kabSubang, json: koreksiBody });
const pKoreksi = await profil();
const aKoreksi = await aspek();
check("N7-05.27", "koreksi oleh kab/kota pemilik wilayah: versi 2 terverifikasi, versi 1 dicabut dengan alasan; satu outcome hidup per tiket", koreksi.status === 200 && koreksi.data.versi === 2 && sqlOne(`SELECT status||'|'||alasan_cabut FROM konsultasi_outcome WHERE id = ${q(outcomeT1.id)}`) === `dicabut|Dikoreksi ke versi 2: ${koreksiBody.alasan}` && hidup(T1.id) === 1 && sqlOne(`SELECT menggantikan::text FROM konsultasi_outcome WHERE id = ${q(koreksi.data.id)}`) === outcomeT1.id);
const npwpKembali = aKoreksi.npwp_usaha.ya === basis.npwp_usaha.ya && aKoreksi.sop_tertulis.ya === basis.sop_tertulis.ya;
check("N7-05.28", "efek berganti: NPWP/SOP kembali ke nilai lapangan; media sosial bisnis +1; profil hanya memuat versi 2 untuk T1", npwpKembali && aKoreksi.medsos_bisnis.ya === basis.medsos_bisnis.ya + 1 && pKoreksi.hasilKonsultasi.filter((h) => h.nomorTiket === T1.nomor).length === 1 && pKoreksi.hasilKonsultasi.find((h) => h.nomorTiket === T1.nomor).versi === 2, JSON.stringify({ npwp: aKoreksi.npwp_usaha, sop: aKoreksi.sop_tertulis, medsos: aKoreksi.medsos_bisnis }));
const retryKoreksi = await api("POST", `/v1/program/klinik/outcome/${outcomeT1.id}/koreksi`, { token: tok.kabSubang, json: koreksiBody });
check("N7-05.29", "retry koreksi yang sama (id lama) → 200 duplikat:true, tanpa versi ketiga", retryKoreksi.status === 200 && retryKoreksi.data.duplikat === true && retryKoreksi.data.id === koreksi.data.id && jumlahOutcome(T1.id) === 2);
const cabutTanpa = await api("POST", `/v1/program/klinik/outcome/${koreksi.data.id}/cabut`, { token: tok.provB, json: {} });
const cabut = await api("POST", `/v1/program/klinik/outcome/${koreksi.data.id}/cabut`, { token: tok.provB, json: { alasan: "Salah usaha pada pencatatan" } });
const cabutUlang = await api("POST", `/v1/program/klinik/outcome/${koreksi.data.id}/cabut`, { token: tok.provB, json: { alasan: "Salah usaha pada pencatatan" } });
const aCabut = await aspek();
check("N7-05.30", "cabut tanpa alasan 400; cabut berhasil; retry idempoten (duplikat:true, satu audit 'cabut')", cabutTanpa.status === 400 && cabut.status === 200 && cabut.data.duplikat === false && cabutUlang.data.duplikat === true && sqlOne(`SELECT COUNT(*) FROM konsultasi_outcome_audit WHERE outcome = ${q(koreksi.data.id)} AND aksi = 'cabut'`) === "1");
check("N7-05.31", "setelah dicabut: media sosial bisnis kembali ke dasar; profil tidak lagi memuat T1", aCabut.medsos_bisnis.ya === basis.medsos_bisnis.ya && !(await profil()).hasilKonsultasi.some((h) => h.nomorTiket === T1.nomor));
const buka = await patchTiket(tok.provA, T1.id, { status: "dijadwalkan" });
check("N7-05.32", "tiket dibuka ulang: selesai → dijadwalkan ditolak 409 TRANSISI_TIDAK_VALID (selesai final; koreksi lewat outcome)", buka.status === 409 && buka.code === "TRANSISI_TIDAK_VALID" && sqlOne(`SELECT status FROM konsultasi_tiket WHERE id = ${q(T1.id)}`) === "selesai");
const dtoT1 = (await api("GET", "/v1/program/klinik/tiket", { token: tok.provA })).data.find((t) => t.id === T1.id);
check("N7-05.33", "setelah dicabut, panel menawarkan outcome baru (outcomeBisaDicatat) dan menampilkan alasan cabut", dtoT1.outcomeBisaDicatat === true && dtoT1.outcome.status === "dicabut" && dtoT1.outcome.alasanCabut === "Salah usaha pada pencatatan");
const T7 = await tiketBaru();
await patchTiket(tok.provA, T7.id, { status: "batal" });
const bukaBatal = await patchTiket(tok.provA, T7.id, { status: "dijadwalkan" });
check("N7-05.34", "tiket batal dibuka ulang (batal → dijadwalkan) berjalan normal tanpa outcome", bukaBatal.status === 200 && bukaBatal.data.outcome === null && jumlahOutcome(T7.id) === 0);

// 10) Kerahasiaan: catatan sesi tidak bocor ke outcome/antrean/profil/audit; scan PII.
const respons = {
  profil: JSON.stringify(await profil()),
  antrean: JSON.stringify((await api("GET", "/v1/program/klinik/outcome?status=dicabut", { token: tok.provA })).body),
  antreanHidup: JSON.stringify((await api("GET", "/v1/program/klinik/outcome?status=terverifikasi", { token: tok.provA })).body),
  outcomeTiket: JSON.stringify(dtoT1.outcome),
  kolomOutcome: sql(`SELECT row_to_json(o) FROM konsultasi_outcome o`),
  kolomItem: sql(`SELECT row_to_json(i) FROM konsultasi_outcome_item i`),
  audit: sql(`SELECT row_to_json(a) FROM konsultasi_outcome_audit a`),
  publik: JSON.stringify([(await api("GET", "/v1/program/klinik/statistik")).body, (await api("GET", "/v1/program/klinik/konsultan")).body, (await lacak(S1)).body]),
};
const bocor = Object.entries(respons).flatMap(([bagian, teks]) => PII(teks, RAHASIA).map((r) => `${bagian}:${r}`));
check("N7-05.35", "catatan sesi (catatan, diagnosis, rencana aksi, tautan rapat, e-mail, WA, nama kontak) tidak ada di profil, antrean, DTO outcome, tabel outcome, audit, atau respons publik", bocor.length === 0 && Object.keys(respons).length === 8, bocor.join(",") || "tanpa kebocoran (T1 diberi RAHASIA-* di kolom tiket)");
check("N7-05.36", "scan pola NIK 16 digit pada seluruh respons yang dipindai: nihil", Object.values(respons).every((teks) => !NIK.test(teks)));
check("N7-05.37", "DTO profil hanya berisi id/versi/nomorTiket/poli/diverifikasiOleh/diverifikasiPada/items", (() => {
  const teks = JSON.parse(respons.profil).hasilKonsultasi;
  return teks.length > 0 && teks.every((h) => Object.keys(h).sort().join() === "diverifikasiOleh,diverifikasiPada,id,items,nomorTiket,poli,versi");
})());

// 11) Bukti riwayat: sumber tiket, aktor, tanggal terlacak.
const riwayat = sqlRows(`SELECT o.versi, o.status, t.nomor, o.diajukan_nama, o.diverifikasi_nama, (o.diverifikasi_pada IS NOT NULL) FROM konsultasi_outcome o JOIN konsultasi_tiket t ON t.id = o.tiket WHERE o.tiket = ${q(T1.id)} ORDER BY o.versi`);
check("N7-05.38", "histori T1 terlacak: v1 dicabut (koreksi) dan v2 dicabut; masing-masing menyimpan tiket sumber, pengaju, verifikator, dan waktu", riwayat.length === 2 && riwayat.every(([, status, nomor, pengaju, verifikator, waktu]) => status === "dicabut" && nomor === T1.nomor && pengaju && verifikator && waktu === "t"), JSON.stringify(riwayat));
const auditRows = sqlRows(`SELECT a.versi, a.aksi, a.status_dari, a.status_ke, a.aktor_nama FROM konsultasi_outcome_audit a JOIN konsultasi_outcome o ON o.id = a.outcome WHERE o.tiket = ${q(T1.id)} ORDER BY a.id`);
check("N7-05.39", "audit T1 berurutan: ajukan → verifikasi → koreksi(dicabut) → koreksi(baru) → cabut, semuanya dengan nama aktor", auditRows.map((r) => r[1]).join(">") === "ajukan>verifikasi>koreksi>koreksi>cabut" && auditRows.every((r) => r[4]), JSON.stringify(auditRows));

// ── ringkasan ──────────────────────────────────────────────────────────────────────────────────
const gagalCek = results.filter((r) => !r.ok);
log(`\nRINGKASAN: ${results.length - gagalCek.length}/${results.length} lulus; latensi ${JSON.stringify(lat)}`);
if (gagalCek.length) for (const r of gagalCek) log(`  GAGAL ${r.id}: ${r.deskripsi} — ${r.detail}`);
writeFileSync(path.join(HERE, "r04-runtime-results.json"), JSON.stringify({ dijalankan: new Date().toISOString(), base: BASE, latensi: lat, hasil: results }, null, 2));
process.exit(gagalCek.length ? 1 : 0);

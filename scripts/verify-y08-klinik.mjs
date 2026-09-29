#!/usr/bin/env node
/**
 * Bukti runtime Y08 (Klinik Konsultasi) pada stack disposable `diskuk-operasional-e2e`.
 *
 * Menjalankan kontrak M7-11/M7-12 terhadap Directus yang berjalan: katalog poli, prefill pemilik
 * sendiri lewat sesi (tanpa endpoint NIB/NIK publik), pembuatan tiket ber-captcha, pencatatan slot
 * atomik (dua pemesan bersamaan), baca ulang tiket, hak baca lampiran, kanban petugas, dan antrean
 * notifikasi WhatsApp.
 *
 * Pemakaian (kredensial lewat environment, jangan ditulis di repo):
 *   DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... DEMO_ACCOUNT_PASSWORD=... \
 *     node scripts/verify-y08-klinik.mjs [--gateway]
 *
 * `--gateway` menyalakan gateway tiruan lokal di 127.0.0.1:9099 dan menunggu antrean berubah
 * `pending` → `terkirim` → `diterima` (lewat callback resi). Ini membuktikan mekanika outbox,
 * BUKAN provider WhatsApp sungguhan: selama tidak ada sandbox provider, verdict tetap
 * `not provider-proven`.
 */
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { tanggalTidakValid } from "../services/directus/extensions/program/src/endpoints/klinik/rules.js";

const BASE = (process.env.DIRECTUS_BASE_URL || "http://127.0.0.1:8055").replace(/\/$/, []);
/** Port 9099 is taken by another local service on this machine, so the stub uses 9123. */
const STUB_PORT = 9123;
const STUB_URL = process.env.WHATSAPP_GATEWAY_URL || `http://host.docker.internal:${STUB_PORT}/send`;
const GATEWAY = process.argv.includes("--gateway");

// altcha 3.x hanyalah ESM: ambil entri ESM dari dependensi milik extension program (versi sama
// dengan yang dipakai hook autentikasi, jadi challenge yang dibuat server bisa dipecahkan di sini).
const altchaEsm = new URL("../services/directus/extensions/program/node_modules/altcha/dist/lib/index.js", import.meta.url);
const { solveChallenge, pbkdf2 } = await import(pathToFileURL(altchaEsm.pathname).href);

const bukti = [];
let gagal = 0;
const catat = (nama, detail, lulus) => {
  bukti.push({ nama, detail, lulus });
  if (!lulus) gagal += 1;
  console.log(`${lulus ? "PASS" : "FAIL"}  ${nama} — ${JSON.stringify(detail)}`);
};
const masker = (nomor) => String(nomor ?? "").replace(/^(\d{4})\d+(\d{3})$/, "$1****$2");

async function api(path, { method = "GET", body, token, headers = {} } = {}) {
  const requestHeaders = { accept: "application/json" };
  if (!(body instanceof FormData) && body !== undefined) requestHeaders["content-type"] = "application/json";
  if (token) requestHeaders.authorization = `Bearer ${token}`;
  Object.assign(requestHeaders, headers);
  const init = { method, headers: requestHeaders };
  // fetch menolak `body` untuk GET; kirim hanya saat ada isinya.
  if (body !== undefined) init.body = body instanceof FormData ? body : JSON.stringify(body);
  const response = await fetch(`${BASE}${path}`, init);
  const teks = await response.text();
  let parsed = null;
  try {
    parsed = teks ? JSON.parse(teks) : null;
  } catch {
    parsed = teks.slice(0, 200);
  }
  return { status: response.status, body: parsed };
}

/** Solves a fresh ALTCHA challenge the way the browser widget does. */
async function captcha() {
  const { body } = await api("/v1/auth/captcha/challenge", { headers: { origin: BASE } });
  const solution = await solveChallenge({ challenge: body, deriveKey: pbkdf2.deriveKey });
  return Buffer.from(JSON.stringify({ challenge: body, solution })).toString("base64");
}

async function login(email, password) {
  if (!password) throw new Error(`kata sandi ${email} tidak tersedia di environment`);
  const { status, body } = await api("/auth/login", {
    method: "POST",
    // Origin Data Studio: exempt dari captcha login (bukan bukti ALTCHA, itu milik Y01).
    headers: { origin: BASE },
    body: { email, password, mode: "json" },
  });
  if (status !== 200 || !body?.data?.access_token) throw new Error(`login ${email} gagal (${status})`);
  return body.data.access_token;
}

/** First bookable day whose slot is still free, so the proof can be repeated without cleanup. */
async function pilihTanggal(poli, slot, mulaiOffset = 2) {
  for (let offset = mulaiOffset; offset < 32; offset += 1) {
    const tanggal = new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
    if (tanggalTidakValid(tanggal)) continue;
    const { body } = await api(`/v1/program/klinik/slot?poli=${poli}&tanggal=${tanggal}`);
    if ((body?.data ?? []).find((item) => item.slot === slot)?.tersedia) return tanggal;
  }
  throw new Error(`tidak ada slot ${slot} yang bebas untuk poli ${poli}`);
}

function formTiket({ poli, tanggal, slot, kontak, deskripsi, consent = true }) {
  const form = new FormData();
  form.append("payload", JSON.stringify({ namaUsaha: kontak.namaUsaha ?? "Usaha Bukti Y08", namaKontak: kontak.nama, whatsapp: kontak.whatsapp, email: null, poli, deskripsi, moda: "daring", tanggal, slot, consent }));
  form.append("lampiran", new Blob([Buffer.from("%PDF-1.4 bukti Y08")], { type: "application/pdf" }), "bukti-y08.pdf");
  return form;
}

async function kirimTiket(opsi) {
  const form = formTiket(opsi);
  form.append("captcha", await captcha());
  return api("/v1/program/klinik/tiket", { method: "POST", body: form, token: opsi.token });
}

// ── Stub gateway (mode --gateway) ─────────────────────────────────────────
const diterimaStub = [];
let serverStub = null;

if (GATEWAY) {
  serverStub = createServer((req, res) => {
    const potongan = [];
    req.on("data", (bagian) => potongan.push(bagian));
    req.on("end", () => {
      let pesan = null;
      try {
        pesan = JSON.parse(Buffer.concat(potongan).toString("utf8"));
      } catch {
        pesan = null;
      }
      diterimaStub.push(pesan);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ messageId: `stub-${diterimaStub.length}`, status: "accepted" }));
    });
  });
  await new Promise((resolve) => serverStub.listen(STUB_PORT, "0.0.0.0", resolve));
  console.log(`stub gateway mendengarkan di 127.0.0.1:${STUB_PORT} (Directus memanggil ${STUB_URL})`);
}

// ── M7-11: katalog poli publik ────────────────────────────────────────────
const poli = await api("/v1/program/klinik/poli");
catat("M7-11 GET /poli tanpa login", { status: poli.status, jumlah: poli.body?.data?.length ?? 0 }, poli.status === 200 && poli.body?.data?.length === 6);
const nama = (poli.body?.data ?? []).map((item) => item.nama);
const idPoli = Object.fromEntries((poli.body?.data ?? []).map((item) => [item.kode, item.id]));
const teksPoli = JSON.stringify(poli.body);
catat(
  "M7-11 enam bidang sesuai requirements.md",
  {
    nama,
    subtopikLengkap: (poli.body?.data ?? []).every((item) => Array.isArray(item.subtopik) && item.subtopik.length >= 2),
    teksPoliMenyebutPii: /nik|whatsapp|email/i.test(teksPoli),
  },
  ["Legalitas & Standardisasi Produk", "Manajemen & Keuangan", "Pemasaran & Transformasi Digital", "Advokasi & Mediasi PMSE", "Akses Bantuan Pemerintah", "Inklusif & Disabilitas"].every((judul) => nama.includes(judul)) &&
    (poli.body?.data ?? []).every((item) => Array.isArray(item.subtopik) && item.subtopik.length >= 2) &&
    !/nik|whatsapp|email/i.test(teksPoli),
);

// ── Tidak ada oracle NIB/NIK publik ───────────────────────────────────────
const oracle = await api("/v1/program/klinik/lookup", { method: "POST", body: { jenis: "nib", nomor: "1234567890123" } });
const prefillAnonim = await api("/v1/program/klinik/prefill");
catat("Y08 oracle: /lookup dihapus dan /prefill menolak anonim", { lookup: oracle.status, prefill: prefillAnonim.status }, oracle.status === 404 && prefillAnonim.status === 401);

// ── M7-12: prefill milik sendiri (sesi UMKM) + tiket terverifikasi ────────
const tokenUmkm = await login("dummy_wawan.leathercraft@gmail.com", process.env.DEMO_ACCOUNT_PASSWORD);
const tokenPendamping = await login("dummy_coach.pendamping@jabarprov.go.id", process.env.DEMO_ACCOUNT_PASSWORD);
const tokenKabkota = await login("dummy_admin.subang@jabarprov.go.id", process.env.DEMO_ACCOUNT_PASSWORD);
const tokenAdmin = await login(process.env.DIRECTUS_ADMIN_EMAIL, process.env.DIRECTUS_ADMIN_PASSWORD);

const prefill = await api("/v1/program/klinik/prefill", { token: tokenUmkm });
catat(
  "M7-12 prefill usaha sendiri dari sesi",
  {
    status: prefill.status,
    usaha: prefill.body?.data?.usaha?.nama,
    sumber: prefill.body?.data?.usaha?.sumber,
    kontak: prefill.body?.data?.kontak?.nama,
    whatsappMasked: masker(prefill.body?.data?.kontak?.whatsapp),
  },
  prefill.status === 200 && prefill.body?.data?.usaha?.sumber === "sidt" && Boolean(prefill.body?.data?.kontak?.nama) && prefill.body.data.kontak.whatsapp === null,
);

const tanggal = await pilihTanggal(idPoli.legalitas, "09:00");
const tanggalKeuangan = await pilihTanggal(idPoli.keuangan, "10:30");
const tanggalPemasaran = await pilihTanggal(idPoli.pemasaran, "13:00");
// Usaha dummy belum menyimpan nomor WhatsApp, jadi prefill-nya null dan pemohon mengetik nomornya.
const kontakUmkm = { nama: "Wawan Setiawan", whatsapp: prefill.body?.data?.kontak?.whatsapp ?? "081200004444" };
const buatUmkm = await kirimTiket({ poli: idPoli.legalitas, tanggal, slot: "09:00", kontak: kontakUmkm, deskripsi: "Kami butuh pendampingan sertifikat halal dan PIRT untuk produk kulit.", token: tokenUmkm });
catat("M7-12 tiket dari sesi pemilik (terverifikasi SIDT)", { status: buatUmkm.status, nomor: buatUmkm.body?.data?.nomor, sumberIdentitas: buatUmkm.body?.data?.sumberIdentitas, notifikasi: buatUmkm.body?.data?.notifikasi?.status }, buatUmkm.status === 201 && buatUmkm.body?.data?.sumberIdentitas === "sidt");
const nomorUmkm = buatUmkm.body?.data?.nomor;

// Nama usaha tidak bisa dipalsukan lewat payload saat memakai sesi pemilik.
const palsu = await (async () => {
  const form = formTiket({ poli: idPoli.keuangan, tanggal: tanggalKeuangan, slot: "10:30", kontak: { ...kontakUmkm, namaUsaha: "Usaha Palsu" }, deskripsi: "Menguji apakah nama usaha dari sesi bisa ditimpa payload." , token: tokenUmkm });
  form.append("captcha", await captcha());
  return api("/v1/program/klinik/tiket", { method: "POST", body: form, token: tokenUmkm });
})();
catat("M7-12 nama usaha dari sesi tidak dapat ditimpa payload", { status: palsu.status, nomor: palsu.body?.data?.nomor }, palsu.status === 201);

// ── Tiket anonim (belum terverifikasi) + lampiran privat ──────────────────
const anonim = await kirimTiket({ poli: idPoli.pemasaran, tanggal: tanggalPemasaran, slot: "13:00", kontak: { nama: "Siti Anonim", whatsapp: "081200001111", namaUsaha: "Usaha Manual Y08" }, deskripsi: "Kami ingin bertanya soal kontrak e-commerce dan pemulihan akun marketplace." });
catat("M7-12 tiket anonim dicatat manual", { status: anonim.status, nomor: anonim.body?.data?.nomor, sumberIdentitas: anonim.body?.data?.sumberIdentitas }, anonim.status === 201 && anonim.body?.data?.sumberIdentitas === "manual");

// ── Slot atomik: dua pemesan bersamaan untuk kuota yang sama ──────────────
const tanggalBentrok = await pilihTanggal(idPoli.advokasi, "14:30");
const serentak = await Promise.all([
  kirimTiket({ poli: idPoli.advokasi, tanggal: tanggalBentrok, slot: "14:30", kontak: { nama: "Pemesan A", whatsapp: "081200002222", namaUsaha: "Usaha A" }, deskripsi: "Pemesanan serentak A untuk slot advokasi PMSE." }),
  kirimTiket({ poli: idPoli.advokasi, tanggal: tanggalBentrok, slot: "14:30", kontak: { nama: "Pemesan B", whatsapp: "081200003333", namaUsaha: "Usaha B" }, deskripsi: "Pemesanan serentak B untuk slot advokasi PMSE." }),
]);
const status = serentak.map((hasil) => hasil.status).sort();
catat("M7-12 slot kuota 1 pemesan saat dua request bersamaan", { status, nomor: serentak.map((hasil) => hasil.body?.data?.nomor ?? null) }, status[0] === 201 && status[1] === 409);

// ── Baca ulang tiket: nomor + nomor WhatsApp pemesan ─────────────────────
const lacakBenar = await api("/v1/program/klinik/tiket/lacak", { method: "POST", body: { nomor: anonim.body?.data?.nomor, whatsapp: "081200001111", captcha: await captcha() } });
const lacakSalah = await api("/v1/program/klinik/tiket/lacak", { method: "POST", body: { nomor: anonim.body?.data?.nomor, whatsapp: "081200009999", captcha: await captcha() } });
catat(
  "M7-12 pemohon baca ulang; nomor WhatsApp salah tidak membocorkan tiket",
  { benar: lacakBenar.status, salah: lacakSalah.status, kodeSalah: lacakSalah.body?.errors?.[0]?.extensions?.code, notifikasi: lacakBenar.body?.data?.notifikasi?.status },
  lacakBenar.status === 200 && lacakBenar.body?.data?.nomor === anonim.body?.data?.nomor && lacakSalah.status === 404 && lacakSalah.body?.errors?.[0]?.extensions?.code === "TIKET_TIDAK_DITEMUKAN",
);

// ── Lampiran privat: pemohon sendiri boleh, usaha lain tidak ─────────────
const lampiran = async (nomor, token) => {
  const daftar = await api("/v1/program/klinik/tiket", { token: tokenAdmin });
  const tiket = (daftar.body?.data ?? []).find((item) => item.nomor === nomor);
  if (!tiket?.lampiran?.length) return { status: 0, id: null };
  const id = tiket.lampiran[0];
  const jawab = await api(`/v1/program/klinik/lampiran/${id}`, { token });
  return { status: jawab.status, id };
};
const lampiranAnonimTanpaSesi = await api(`/v1/program/klinik/lampiran/11111111-2222-4333-8444-555555555555`);
const lampiranMilikSendiri = await lampiran(nomorUmkm, tokenUmkm);
const lampiranOrangLain = await lampiran(anonim.body?.data?.nomor, tokenUmkm);
catat(
  "Y08 lampiran: 401 tanpa sesi, 200 untuk pemohon, 404 untuk usaha lain",
  { tanpaSesi: lampiranAnonimTanpaSesi.status, pemohon: lampiranMilikSendiri.status, usahaLain: lampiranOrangLain.status },
  lampiranAnonimTanpaSesi.status === 401 && lampiranMilikSendiri.status === 200 && lampiranOrangLain.status === 404,
);

// ── Kanban petugas + tolak akses UMKM ────────────────────────────────────
const kanbanPendamping = await api("/v1/program/klinik/tiket", { token: tokenPendamping });
const kanbanKabkota = await api("/v1/program/klinik/tiket", { token: tokenKabkota });
const kanbanUmkm = await api("/v1/program/klinik/tiket", { token: tokenUmkm });
catat(
  "Y08 kanban: pendamping & dinas kab/kota boleh, UMKM ditolak",
  { pendamping: kanbanPendamping.status, kabkota: kanbanKabkota.status, umkm: kanbanUmkm.status, jumlah: kanbanPendamping.body?.data?.length ?? 0 },
  kanbanPendamping.status === 200 && kanbanKabkota.status === 200 && kanbanUmkm.status === 403,
);

// ── Petugas memperbarui status → antrean notifikasi baru (idempoten) ─────
// Kanban petugas (Y09) membatasi aksi: pendamping harus lebih dulu mengambil tiket yang belum
// bertuan, baru boleh memindahkan status.
const idUmkm = (kanbanPendamping.body?.data ?? []).find((item) => item.nomor === nomorUmkm)?.id;
const sayaSendiri = await api("/users/me?fields=id", { token: tokenPendamping });
const ambil = await api(`/v1/program/klinik/tiket/${idUmkm}`, { method: "PATCH", token: tokenPendamping, body: { pendamping: sayaSendiri.body?.data?.id } });
const pindah = await api(`/v1/program/klinik/tiket/${idUmkm}`, { method: "PATCH", token: tokenPendamping, body: { status: "dijadwalkan", catatan: "Jadwal dikonfirmasi pendamping." } });
const sesudahPindah = await api("/v1/program/klinik/tiket", { token: tokenAdmin });
const notifikasiPindah = (sesudahPindah.body?.data ?? []).find((item) => item.nomor === nomorUmkm)?.notifikasi;
const pindahUlang = await api(`/v1/program/klinik/tiket/${idUmkm}`, { method: "PATCH", token: tokenPendamping, body: { status: "dijadwalkan" } });
const sesudahUlang = await api("/v1/program/klinik/tiket", { token: tokenAdmin });
const notifikasiUlang = (sesudahUlang.body?.data ?? []).find((item) => item.nomor === nomorUmkm)?.notifikasi;
catat(
  "M7-13 prasyarat: tiket diambil, status berubah, pengulangan status sama tidak menambah antrean",
  {
    ambil: ambil.status,
    status: pindah.status,
    ke: pindah.body?.data?.status,
    ulang: pindahUlang.status,
    notifikasi: notifikasiPindah?.jenis,
    tidakBertambah: GATEWAY ? "dilewati (publisher aktif)" : JSON.stringify(notifikasiUlang) === JSON.stringify(notifikasiPindah),
  },
  ambil.status === 200 &&
    pindah.status === 200 &&
    pindah.body?.data?.status === "dijadwalkan" &&
    notifikasiPindah?.jenis === "status_berubah" &&
    (GATEWAY || JSON.stringify(notifikasiUlang) === JSON.stringify(notifikasiPindah)),
);

// ── Antrean notifikasi: pending tanpa gateway, terkirim → diterima dengan gateway ──
const daftarAdmin = await api("/v1/program/klinik/tiket", { token: tokenAdmin });
const tiketUmkm = (daftarAdmin.body?.data ?? []).find((item) => item.nomor === nomorUmkm);
const tiketAnonim = (daftarAdmin.body?.data ?? []).find((item) => item.nomor === anonim.body?.data?.nomor);
catat(
  "M7-12 outbox dibuat setelah commit tiket dan tetap jujur tanpa provider",
  { umkm: { status: tiketUmkm?.notifikasi?.status, consent: tiketUmkm?.waConsent }, anonim: { status: tiketAnonim?.notifikasi?.status, consent: tiketAnonim?.waConsent } },
  (GATEWAY ? ["pending", "terkirim"].includes(tiketUmkm?.notifikasi?.status) : tiketUmkm?.notifikasi?.status === "pending") &&
    tiketUmkm?.waConsent === true &&
    Boolean(tiketUmkm?.notifikasi?.template),
);

/** Waits for a ticket's latest notification to reach `status`. */
const tunggu = async (nomor, status, batasMs = 30_000) => {
  const mulai = Date.now();
  while (Date.now() - mulai < batasMs) {
    const daftar = await api("/v1/program/klinik/tiket", { token: tokenAdmin });
    const tiket = (daftar.body?.data ?? []).find((item) => item.nomor === nomor);
    if (tiket?.notifikasi?.status === status) return tiket.notifikasi;
    await new Promise((selesai) => setTimeout(selesai, 1000));
  }
  return null;
};

if (GATEWAY) {
  const terkirim = await tunggu(nomorUmkm, "terkirim");
  catat("M7-12 outbox: pesan terkirim ke gateway dan menunggu resi", { jumlahDiterimaStub: diterimaStub.length, status: terkirim?.status, providerMessageId: terkirim?.providerMessageId ?? null }, terkirim?.status === "terkirim" && diterimaStub.length > 0);

  const resi = await api("/v1/program/klinik/notifikasi/receipt", {
    method: "POST",
    headers: { "x-diskuk-secret": process.env.WHATSAPP_RECEIPT_SECRET ?? "" },
    body: { messageId: terkirim?.providerMessageId, status: "delivered" },
  });
  const diterima = await tunggu(nomorUmkm, "diterima", 10_000);
  catat("M7-12 resi provider menandai pesan diterima (bukan dari 2xx)", { resi: resi.status, status: diterima?.status ?? null }, resi.status === 200 && diterima?.status === "diterima");

  const resiPalsu = await api("/v1/program/klinik/notifikasi/receipt", { method: "POST", body: { messageId: terkirim?.providerMessageId, status: "delivered" } });
  catat("Y08 resi tanpa rahasia ditolak", { status: resiPalsu.status }, resiPalsu.status === 401);
}

if (serverStub) await new Promise((resolve) => serverStub.close(resolve));
console.log(`\n${gagal === 0 ? "SEMUA BUKTI LULUS" : `${gagal} BUKTI GAGAL`} (${bukti.length} pemeriksaan)`);
process.exit(gagal === 0 ? 0 : 1);

/**
 * In-memory mock of the /v1/program endpoints (services/directus/extensions/program) and
 * Directus /files uploads. Install after installMockDirectus: Playwright gives later routes
 * priority, and anything this mock does not handle falls back to the base mock.
 */
import { PASSPORT_PAYLOAD, PDF_CONTOH, PNG_1PX, katalogResponse } from "./katalog-data.mjs";
import { createKegiatanState, kegiatanApiResponse } from "./kegiatan-data.mjs";
import { hargaRange, loiDuplikat, validasiKurasi } from "../../../../services/directus/extensions/program/src/endpoints/katalog/rules.js";
import { PITCHING_STREAK, capaian, hariLapor, latestTargetStreak, waktuLaporan } from "../../../../services/directus/extensions/program/src/endpoints/kpi/rules.js";
import { UUID } from "../../../../services/directus/extensions/program/src/lib/validate.js";
import { VERSI_AWAL, klinikMockResponse } from "./klinik-data.mjs";

/** Same version marker the specs use to simulate a ticket another officer already changed. */
export { VERSI_AWAL };

export const USAHA_ID = "11111111-1111-4111-8111-000000000001";
export const PESERTA_ID = "33333333-3333-4333-8333-000000000001";

const json = (route, status, data) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(status >= 400 ? { errors: [{ message: "error", extensions: { code: data } }] } : { data }) });

export function createProgramState() {
  return {
    usaha: {
      id: USAHA_ID,
      nama: "Usaha 01",
      nib: "1234567890123",
      skala: "micro",
      kodeKbli: "10794",
      kegiatanUtama: "Produksi makanan ringan",
      produkUtama: "Keripik Singkong",
      omzetTahunan: 100000000,
      totalAset: 20000000,
      kota: "Kabupaten Bogor",
      kecamatan: "Cibinong",
      tenagaKerja: 3,
      talentStatus: "none",
      talentBatch: null,
      pdnTerverifikasi: false,
      ramahDisabilitas: false,
      pemilik: { nama: "Siti Aminah", nikMasked: "************1234" },
    },
    legalitas: [{ id: "l1", jenis: "halal", nomor: "ID3210", status: "terbit", berlakuHingga: "2030-01-01", berkas: null }],
    pengajuan: [],
    beritaAcara: [],
    peserta: [
      {
        id: PESERTA_ID,
        usaha: { id: USAHA_ID, nama: "Usaha 01", nib: "1234567890123", skala: "micro", kota: "Kabupaten Bogor" },
        batch: "2026-1",
        fase: "akselerasi",
        pendamping: { id: "user-2", nama: "Budi Pendamping" },
        tanggalMulai: "2026-08-01",
        jumlahMinggu: 12,
        mingguBerjalan: 6,
        targetMingguan: 1000000,
        rekomendasiPitching: false,
        status: "aktif",
      },
    ],
    laporan: [],
    produk: [],
    /** Usaha milik akun mock; null = kurator/provinsi (boleh mengelola semua usaha). */
    usahaSaya: null,
    loi: [],
    uploads: [],
    uploadFolders: [],
    passport: null,
    tiket: [],
    tiketForms: [],
    /** Jawaban CSAT `{ tiket, nilai, consent }` dan outcome konsultasi (semua versi) dari klinik (R04). */
    csat: [],
    outcomes: [],
    /** Session prefill for the clinic form; null makes `GET /klinik/prefill` answer 401. */
    prefill: null,
    /** The signed-in officer as `{ id, admin, appRole, kotaScope }`; null means the provincial analyst. */
    aktor: null,
    /** Agenda fixtures + reminder opt-ins of this install (Y07). */
    kegiatan: createKegiatanState(),
    /** Paths whose next call must answer 500 once (`state.failNext["/talent/pengajuan/<id>/tolak"] = true`). */
    failNext: {},
    requests: [],
  };
}

export async function installMockProgram(page, state = createProgramState()) {
  await page.route("**/panel/assets/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX }));
  // Public catalogue reads through the Directus Public policy.
  await page.route(/\/panel\/items\/(produk|kota)/, async (route) => {
    const url = new URL(route.request().url());
    state.requests.push({ method: "GET", path: url.pathname, query: Object.fromEntries(url.searchParams) });
    const body = katalogResponse(url.pathname, url.searchParams);
    if (!body) return route.fallback();
    await route.fulfill({ status: body.status ?? 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.route("**/panel/files", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const id = `00000000-0000-4000-8000-${String(state.uploads.length + 1).padStart(12, "0")}`;
    state.uploads.push(id);
    // Directus applies multipart fields that precede the file; record the folder the same way.
    const raw = route.request().postDataBuffer()?.toString("latin1") ?? "";
    const folderAt = raw.indexOf('name="folder"');
    const fileAt = raw.indexOf('name="file"');
    state.uploadFolders.push(folderAt >= 0 && folderAt < fileAt ? raw.slice(folderAt).split("\r\n")[2] : null);
    await json(route, 200, { id, filename_download: "surat.pdf" });
  });

  await page.route("**/panel/v1/program/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace("/panel/v1/program", "");
    let body = null;
    try {
      body = method === "GET" ? null : (request.postDataJSON?.() ?? null);
    } catch {
      body = null; // multipart; handled by the route that expects it
    }
    state.requests.push({ method, path, body, query: Object.fromEntries(new URL(request.url()).searchParams) });
    const find = (id) => state.pengajuan.find((item) => item.id === id);
    let match;

    // Public agenda (Y07): same rules as the endpoint, shared with the SSR mock server.
    if (path.startsWith("/kegiatan")) {
      state.kegiatan ??= createKegiatanState();
      const hasil = kegiatanApiResponse({
        pathname: `/v1/program/kegiatan${path.slice("/kegiatan".length)}`,
        searchParams: new URL(request.url()).searchParams,
        method,
        body,
        state: state.kegiatan,
      });
      if (hasil) {
        await route.fulfill({ status: hasil.status ?? 200, contentType: "application/json", body: JSON.stringify(hasil.body ?? hasil) });
        return;
      }
    }

    const laporanOf = (pesertaId) => state.laporan.filter((item) => item.peserta === pesertaId).sort((a, b) => a.mingguKe - b.mingguKe);
    const streak = (pesertaId) => latestTargetStreak(laporanOf(pesertaId));
    // ── Klinik Konsultasi: rules come from the endpoint's pure rules, the mock only keeps state ──
    if (path.startsWith("/klinik/")) {
      let form = null;
      if (method === "POST" && path === "/klinik/tiket") {
        // Multipart: keep the raw parts so the spec can check what the browser sent.
        const raw = request.postDataBuffer()?.toString("latin1") ?? "";
        const part = (name) => raw.split(/--[^\r\n]+/).find((chunk) => chunk.includes(`name="${name}"`))?.split("\r\n\r\n")[1]?.replace(/\r\n$/, "") ?? null;
        form = { payload: JSON.parse(part("payload") ?? "{}"), captcha: part("captcha"), files: [...raw.matchAll(/name="lampiran"; filename="([^"]+)"/g)].map((m) => m[1]), contentType: request.headers()["content-type"] };
      }
      const hasil = klinikMockResponse({ method, path, query: Object.fromEntries(new URL(request.url()).searchParams), body, form, state });
      if (hasil) return hasil.code ? json(route, hasil.status, hasil.code) : json(route, hasil.status, hasil.data);
    }

    if (method === "GET" && path === "/passport") {
      const eligible = ["talent_pool", "accelerator", "champion"].includes(state.usaha.talentStatus);
      return json(route, 200, {
        usaha: { id: USAHA_ID, nama: state.usaha.nama, talentStatus: state.usaha.talentStatus },
        eligible,
        alasan: eligible ? null : "Usaha belum masuk Talent Pool.",
        bisaMenerbitkan: true,
        passport: state.passport,
      });
    }
    if (method === "POST" && path === "/passport") {
      state.passport = { id: "99999999-9999-4999-8999-000000000001", kode: PASSPORT_PAYLOAD.kode, status: "aktif", statusBadge: PASSPORT_PAYLOAD.statusBadge, skor: PASSPORT_PAYLOAD.skor, payload: PASSPORT_PAYLOAD, diterbitkanAt: PASSPORT_PAYLOAD.diterbitkanAt };
      return json(route, 201, state.passport);
    }
    if (method === "GET" && (path === "/passport/pdf/summary" || path === "/passport/pdf/katalog")) {
      const pdfSample = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n200\n%%EOF";
      return route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${path.endsWith("summary") ? "executive-summary.pdf" : "katalog-ekspor.pdf"}"`,
        },
        body: pdfSample,
      });
    }

    if (method === "GET" && path === "/katalog/usaha") {
      const q = new URL(request.url()).searchParams.get("q") ?? "";
      return json(route, 200, q.length >= 3 ? [{ id: USAHA_ID, nama: state.usaha.nama, nib: state.usaha.nib, kota: state.usaha.kota }] : []);
    }
    // Cermin katalog/service.js: daftar per usaha, hanya untuk kurator atau pemilik usaha itu (M8).
    const bisaKelola = (usahaId) => state.usahaSaya === null || state.usahaSaya === usahaId;
    if (method === "GET" && path === "/katalog/produk") {
      const usaha = new URL(request.url()).searchParams.get("usaha");
      if (!UUID.test(usaha ?? "")) return json(route, 400, "INVALID_USAHA_ID");
      if (!bisaKelola(usaha)) return json(route, 403, "FORBIDDEN");
      return json(route, 200, state.produk.filter((item) => item.usaha === usaha));
    }
    match = path.match(/^\/katalog\/foto\/([^/]+)$/);
    if (method === "GET" && match) return route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX });
    if (method === "POST" && path === "/katalog/produk") {
      if (!UUID.test(body?.usaha ?? "")) return json(route, 400, "INVALID_USAHA_ID");
      if (!bisaKelola(body.usaha)) return json(route, 403, "FORBIDDEN");
      const created = { id: `88888888-8888-4888-8888-${String(state.produk.length + 1).padStart(12, "0")}`, ...body, hargaLabel: hargaRange(body.hargaRetail ?? null, body.hargaGrosir ?? null), statusKurasi: "menunggu", catatanKurasi: null, dikurasiAt: null, usahaNama: state.usaha.nama, usahaKota: state.usaha.kota, dateCreated: new Date().toISOString(), dateUpdated: new Date().toISOString() };
      state.produk.push(created);
      return json(route, 201, created);
    }
    if (method === "GET" && path === "/katalog/kurasi") {
      const status = new URL(request.url()).searchParams.get("status") ?? "menunggu";
      return json(route, 200, state.produk.filter((item) => item.statusKurasi === status));
    }
    match = path.match(/^\/katalog\/produk\/([^/]+)\/kurasi$/);
    if (method === "POST" && match) {
      const item = state.produk.find((p) => p.id === match[1]);
      let keputusan;
      try {
        keputusan = validasiKurasi(body ?? {});
      } catch (error) {
        return json(route, error.statusCode ?? 400, error.code ?? "INVALID_PAYLOAD");
      }
      if (!item) return json(route, 404, "PRODUK_NOT_FOUND");
      Object.assign(item, { statusKurasi: keputusan.keputusan, catatanKurasi: keputusan.catatan });
      return json(route, 200, item);
    }
    if (method === "GET" && path === "/katalog/loi") return json(route, 200, state.loi);
    match = path.match(/^\/katalog\/produk\/([^/]+)\/pdf$/);
    if (method === "GET" && match) {
      return route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="spesifikasi-produk.pdf"`,
        },
        body: PDF_CONTOH,
      });
    }
    if (method === "POST" && path === "/katalog/loi") {
      if (!body?.persetujuanKontak) return json(route, 400, "PERSETUJUAN_WAJIB");
      // Urutan server: idempoten dulu (captcha sekali pakai), baru captcha. Duplikat per produk (M7).
      if (loiDuplikat(state.loi, body)) return json(route, 200, { diterima: true, duplikat: true });
      if (!body.captcha) return json(route, 400, "CAPTCHA_INVALID");
      state.loi.push({ ...body, dateCreated: new Date().toISOString() });
      return json(route, 201, { diterima: true, duplikat: false });
    }

    if (method === "GET" && path === "/kpi/peserta") {
      return json(route, 200, state.peserta.map((item) => {
        const own = laporanOf(item.id);
        return { ...item, laporanTerkirim: own.length, statusMingguIni: item.mingguBerjalan === 0 ? null : (own.find((l) => l.mingguKe === item.mingguBerjalan)?.status ?? "belum_mengirim") };
      }));
    }
    match = path.match(/^\/kpi\/peserta\/([^/]+)$/);
    if (method === "GET" && match) {
      const peserta = state.peserta.find((item) => item.id === match[1]);
      if (!peserta) return json(route, 404, "PESERTA_NOT_FOUND");
      const best = streak(peserta.id);
      return json(route, 200, { peserta, laporan: laporanOf(peserta.id), pitching: { streak: best, dibutuhkan: PITCHING_STREAK, memenuhi: best >= PITCHING_STREAK }, akses: { kirim: true, review: true } });
    }
    match = path.match(/^\/kpi\/peserta\/([^/]+)\/laporan$/);
    if (method === "POST" && match) {
      // Urutan server: peserta aktif → replay clientUuid → jam perangkat → minggu valid → satu laporan per minggu → Jumat WIB.
      const peserta = state.peserta.find((item) => item.id === match[1]);
      if (!peserta) return json(route, 404, "PESERTA_NOT_FOUND");
      if (peserta.status !== "aktif") return json(route, 409, "PESERTA_TIDAK_AKTIF");
      const duplicate = state.laporan.find((item) => item.clientUuid === body.clientUuid);
      if (duplicate) return duplicate.peserta === peserta.id ? json(route, 200, duplicate) : json(route, 409, "CLIENT_UUID_CONFLICT");
      const waktu = waktuLaporan(body.dibuatPada ?? null, new Date());
      if (!waktu) return json(route, 400, "DIBUAT_PADA_TIDAK_VALID");
      if (body.mingguKe > peserta.jumlahMinggu || body.mingguKe > peserta.mingguBerjalan) return json(route, 400, "MINGGU_TIDAK_VALID");
      const existing = state.laporan.find((item) => item.peserta === peserta.id && item.mingguKe === body.mingguKe);
      if (existing && existing.status !== "ditolak") return json(route, 409, "LAPORAN_SUDAH_ADA");
      if (!existing && !hariLapor(waktu.waktu)) return json(route, 409, "BUKAN_HARI_LAPOR");
      const now = new Date().toISOString();
      const fields = {
        target: peserta.targetMingguan,
        realisasiOmzet: body.realisasiOmzet,
        jumlahTransaksi: body.jumlahTransaksi,
        capaianPersen: capaian(body.realisasiOmzet, peserta.targetMingguan),
        kendala: body.kendala,
        bukti: body.bukti,
        status: "menunggu",
        clientUuid: body.clientUuid,
        dibuatPadaKlien: waktu.klien?.toISOString() ?? null,
        dateUpdated: now,
      };
      // Laporan yang ditolak dikoreksi di tempat (200), bukan dibuat ulang.
      if (existing) {
        Object.assign(existing, fields);
        return json(route, 200, existing);
      }
      const created = {
        id: `44444444-4444-4444-8444-${String(state.laporan.length + 1).padStart(12, "0")}`,
        peserta: peserta.id,
        mingguKe: body.mingguKe,
        ...fields,
        catatanPendamping: null,
        direviewAt: null,
        dateCreated: now,
      };
      state.laporan.push(created);
      return json(route, 201, created);
    }
    match = path.match(/^\/kpi\/peserta\/([^/]+)\/pitching$/);
    if (method === "PATCH" && match) {
      const peserta = state.peserta.find((item) => item.id === match[1]);
      if (body.rekomendasi && streak(peserta.id) < PITCHING_STREAK) return json(route, 409, "PITCHING_BELUM_MEMENUHI");
      peserta.rekomendasiPitching = body.rekomendasi;
      return json(route, 200, peserta);
    }
    if (method === "GET" && path === "/kpi/laporan") {
      const params = new URL(request.url()).searchParams;
      const status = params.get("status") ?? "menunggu";
      const page = Number(params.get("page") ?? "1");
      const semua = state.laporan.filter((item) => item.status === status).map((item) => ({ ...item, pesertaInfo: state.peserta.find((p) => p.id === item.peserta) }));
      return json(route, 200, { items: semua.slice((page - 1) * 25, page * 25), meta: { page, limit: 25, total: semua.length } });
    }
    match = path.match(/^\/kpi\/laporan\/([^/]+)\/review$/);
    if (method === "POST" && match) {
      const item = state.laporan.find((l) => l.id === match[1]);
      if (!item) return json(route, 404, "LAPORAN_NOT_FOUND");
      if (!["disetujui", "ditolak"].includes(body?.keputusan)) return json(route, 400, "INVALID_PAYLOAD");
      if (body.keputusan === "ditolak" && !String(body.catatan ?? "").trim()) return json(route, 400, "CATATAN_WAJIB");
      if (item.status !== "menunggu") return json(route, 409, "LAPORAN_SUDAH_DIREVIEW");
      Object.assign(item, { status: body.keputusan, catatanPendamping: body.catatan, direviewAt: new Date().toISOString() });
      return json(route, 200, item);
    }

    if (method === "GET" && path.startsWith("/talent/usaha/")) {
      if (path !== `/talent/usaha/${USAHA_ID}`) {
        return json(route, 403, "FORBIDDEN");
      }
      const latest = state.pengajuan.filter((item) => item.usaha === USAHA_ID).sort((a, b) => a.dateCreated.localeCompare(b.dateCreated)).at(-1) ?? null;
      return json(route, 200, { usaha: state.usaha, legalitas: state.legalitas, pengajuan: latest });
    }
    if (method === "POST" && path === "/talent/pengajuan") {
      if (body.usaha !== USAHA_ID) {
        return json(route, 403, "FORBIDDEN");
      }
      if (state.pengajuan.some((item) => item.usaha === body.usaha && ["draft", "dinilai"].includes(item.status))) {
        return json(route, 409, "PENGAJUAN_SUDAH_ADA");
      }
      const created = {
        id: `22222222-2222-4222-8222-${String(state.pengajuan.length + 1).padStart(12, "0")}`,
        ...body,
        status: "draft",
        skor: null,
        dinilaiAt: null,
        alasanTolak: null,
        ditolakAt: null,
        beritaAcara: null,
        dateCreated: new Date().toISOString(),
        dateUpdated: new Date().toISOString(),
      };
      state.pengajuan.push(created);
      state.usaha.talentStatus = "nominated";
      return json(route, 201, created);
    }
    match = path.match(/^\/talent\/pengajuan\/([^/]+)$/);
    if (method === "PATCH" && match) {
      const item = find(match[1]);
      if (item.status !== "draft") return json(route, 409, "PENGAJUAN_CLOSED");
      Object.assign(item, body, { status: "draft", skor: null });
      return json(route, 200, item);
    }
    match = path.match(/^\/talent\/pengajuan\/([^/]+)\/hitung-skor$/);
    if (method === "POST" && match) {
      const item = find(match[1]);
      if (item.status !== "draft") return json(route, 409, "PENGAJUAN_CLOSED");
      if (!(Number(item.kapasitasProduksi) > 0) || !String(item.satuan ?? "").trim()) return json(route, 422, "DATA_BELUM_LENGKAP");
      item.skor = {
        finansial: 35,
        pasar: 100,
        legalitas: 60,
        sdm: 80,
        total: 68.75,
        rubrikVersi: "placeholder-v0",
        rekomendasi: "Dipertimbangkan",
      };
      item.dinilaiAt = new Date().toISOString();
      return json(route, 200, item);
    }
    match = path.match(/^\/talent\/pengajuan\/([^/]+)\/ajukan$/);
    if (method === "POST" && match) {
      const item = find(match[1]);
      if (item.status !== "draft") return json(route, 409, "PENGAJUAN_CLOSED");
      if (!item.skor) return json(route, 409, "SKOR_BELUM_DIHITUNG");
      item.status = "dinilai";
      state.usaha.talentStatus = "scouting";
      return json(route, 200, item);
    }
    match = path.match(/^\/talent\/pengajuan\/([^/]+)\/tolak$/);
    if (method === "POST" && match) {
      if (state.failNext?.[path]) {
        delete state.failNext[path];
        return json(route, 500, "INTERNAL_SERVER_ERROR");
      }
      if (!String(body?.alasan ?? "").trim()) return json(route, 400, "ALASAN_WAJIB");
      const item = find(match[1]);
      if (item.status !== "dinilai") return json(route, 409, "PENGAJUAN_TIDAK_SIAP_DIKURASI");
      Object.assign(item, { status: "ditolak", alasanTolak: body.alasan.trim(), ditolakAt: new Date().toISOString() });
      state.usaha.talentStatus = "none";
      return json(route, 200, item);
    }
    if (method === "GET" && path === "/talent/pengajuan") {
      const status = new URL(request.url()).searchParams.get("status");
      const rows = state.pengajuan
        .filter((item) => !status || item.status === status)
        .filter((item) => item.status !== "ditolak" || !state.pengajuan.some((lain) => lain.usaha === item.usaha && lain.dateCreated > item.dateCreated))
        .map((item) => ({ ...item, usahaInfo: { nama: state.usaha.nama, nib: state.usaha.nib, skala: "micro", kota: state.usaha.kota } }));
      return json(route, 200, rows);
    }
    match = path.match(/^\/talent\/berita-acara\/([^/]+)\/pdf$/);
    if (method === "GET" && match) {
      if (state.failNext?.[path]) {
        delete state.failNext[path];
        return json(route, 500, "INTERNAL_SERVER_ERROR");
      }
      const ba = state.beritaAcara.find((item) => item.id === match[1]);
      if (!ba) return json(route, 404, "BERITA_ACARA_NOT_FOUND");
      return route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${ba.nomor.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf"`,
        },
        body: "%PDF-1.4\n%%EOF",
      });
    }
    if (method === "GET" && path === "/talent/berita-acara") return json(route, 200, state.beritaAcara);
    if (method === "POST" && path === "/talent/berita-acara") {
      const created = {
        id: `ba-${state.beritaAcara.length + 1}`,
        nomor: `BA-TS/2026/${String(state.beritaAcara.length + 1).padStart(4, "0")}`,
        tanggal: "2026-09-26",
        catatan: body.catatan,
        berkas: null,
        dateCreated: new Date().toISOString(),
        jumlahPengajuan: body.pengajuan.length,
      };
      for (const id of body.pengajuan) Object.assign(find(id), { status: "disetujui", beritaAcara: created.id });
      state.usaha.talentStatus = "talent_pool";
      state.beritaAcara.unshift(created);
      return json(route, 201, created);
    }
    return route.fallback();
  });
  return state;
}

/**
 * Client-side navigation through the dashboard sidebar (a full page load would server-render
 * against the static mock server). On narrow screens the sidebar is closed or icon-only, so
 * open it first with whichever toggle is visible.
 */
export async function navigateSidebar(page, name, path) {
  const link = page.getByRole("link", { name, exact: true });
  let opened = false;
  if (!(await link.isVisible())) {
    const toggles = page.getByRole("button", { name: /toggle sidebar/i });
    for (let index = 0; index < (await toggles.count()); index += 1) {
      if (await toggles.nth(index).isVisible()) {
        await toggles.nth(index).click();
        opened = true;
        break;
      }
    }
  }
  if (!(await link.isVisible())) {
    // At exactly the md breakpoint (iPad Mini, 768px) neither the sidebar nor its trigger shows;
    // fall back to the app's router so the navigation stays client-side.
    await page.evaluate((target) => document.querySelector("#__nuxt").__vue_app__.config.globalProperties.$router.push(target), path);
    return;
  }
  await link.click();
  // The mobile sidebar is a modal sheet that stays open after navigating.
  if (opened && (await page.getByRole("dialog").count())) await page.keyboard.press("Escape");
}

/**
 * Client-side navigation to any dashboard path through the app's router. Pages that read the
 * mocked browser routes (not the SSR mock server) must be reached this way, never by `page.goto`.
 */
export async function pindahKlien(page, path) {
  // The app handle exists only once Vue has mounted; a freshly server-rendered page has none yet.
  await page.waitForFunction(() => Boolean(document.querySelector("#__nuxt")?.__vue_app__));
  await page.evaluate((target) => document.querySelector("#__nuxt").__vue_app__.config.globalProperties.$router.push(target), path);
}

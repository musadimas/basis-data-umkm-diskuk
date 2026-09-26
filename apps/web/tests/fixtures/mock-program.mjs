/**
 * In-memory mock of the /v1/program endpoints (services/directus/extensions/program) and
 * Directus /files uploads. Install after installMockDirectus: Playwright gives later routes
 * priority, and anything this mock does not handle falls back to the base mock.
 */
import { PNG_1PX, katalogResponse } from "./katalog-data.mjs";

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
    loi: [],
    uploads: [],
    uploadFolders: [],
    requests: [],
  };
}

export async function installMockProgram(page, state = createProgramState()) {
  await page.route("**/panel/assets/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX }));
  // Public catalogue reads through the Directus Public policy.
  await page.route(/\/panel\/items\/produk/, async (route) => {
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
    const body = method === "GET" ? null : (request.postDataJSON?.() ?? null);
    state.requests.push({ method, path, body });
    const find = (id) => state.pengajuan.find((item) => item.id === id);
    let match;

    const laporanOf = (pesertaId) => state.laporan.filter((item) => item.peserta === pesertaId).sort((a, b) => a.mingguKe - b.mingguKe);
    const streak = (pesertaId) => {
      const met = new Set(laporanOf(pesertaId).filter((item) => item.status === "disetujui" && item.realisasiOmzet >= item.target).map((item) => item.mingguKe));
      let best = 0;
      for (const week of met) { let n = 0; while (met.has(week + n)) n += 1; best = Math.max(best, n); }
      return best;
    };
    if (method === "GET" && path === "/katalog/usaha") {
      const q = new URL(request.url()).searchParams.get("q") ?? "";
      return json(route, 200, q.length >= 3 ? [{ id: USAHA_ID, nama: state.usaha.nama, nib: state.usaha.nib, kota: state.usaha.kota }] : []);
    }
    if (method === "GET" && path === "/katalog/produk") return json(route, 200, state.produk);
    if (method === "POST" && path === "/katalog/produk") {
      const created = { id: `88888888-8888-4888-8888-${String(state.produk.length + 1).padStart(12, "0")}`, ...body, statusKurasi: "menunggu", catatanKurasi: null, dikurasiAt: null, usahaNama: state.usaha.nama, usahaKota: state.usaha.kota, dateCreated: new Date().toISOString(), dateUpdated: new Date().toISOString() };
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
      Object.assign(item, { statusKurasi: body.keputusan, catatanKurasi: body.catatan });
      return json(route, 200, item);
    }
    if (method === "GET" && path === "/katalog/loi") return json(route, 200, state.loi);
    if (method === "POST" && path === "/katalog/loi") {
      state.loi.push(body);
      return json(route, 201, { diterima: true });
    }

    if (method === "GET" && path === "/kpi/peserta") {
      return json(route, 200, state.peserta.map((item) => {
        const own = laporanOf(item.id);
        return { ...item, laporanTerkirim: own.length, statusMingguIni: own.find((l) => l.mingguKe === item.mingguBerjalan)?.status ?? "belum_mengirim" };
      }));
    }
    match = path.match(/^\/kpi\/peserta\/([^/]+)$/);
    if (method === "GET" && match) {
      const peserta = state.peserta.find((item) => item.id === match[1]);
      if (!peserta) return json(route, 404, "PESERTA_NOT_FOUND");
      const best = streak(peserta.id);
      return json(route, 200, { peserta, laporan: laporanOf(peserta.id), pitching: { streak: best, dibutuhkan: 4, memenuhi: best >= 4 }, akses: { kirim: true, review: true } });
    }
    match = path.match(/^\/kpi\/peserta\/([^/]+)\/laporan$/);
    if (method === "POST" && match) {
      const duplicate = state.laporan.find((item) => item.clientUuid === body.clientUuid);
      if (duplicate) return json(route, 200, duplicate);
      const peserta = state.peserta.find((item) => item.id === match[1]);
      const created = {
        id: `44444444-4444-4444-8444-${String(state.laporan.length + 1).padStart(12, "0")}`,
        peserta: peserta.id,
        mingguKe: body.mingguKe,
        target: peserta.targetMingguan,
        realisasiOmzet: body.realisasiOmzet,
        jumlahTransaksi: body.jumlahTransaksi,
        capaianPersen: Math.round((body.realisasiOmzet / peserta.targetMingguan) * 1000) / 10,
        kendala: body.kendala,
        bukti: body.bukti,
        status: "menunggu",
        catatanPendamping: null,
        direviewAt: null,
        clientUuid: body.clientUuid,
        dateCreated: new Date().toISOString(),
        dateUpdated: new Date().toISOString(),
      };
      state.laporan.push(created);
      return json(route, 201, created);
    }
    match = path.match(/^\/kpi\/peserta\/([^/]+)\/pitching$/);
    if (method === "PATCH" && match) {
      const peserta = state.peserta.find((item) => item.id === match[1]);
      if (body.rekomendasi && streak(peserta.id) < 4) return json(route, 409, "PITCHING_BELUM_MEMENUHI");
      peserta.rekomendasiPitching = body.rekomendasi;
      return json(route, 200, peserta);
    }
    if (method === "GET" && path === "/kpi/laporan") {
      const status = new URL(request.url()).searchParams.get("status") ?? "menunggu";
      return json(route, 200, state.laporan.filter((item) => item.status === status).map((item) => ({ ...item, pesertaInfo: state.peserta.find((p) => p.id === item.peserta) })));
    }
    match = path.match(/^\/kpi\/laporan\/([^/]+)\/review$/);
    if (method === "POST" && match) {
      const item = state.laporan.find((l) => l.id === match[1]);
      Object.assign(item, { status: body.keputusan, catatanPendamping: body.catatan, direviewAt: new Date().toISOString() });
      return json(route, 200, item);
    }

    if (method === "GET" && path === `/talent/usaha/${USAHA_ID}`) {
      const latest = state.pengajuan.filter((item) => item.usaha === USAHA_ID).at(-1) ?? null;
      return json(route, 200, { usaha: state.usaha, legalitas: state.legalitas, pengajuan: latest });
    }
    if (method === "POST" && path === "/talent/pengajuan") {
      if (state.pengajuan.some((item) => item.usaha === body.usaha && ["draft", "dinilai"].includes(item.status))) {
        return json(route, 409, "PENGAJUAN_SUDAH_ADA");
      }
      const created = {
        id: `22222222-2222-4222-8222-${String(state.pengajuan.length + 1).padStart(12, "0")}`,
        ...body,
        status: "draft",
        skor: null,
        dinilaiAt: null,
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
      Object.assign(item, body, { status: "draft", skor: null });
      return json(route, 200, item);
    }
    match = path.match(/^\/talent\/pengajuan\/([^/]+)\/hitung-skor$/);
    if (method === "POST" && match) {
      const item = find(match[1]);
      item.status = "dinilai";
      item.skor = { finansial: 35, pasar: 100, legalitas: 60, sdm: 80, total: 68.75, rubrikVersi: "placeholder-v0" };
      state.usaha.talentStatus = "scouting";
      return json(route, 200, item);
    }
    match = path.match(/^\/talent\/pengajuan\/([^/]+)\/tolak$/);
    if (method === "POST" && match) {
      const item = find(match[1]);
      item.status = "ditolak";
      return json(route, 200, item);
    }
    if (method === "GET" && path === "/talent/pengajuan") {
      const status = new URL(request.url()).searchParams.get("status");
      const rows = state.pengajuan
        .filter((item) => !status || item.status === status)
        .map((item) => ({ ...item, usahaInfo: { nama: state.usaha.nama, nib: state.usaha.nib, skala: "micro", kota: state.usaha.kota } }));
      return json(route, 200, rows);
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

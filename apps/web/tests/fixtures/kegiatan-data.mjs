/**
 * Public agenda fixtures for the Playwright mocks (Y07/M7-07…M7-10).
 *
 * The stand-in for `GET/POST /v1/program/kegiatan*` imports the real server rules
 * (`statusKegiatan`, `tautanAman`, `toKegiatanDto`, the 27 dinas list) so the mocked browser flow
 * cannot drift from the endpoint it stands for: filters, temporal status, counts, the 27 dinas
 * options, DTO sanitisation and the reminder idempotency all behave like the server.
 */
import { toKegiatanDto } from "../../../../services/directus/extensions/program/src/endpoints/kegiatan/service.js";
import { kelompokStatus, rentangWindow, statusKegiatan } from "../../../../services/directus/extensions/program/src/endpoints/kegiatan/rules.js";
import { gabungkanPenyelenggara, opsiPenyelenggaraTetap } from "../../../../services/directus/extensions/program/src/lib/wilayah.js";
import { barisKegiatanInternal } from "./registrasi-data.mjs";

export const KEGIATAN_IDS = {
  berjalan: "aa000000-0000-4000-8000-000000000001",
  daftar: "aa000000-0000-4000-8000-000000000002",
  tanpaTautan: "aa000000-0000-4000-8000-000000000003",
  segera: "aa000000-0000-4000-8000-000000000004",
  selesai: "aa000000-0000-4000-8000-000000000005",
  selesaiMateri: "aa000000-0000-4000-8000-000000000006",
  kuotaPenuh: "aa000000-0000-4000-8000-000000000007",
  tautanTidakAman: "aa000000-0000-4000-8000-000000000008",
  lintasBulan: "aa000000-0000-4000-8000-000000000009",
  dibatalkan: "aa000000-0000-4000-8000-00000000000a",
};

const HARI = 86_400_000;

/** Rows as the database would return them; `now` fixes the offsets so statuses stay stable. */
export function barisKegiatan(now = Date.now()) {
  const at = (offset) => new Date(now + offset * HARI).toISOString();
  const base = {
    ringkasan: null,
    penyelenggara: "Dinas KUKM Provinsi Jawa Barat",
    kota_nama: "Kota Bandung",
    lokasi: "Gedung Sate",
    link: null,
    kuota: 50,
    terisi: 10,
    silabus: null,
    narasumber: null,
    fasilitas: null,
    syarat: null,
    syarat_skala: null,
    syarat_wilayah: null,
    syarat_nib: false,
    poster: null,
    registration_url: null,
    dokumen_url: null,
    materi_url: null,
    status_publikasi: "terbit",
  };
  return [
    {
      ...base,
      id: KEGIATAN_IDS.berjalan,
      judul: "Pelatihan Pemasaran Digital",
      kategori: "literasi_digital",
      metode: "daring",
      ramah_disabilitas: false,
      kota_nama: null,
      lokasi: null,
      tanggal_mulai: at(-1),
      tanggal_selesai: at(1),
      batas_registrasi: null,
      link: "https://zoom.example.invalid/pemasaran-digital",
      kuota: 100,
      terisi: 37,
      silabus: "Media sosial dan marketplace",
    },
    {
      ...base,
      id: KEGIATAN_IDS.daftar,
      judul: "Sertifikasi Halal Gratis",
      kategori: "sertifikasi",
      metode: "luring",
      ramah_disabilitas: true,
      penyelenggara: "Dinas KUMKM Kabupaten Subang",
      kota_nama: "Kabupaten Subang",
      tanggal_mulai: at(10),
      tanggal_selesai: at(12),
      batas_registrasi: at(8),
      registration_url: "https://daftar.example.invalid/halal",
      dokumen_url: "https://dokumen.example.invalid/panduan-halal.pdf",
      syarat_skala: "Mikro, Kecil",
      syarat_wilayah: "Kabupaten Subang",
      syarat_nib: true,
      silabus: "Alur sertifikasi halal dan audit dapur",
      narasumber: "BPJPH dan pendamping halal",
      fasilitas: "Pendampingan berkas dan sertifikat",
      syarat: "Menyerahkan fotokopi NIB dan KTP",
    },
    {
      ...base,
      id: KEGIATAN_IDS.tanpaTautan,
      judul: "Pameran Produk Unggulan",
      kategori: "pameran",
      metode: "luring",
      ramah_disabilitas: true,
      tanggal_mulai: at(20),
      tanggal_selesai: at(22),
      batas_registrasi: at(18),
      syarat_nib: true,
      syarat: "Memiliki NIB",
    },
    {
      ...base,
      id: KEGIATAN_IDS.segera,
      judul: "Temu Bisnis Ekspor",
      kategori: "akselerasi",
      metode: "hybrid",
      penyelenggara: "Kementerian/Lembaga",
      tanggal_mulai: at(5),
      tanggal_selesai: at(5),
      batas_registrasi: at(-2),
    },
    {
      ...base,
      id: KEGIATAN_IDS.selesai,
      judul: "Bazar Ramadan",
      kategori: "pameran",
      metode: "luring",
      tanggal_mulai: at(-20),
      tanggal_selesai: at(-18),
      batas_registrasi: null,
    },
    {
      ...base,
      id: KEGIATAN_IDS.selesaiMateri,
      judul: "Seminar Literasi Digital",
      kategori: "literasi_digital",
      metode: "daring",
      ramah_disabilitas: true,
      kota_nama: null,
      lokasi: null,
      tanggal_mulai: at(-30),
      tanggal_selesai: at(-30),
      batas_registrasi: null,
      materi_url: "https://materi.example.invalid/seminar-literasi",
    },
    {
      ...base,
      id: KEGIATAN_IDS.kuotaPenuh,
      judul: "Akselerasi UMKM Talent Batch 2",
      kategori: "akselerasi",
      metode: "luring",
      tanggal_mulai: at(15),
      tanggal_selesai: at(16),
      batas_registrasi: at(14),
      kuota: 10,
      terisi: 10,
    },
    {
      ...base,
      id: KEGIATAN_IDS.tautanTidakAman,
      judul: "Pameran Mitra Daerah",
      kategori: "pameran",
      metode: "luring",
      tanggal_mulai: at(25),
      tanggal_selesai: at(26),
      batas_registrasi: at(24),
      registration_url: "javascript:alert(1)",
      dokumen_url: "http://dokumen.example.invalid/panduan.pdf",
    },
    {
      ...base,
      id: KEGIATAN_IDS.lintasBulan,
      judul: "Pameran Akhir Tahun",
      kategori: "pameran",
      metode: "luring",
      tanggal_mulai: at(60),
      tanggal_selesai: at(61),
      batas_registrasi: at(59),
    },
    // Withdrawn after curation: never public, and its reminders are cancelled by the job.
    { ...base, id: KEGIATAN_IDS.dibatalkan, judul: "Pelatihan Dibatalkan", status_publikasi: "dibatalkan", tanggal_mulai: at(3), tanggal_selesai: at(4) },
    // R03: internal registration events ride the same public DTO (pendaftaran_internal = true).
    ...barisKegiatanInternal(now),
  ];
}

export function createKegiatanState({ now = Date.now() } = {}) {
  return { now, rows: barisKegiatan(now), pengingat: [] };
}

/**
 * Waits until the agenda page has hydrated. The SSR HTML already shows the calendar, but only a
 * hydrated app answers selects, month buttons and dialogs; the page sets `data-terhidrasi` in
 * onMounted, which runs after Vue finished the handoff.
 */
export async function tungguHidrasi(page, timeout = 20_000) {
  await page.locator('[data-terhidrasi="1"]').waitFor({ state: "attached", timeout });
}

const satu = (params, key) => {
  const value = params.get(key);
  return value === null || value === "" ? null : value;
};
const daftar = (params, key) => (satu(params, key) ?? "").split(",").map((value) => value.trim()).filter(Boolean);

function metaDari(rows, now, items, filter) {
  return {
    serverNow: new Date(now).toISOString(),
    jumlah: items.length,
    terpotong: false,
    kelompok: kelompokStatus(items, new Date(now)),
    bulan: filter.bulan,
    tahun: filter.tahun,
    opsi: {
      kategori: [
        { value: "pelatihan", label: "Pelatihan/Bimtek" },
        { value: "sertifikasi", label: "Sertifikasi" },
        { value: "pameran", label: "Pameran" },
        { value: "akselerasi", label: "Akselerasi UMKM Talent" },
        { value: "literasi_digital", label: "Literasi Digital/PMSE" },
      ],
      metode: [
        { value: "luring", label: "Luring" },
        { value: "daring", label: "Daring" },
        { value: "hybrid", label: "Hybrid" },
      ],
      penyelenggara: gabungkanPenyelenggara(
        opsiPenyelenggaraTetap(),
        rows.filter((row) => row.status_publikasi === "terbit").map((row) => row.penyelenggara).filter(Boolean),
      ),
    },
  };
}

/** The list body exactly as the extension returns it (meta nested in data for the SDK). */
export function kegiatanListBody(state, searchParams) {
  const now = new Date(state.now);
  const bulan = Number(satu(searchParams, "bulan"));
  const tahun = Number(satu(searchParams, "tahun"));
  const filter = {
    bulan: Number.isInteger(bulan) && bulan >= 1 && bulan <= 12 ? bulan : null,
    tahun: Number.isInteger(tahun) && tahun >= 2000 ? tahun : null,
  };
  const kategori = daftar(searchParams, "kategori");
  const penyelenggara = daftar(searchParams, "penyelenggara");
  const metode = satu(searchParams, "metode");
  const ramah = satu(searchParams, "ramah") === "1" || satu(searchParams, "ramah") === "true";
  const status = daftar(searchParams, "status");

  const { dari, sampai } = rentangWindow(filter, now);
  const items = state.rows
    .filter((row) => row.status_publikasi === "terbit")
    .filter((row) => new Date(row.tanggal_selesai) >= dari && new Date(row.tanggal_mulai) < sampai)
    .filter((row) => !kategori.length || kategori.includes(row.kategori))
    .filter((row) => !penyelenggara.length || penyelenggara.includes(row.penyelenggara))
    .filter((row) => !metode || row.metode === metode)
    .filter((row) => !ramah || row.ramah_disabilitas)
    .map((row) => toKegiatanDto(row, now))
    .filter((item) => !status.length || status.includes(item.status))
    .sort((a, b) => a.tanggalMulai.localeCompare(b.tanggalMulai) || a.judul.localeCompare(b.judul));

  return { data: { items, meta: metaDari(state.rows, state.now, items, filter) } };
}

const err = (status, code, message) => ({ status, body: { errors: [{ message, extensions: { code } }] } });

/**
 * Stand-in for the kegiatan endpoints. Returns null when the path is not part of Y07, so each mock
 * can fall through to its own routes.
 */
export function kegiatanApiResponse({ pathname, searchParams = new URLSearchParams(), method = "GET", body = null, state }) {
  if (!pathname.startsWith("/v1/program/kegiatan")) return null;
  const sekarang = new Date(state.now);
  const sisa = pathname.slice("/v1/program/kegiatan".length);

  if (method === "GET" && (sisa === "" || sisa === "/")) return { status: 200, body: kegiatanListBody(state, searchParams) };

  if (method === "GET" && sisa === "/pengingat/proses") return { status: 403, body: { errors: [{ message: "forbidden", extensions: { code: "FORBIDDEN" } }] } };

  if (method === "POST" && sisa === "/pengingat/batal") {
    const token = String(body?.token ?? "");
    const row = state.pengingat.find((item) => item.batalToken === token);
    if (!row) return err(404, "TOKEN_TIDAK_DITEMUKAN", "The reminder was not found.");
    const sudah = row.status === "dibatalkan";
    row.status = "dibatalkan";
    return { status: 200, body: { data: { kanal: row.kanal, tujuanMasked: row.tujuanMasked, status: "dibatalkan", sudah } } };
  }

  const detail = sisa.match(/^\/([^/]+)$/);
  if (method === "GET" && detail) {
    const row = state.rows.find((item) => item.id === detail[1] && item.status_publikasi === "terbit");
    if (!row) return err(404, "KEGIATAN_NOT_FOUND", "The event was not found.");
    return { status: 200, body: { data: toKegiatanDto(row, sekarang) } };
  }

  const optIn = sisa.match(/^\/([^/]+)\/pengingat$/);
  if (method === "POST" && optIn) {
    const row = state.rows.find((item) => item.id === optIn[1] && item.status_publikasi === "terbit");
    if (!row) return err(404, "KEGIATAN_NOT_FOUND", "The event was not found.");
    const kanal = body?.kanal;
    if (kanal !== "email" && kanal !== "whatsapp") return err(400, "INVALID_PAYLOAD", 'The field "kanal" is not valid.');
    const tujuan = String(body?.tujuan ?? "").trim().toLowerCase();
    const valid = kanal === "email" ? /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(tujuan) : /^628\d{7,12}$/.test(tujuan.replace(/\D/g, "").replace(/^0/, "62"));
    if (!valid) return err(400, "TUJUAN_TIDAK_VALID", "The target is not valid.");
    if (statusKegiatan(toKegiatanDto(row, sekarang), sekarang) === "selesai") return err(409, "KEGIATAN_SELESAI", "The event has already finished.");
    // Seperti server: captcha sekali pakai dikonsumsi terakhir, setelah status kegiatan.
    if (!body?.captcha) return err(400, "CAPTCHA_INVALID", "The captcha is missing, expired or already used.");

    const adaLama = state.pengingat.find((item) => item.kegiatan === row.id && item.kanal === kanal && item.tujuan === tujuan);
    if (adaLama) {
      adaLama.status = adaLama.status === "dibatalkan" || adaLama.status === "gagal" ? "menunggu" : adaLama.status;
      return { status: 201, body: { data: adaLama } };
    }
    const dibuat = {
      id: `cc000000-0000-4000-8000-${String(state.pengingat.length + 1).padStart(12, "0")}`,
      kegiatan: row.id,
      kanal,
      tujuan,
      tujuanMasked: kanal === "email" ? `${tujuan.slice(0, 1)}***@${tujuan.split("@")[1]}` : `${tujuan.slice(0, 5)}****${tujuan.slice(-3)}`,
      jadwalKirim: new Date(new Date(row.tanggal_mulai).getTime() - HARI).toISOString(),
      // Mirrors the server: a WhatsApp opt-in without a gateway is parked, never "pending delivery".
      status: kanal === "whatsapp" ? "menunggu_gateway" : "menunggu",
      batalToken: `dd000000-0000-4000-8000-${String(state.pengingat.length + 1).padStart(12, "0")}`,
      judul: row.judul,
    };
    state.pengingat.push(dibuat);
    const { kegiatan, judul, ...jawaban } = dibuat;
    return { status: 201, body: { data: { ...jawaban, kegiatan: { id: kegiatan, judul } } } };
  }

  return err(404, "KEGIATAN_NOT_FOUND", "The route was not found.");
}

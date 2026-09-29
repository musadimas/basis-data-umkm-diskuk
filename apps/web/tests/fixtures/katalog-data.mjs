// Published catalogue fixtures shared by the SSR mock server and the browser route mock.
export const PRODUK_ID = "66666666-6666-4666-8666-000000000001";
export const FOTO_ID = "77777777-7777-4777-8777-000000000001";

export const PRODUK_PUBLIK = [
  {
    id: PRODUK_ID,
    nama: "Keripik Singkong Balado",
    deskripsi: "Keripik renyah dari singkong lokal.",
    kategori: "makanan",
    kbli: "10794",
    harga_retail: 15000,
    harga_grosir: 12000,
    hargaLabel: "Rp 12.000 - Rp 15.000",
    moq: 50,
    video_url: "https://youtu.be/dQw4w9WgXcQ",
    dimensi: "20 x 10 x 5 cm",
    berat: "250 g",
    shelf_life: "6 bulan",
    bahan_baku: "Singkong, cabai",
    tkdn_persen: "85.00",
    kapasitas_bulanan: "2.000 pcs",
    lead_time: "7 hari",
    persen_bahan_lokal: "95.00",
    uji_lab: "Uji mikrobiologi labkes: aman",
    pdn_deklarasi: true,
    status_kurasi: "rekomendasi_marketplace",
    foto: [{ directus_files_id: FOTO_ID }],
    usaha_nama: "Keripik Siti",
    usaha_skala: "micro",
    usaha_talent_status: "talent_pool",
    usaha_pdn: false,
    usaha_ramah_disabilitas: true,
    usaha_whatsapp: "081234567890",
    usaha_kota: 7,
    usaha_kota_nama: "Kota Bandung",
    usaha_sertifikasi: ",halal,pirt,",
    usaha_nib: "1234567890123",
    usaha_legalitas: [
      { jenis: "halal", nomor: "ID3210000123456", berlakuHingga: "2030-01-01" },
      { jenis: "pirt", nomor: null, berlakuHingga: null },
    ],
    date_created: "2026-09-20T00:00:00Z",
  },
  {
    id: "66666666-6666-4666-8666-000000000002",
    nama: "Batik Tulis Mega Mendung",
    deskripsi: null,
    kategori: "fashion",
    kbli: null,
    harga_retail: 350000,
    harga_grosir: null,
    moq: null,
    video_url: null,
    dimensi: null,
    berat: null,
    shelf_life: null,
    bahan_baku: null,
    tkdn_persen: null,
    kapasitas_bulanan: null,
    lead_time: null,
    persen_bahan_lokal: null,
    pdn_deklarasi: false,
    status_kurasi: "tayang",
    foto: [],
    usaha_nama: "Batik Cirebon",
    usaha_skala: "small",
    usaha_talent_status: "none",
    usaha_pdn: false,
    usaha_ramah_disabilitas: false,
    usaha_whatsapp: null,
    usaha_kota: 9,
    usaha_kota_nama: "Kota Cirebon",
    usaha_sertifikasi: "",
    usaha_nib: null,
    usaha_legalitas: [],
    date_created: "2026-09-10T00:00:00Z",
  },
];

/**
 * The 27 kabupaten/kota of Jawa Barat as the public `kota` grant exposes them (id, nama).
 * The catalogue filter must offer all of them, whatever happens to be published.
 */
export const KOTA_PUBLIK = [
  { id: 1, nama: "Kabupaten Bandung" },
  { id: 2, nama: "Kabupaten Bandung Barat" },
  { id: 3, nama: "Kabupaten Bekasi" },
  { id: 4, nama: "Kabupaten Bogor" },
  { id: 5, nama: "Kabupaten Ciamis" },
  { id: 6, nama: "Kabupaten Cianjur" },
  { id: 7, nama: "Kota Bandung" },
  { id: 8, nama: "Kabupaten Cirebon" },
  { id: 9, nama: "Kota Cirebon" },
  { id: 10, nama: "Kabupaten Garut" },
  { id: 11, nama: "Kabupaten Indramayu" },
  { id: 12, nama: "Kabupaten Karawang" },
  { id: 13, nama: "Kabupaten Kuningan" },
  { id: 14, nama: "Kabupaten Majalengka" },
  { id: 15, nama: "Kabupaten Pangandaran" },
  { id: 16, nama: "Kabupaten Purwakarta" },
  { id: 17, nama: "Kabupaten Subang" },
  { id: 18, nama: "Kabupaten Sukabumi" },
  { id: 19, nama: "Kabupaten Sumedang" },
  { id: 20, nama: "Kabupaten Tasikmalaya" },
  { id: 21, nama: "Kota Bekasi" },
  { id: 22, nama: "Kota Bogor" },
  { id: 23, nama: "Kota Cimahi" },
  { id: 24, nama: "Kota Depok" },
  { id: 25, nama: "Kota Sukabumi" },
  { id: 26, nama: "Kota Tasikmalaya" },
  { id: 27, nama: "Kota Banjar" },
];

/** Matches one Directus clause against one product (the subset the catalogue sends). */
function matchClause(produk, clause) {
  if (clause._or) return clause._or.some((inner) => matchClause(produk, inner));
  if (clause.kategori) return clause.kategori._in.includes(produk.kategori);
  if (clause.usaha_kota) return produk.usaha_kota === clause.usaha_kota._eq;
  if (clause.usaha_skala) return clause.usaha_skala._in.includes(produk.usaha_skala);
  if (clause.usaha_talent_status) return clause.usaha_talent_status._in.includes(produk.usaha_talent_status);
  if (clause.usaha_sertifikasi) return (produk.usaha_sertifikasi ?? "").includes(clause.usaha_sertifikasi._contains);
  if (clause.usaha_ramah_disabilitas) return produk.usaha_ramah_disabilitas === clause.usaha_ramah_disabilitas._eq;
  if (clause.nama) return (produk.nama ?? "").toLowerCase().includes(String(clause.nama._icontains).toLowerCase());
  if (clause.usaha_nama) return (produk.usaha_nama ?? "").toLowerCase().includes(String(clause.usaha_nama._icontains).toLowerCase());
  if (clause.kbli) return (produk.kbli ?? "").includes(String(clause.kbli._contains));
  if (clause.pdn_deklarasi) return produk.pdn_deklarasi === clause.pdn_deklarasi._eq;
  if (clause.usaha_pdn) return produk.usaha_pdn === clause.usaha_pdn._eq;
  return true;
}

/** Applies the subset of Directus filters the catalogue sends. */
export function filterProduk(filterJson) {
  const filter = filterJson ? JSON.parse(filterJson) : {};
  const clauses = filter._and ?? [];
  return PRODUK_PUBLIK.filter((produk) => clauses.every((clause) => matchClause(produk, clause)));
}

export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** Directus-style JSON body for a catalogue URL, or null when the URL is not a catalogue read. */
export function katalogResponse(pathname, searchParams) {
  // The SDK's aggregate() is a GET on /items/<collection> with an `aggregate` param.
  if (pathname.endsWith("/items/produk") && searchParams.has("aggregate")) {
    const groupBy = searchParams.get("groupBy");
    if (groupBy) {
      const counts = new Map();
      for (const produk of filterProduk(searchParams.get("filter"))) {
        const key = produk.usaha_kota;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return { data: [...counts].map(([usaha_kota, count]) => ({ usaha_kota, count: String(count) })) };
    }
    return { data: [{ count: String(filterProduk(searchParams.get("filter")).length) }] };
  }
  if (pathname.endsWith("/items/produk")) return { data: filterProduk(searchParams.get("filter")) };
  if (pathname.endsWith("/items/kota")) return { data: KOTA_PUBLIK };
  const match = pathname.match(/\/items\/produk\/([^/]+)$/);
  if (match) {
    const produk = PRODUK_PUBLIK.find((item) => item.id === match[1]);
    return produk ? { data: produk } : { status: 403, errors: [{ message: "Forbidden", extensions: { code: "FORBIDDEN" } }] };
  }
  return null;
}

/** Minimal but structurally valid PDF, enough for the download/parse assertions in the specs. */
export const PDF_CONTOH =
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n200\n%%EOF";

export const PASSPORT_KODE = "TP7K2M9QX4RB";
export const PASSPORT_PAYLOAD = {
  versi: 1,
  kode: PASSPORT_KODE,
  usaha: { nama: "Keripik Siti", skala: "micro", kota: "Kota Bandung", kbli: "10794" },
  statusBadge: "Talent Pool Jawa Barat",
  skor: { finansial: 35, pasar: 100, legalitas: 60, sdm: 80, kinerja: 50 },
  rubrikVersi: "placeholder-v0",
  sumberSkor: [
    { dimensi: "finansial", sumber: "Talent Scouting (rubrik placeholder-v0)" },
    { dimensi: "pasar", sumber: "Talent Scouting (rubrik placeholder-v0)" },
    { dimensi: "legalitas", sumber: "Talent Scouting (rubrik placeholder-v0)" },
    { dimensi: "sdm", sumber: "Talent Scouting (rubrik placeholder-v0)" },
    { dimensi: "kinerja", sumber: "KPI mingguan disetujui: 6/6 minggu memenuhi target." },
  ],
  badges: [
    { key: "pdn_deklarasi", label: "PDN — deklarasi mandiri pelaku usaha", terverifikasi: false, sumber: "Deklarasi mandiri UMKM, belum diverifikasi dinas" },
    { key: "legalitas_halal", label: "Sertifikat Halal aktif", terverifikasi: true, sumber: "Tercatat dinas dengan berkas sertifikat" },
  ],
  sertifikasi: ["halal", "pirt"],
  pdnTerverifikasi: false,
  diterbitkanAt: "2026-09-26T03:00:00.000Z",
};

/** Public passport verification (/v1/program/passport/verify/:kode). */
export function passportResponse(pathname) {
  const match = pathname.match(/\/v1\/program\/passport\/verify\/([^/]+)$/);
  if (!match) return null;
  const kode = decodeURIComponent(match[1]).toUpperCase();
  if (kode === PASSPORT_KODE) {
    const produk = PRODUK_PUBLIK[0];
    return {
      data: {
        kode,
        qrTalentPassportCode: kode,
        valid: true,
        status: "aktif",
        passport: PASSPORT_PAYLOAD,
        portfolio: [{ id: produk.id, nama: produk.nama, deskripsi: produk.deskripsi, videoUrl: produk.video_url, dimensi: produk.dimensi, berat: produk.berat, shelfLife: produk.shelf_life, bahanBaku: produk.bahan_baku, persenBahanLokal: produk.persen_bahan_lokal, tkdnPersen: produk.tkdn_persen, kapasitasBulanan: produk.kapasitas_bulanan, leadTime: produk.lead_time, ujiLab: produk.uji_lab, foto: [FOTO_ID] }],
        publicKey: { kid: "a1b2c3d4e5f60718", jwk: { kty: "OKP", crv: "Ed25519", x: "mock" }, sidikJari: "a1b2c3d4e5f60718" },
      },
    };
  }
  if (kode === "TP0000000000") return { data: { kode, valid: false, status: "tidak_valid" } };
  return { status: 404, errors: [{ message: "Passport not found.", extensions: { code: "PASSPORT_NOT_FOUND" } }] };
}

export const KONTAK_HOTLINE = {
  id: 1,
  nama_layanan: "Layanan Informasi DISKUK Jawa Barat",
  whatsapp: "081100000000",
  telepon: "022-0000000",
  email: "layanan@contoh.invalid",
  jam_layanan: "Senin–Jumat 08.00–16.00 WIB",
  alamat: "Jalan Soekarno-Hatta No. 705 Kota Bandung",
};

export const FAQ = [
  { id: 1, pertanyaan: "Bagaimana cara mengajukan konsultasi?", jawaban: "Isi formulir di halaman Konsultasi.", kategori: "Klinik", sort: 1, date_updated: "2026-09-20T00:00:00Z" },
  { id: 2, pertanyaan: "Apakah katalog berbayar?", jawaban: "Tidak, katalog gratis untuk UMKM terkurasi.", kategori: "Katalog", sort: 2, date_updated: "2026-09-21T00:00:00Z" },
];

/** Events relative to "now", so each status column has one entry whenever the suite runs. */
export function kegiatanFixtures(now = Date.now()) {
  const day = 86_400_000;
  const at = (offset) => new Date(now + offset).toISOString();
  const base = { ringkasan: null, penyelenggara: "DISKUK Jabar", kota_nama: "Kota Bandung", ramah_disabilitas: false, lokasi: "Gedung Sate", link: null, kuota: 50, terisi: 10, silabus: null, narasumber: null, fasilitas: null, syarat: null, poster: null };
  return [
    { ...base, id: "k1", judul: "Pelatihan Pemasaran Digital", kategori: "pelatihan", metode: "daring", tanggal_mulai: at(-day), tanggal_selesai: at(day), batas_registrasi: null, silabus: "Media sosial dan marketplace" },
    { ...base, id: "k2", judul: "Pameran Produk Unggulan", kategori: "pameran", metode: "luring", ramah_disabilitas: true, tanggal_mulai: at(10 * day), tanggal_selesai: at(12 * day), batas_registrasi: at(8 * day), syarat: "Memiliki NIB" },
    { ...base, id: "k3", judul: "Temu Bisnis Ekspor", kategori: "temu_bisnis", metode: "hybrid", penyelenggara: "Kementerian", tanggal_mulai: at(5 * day), tanggal_selesai: at(5 * day + 3600_000), batas_registrasi: at(-2 * day) },
    { ...base, id: "k4", judul: "Bazar Ramadan", kategori: "bazar", metode: "luring", tanggal_mulai: at(-20 * day), tanggal_selesai: at(-18 * day), batas_registrasi: null },
  ];
}

/** Public editorial content: kegiatan, FAQ and the hotline singleton. */
export const POLI = [
  { id: 1, kode: "legalitas", nama: "Poli Legalitas & Perizinan", deskripsi: "NIB, PIRT, halal.", sort: 1 },
  { id: 2, kode: "pemasaran", nama: "Poli Pemasaran & Digitalisasi", deskripsi: "Branding dan marketplace.", sort: 2 },
];

export function portalResponse(pathname) {
  if (pathname.endsWith("/items/konsultasi_poli")) return { data: POLI };
  if (pathname.endsWith("/items/kegiatan")) return { data: kegiatanFixtures() };
  if (pathname.endsWith("/items/faq")) return { data: FAQ };
  if (pathname.endsWith("/items/kontak_hotline")) return { data: KONTAK_HOTLINE };
  return null;
}

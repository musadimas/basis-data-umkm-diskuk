import type { InfografisRegionLevel } from "~/types/infografis";

export const DASHBOARD_SECTIONS = {
  scale: {
    title: "Jumlah Usaha Berdasarkan Skala Usaha",
    description:
      "Berdasarkan kriteria penjualan tahunan sebagaimana dimaksud dalam Pasal 35 ayat (5) Peraturan Pemerintah Nomor 7 Tahun 2021 tentang Kemudahan, Pelindungan, dan Pemberdayaan Koperasi serta UMKM.",
    tooltip:
      "Klasifikasi skala usaha berdasarkan kriteria omzet & aset sesuai PP No. 7 Tahun 2021",
  },
  regionalMap: {
    title: "Peta Sebaran Usaha Berdasarkan Wilayah",
    tooltip:
      "Sebaran data spasial konsentrasi UMKM di 27 Kabupaten/Kota Jawa Barat. Klik wilayah untuk memperbesar, aktifkan Titik UMKM untuk melihat lokasi usaha.",
  },
  spatialMap: {
    title: "Peta Spasial UMKM",
    tooltip:
      "Eksplorasi lokasi usaha di Jawa Barat: koropleth jumlah UMKM per wilayah dengan drill-down kabupaten/kota → kecamatan → desa/kelurahan, ditambah layer titik usaha berkoordinat yang mengembang saat zoom. Atur batas titik sesuai kebutuhan.",
  },
  nib: {
    title: "Kepemilikan NIB",
    description:
      "Berikut ini adalah data perbandingan antara UMKM yang memiliki NIB dan tidak memiliki NIB.",
    tooltip: "Perbandingan UMKM yang memiliki dan belum memiliki NIB",
  },
  marketing: {
    title: "Metode Pemasaran",
    description:
      "Berikut ini adalah data agregasi UMKM berdasarkan metode pemasarannya.",
    tooltip: "Distribusi UMKM berdasarkan metode pemasaran",
  },
  gender: {
    title: "Persentase Tenaga Kerja Berdasarkan Gender",
    description:
      "Berikut ini adalah perbandingan Pengusaha berdasarkan Jenis Kelamin.",
    tooltip: "Perbandingan demografi tenaga kerja UMKM",
  },
  topSector: {
    title: "5 Sektor KBLI Teratas",
    description:
      "Lima sektor dengan jumlah UMKM terbanyak. Klik untuk membuka analitik sektor.",
    tooltip:
      "Peringkat sektor KBLI (A–U) berdasarkan jumlah UMKM pada filter aktif",
  },
  topKbli: {
    title: "5 Kode KBLI Teratas",
    description:
      "Lima kode KBLI spesifik dengan jumlah UMKM terbanyak. Klik untuk membuka analitik kode.",
    tooltip: "Peringkat kode KBLI berdasarkan jumlah UMKM pada filter aktif",
  },
  coverage: {
    title: "Kualitas Klasifikasi KBLI",
    description:
      "Proporsi UMKM dengan kode KBLI yang berhasil dipetakan ke sektor.",
    tooltip:
      "Kualitas data: usaha terpetakan memiliki kode KBLI valid yang dikenali sistem",
  },
  umkmData: {
    title: "Data UMKM",
    description:
      "Tab Berdasarkan Kategori menampilkan rincian UMKM per kategori KBLI beserta komposisi skala usaha. Tab Data UMKM menampilkan baris data sesuai filter infografis aktif, dengan filter tambahan, profil usaha, dan unduhan CSV (maks. 50.000 baris).",
    tooltip:
      "Rincian agregat per sektor KBLI, atau baris data usaha dari snapshot usaha_tabular dengan filter & paginasi server-side",
  },
} as const;

/** Panel wilayah teratas di Infografis: judul mengikuti level agregasi dari API (BUG-001). */
export const TOP_REGION_SECTIONS = {
  kota: {
    title: "5 Kabupaten/Kota Teratas",
    description: "Lima kabupaten/kota dengan jumlah UMKM terbanyak. Klik untuk membuka analitik wilayah.",
    tooltip: "Peringkat kabupaten/kota berdasarkan jumlah UMKM pada filter aktif",
  },
  kecamatan: {
    title: "5 Kecamatan Teratas",
    description: "Lima kecamatan dengan jumlah UMKM terbanyak pada kabupaten/kota terpilih. Klik untuk membuka analitik wilayah.",
    tooltip: "Peringkat kecamatan berdasarkan jumlah UMKM pada filter aktif",
  },
  kelurahan: {
    title: "5 Desa/Kelurahan Teratas",
    description: "Lima desa/kelurahan dengan jumlah UMKM terbanyak pada kecamatan terpilih. Klik untuk membuka analitik wilayah.",
    tooltip: "Peringkat desa/kelurahan berdasarkan jumlah UMKM pada filter aktif",
  },
} satisfies Record<InfografisRegionLevel, { title: string; description: string; tooltip: string }>;

/** Field Analitik untuk membuka satu wilayah sesuai levelnya (dipakai Infografis; Phase 3 menambah Spasial). */
export const REGION_ANALYTICS_FIELD = {
  kota: "kota_id",
  kecamatan: "kecamatan_id",
  kelurahan: "kelurahan_id",
} as const satisfies Record<InfografisRegionLevel, string>;

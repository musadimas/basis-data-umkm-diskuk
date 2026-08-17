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
    description:
      "Menyajikan informasi sebaran jumlah UMKM berdasarkan wilayah.",
    tooltip:
      "Sebaran data spasial konsentrasi UMKM di 27 Kabupaten/Kota Jawa Barat",
  },
  category: {
    title: "Jumlah UMKM Berdasarkan Kategori Lapangan Usaha",
    description:
      "Dikelompokkan berdasarkan 21 kategori lapangan usaha dalam KBLI.",
    tooltip:
      "Kategori A–U berdasarkan Klasifikasi Baku Lapangan Usaha Indonesia (KBLI)",
  },
  topCategories: {
    title: "Lima Kategori Lapangan Usaha Teratas",
    description: "Description",
    tooltip: "5 Kategori KBLI dengan populasi usaha tertinggi",
  },
  gender: {
    title: "Persentase Tenaga Kerja Berdasarkan Gender",
    description: "Description",
    tooltip: "Perbandingan demografi tenaga kerja UMKM",
  },
  kbliAccordion: {
    title: "Rincian UMKM Berdasarkan Kategori KBLI",
    description:
      "Dikelompokkan berdasarkan huruf kategori KBLI dan diurutkan dari jumlah UMKM terbanyak.",
    tooltip:
      "Kategori A–U berdasarkan Klasifikasi Baku Lapangan Usaha Indonesia (KBLI)",
  },
} as const;

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
  kbliAccordion: {
    title: "Rincian UMKM Berdasarkan Kategori KBLI",
    description:
      "Dikelompokkan berdasarkan huruf kategori KBLI (A–U), diurutkan dari jumlah UMKM terbanyak. Klik baris untuk melihat komposisi skala usaha dan rincian kode KBLI.",
    tooltip:
      "Kategori A–U berdasarkan Klasifikasi Baku Lapangan Usaha Indonesia (KBLI)",
  },
} as const;

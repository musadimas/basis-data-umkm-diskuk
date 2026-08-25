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
  topSector: {
    title: "5 Sektor KBLI Teratas",
    description:
      "Lima sektor dengan jumlah UMKM terbanyak. Klik untuk membuka analitik sektor.",
    tooltip:
      "Peringkat sektor KBLI (A–U) berdasarkan jumlah UMKM pada filter aktif",
  },
  topRegion: {
    title: "5 Kabupaten/Kota Teratas",
    description:
      "Lima kabupaten/kota dengan jumlah UMKM terbanyak. Klik untuk membuka analitik wilayah.",
    tooltip:
      "Peringkat kabupaten/kota berdasarkan jumlah UMKM pada filter aktif",
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
      "Baris data UMKM sesuai filter infografis aktif. Persempit dengan filter tambahan, buka profil usaha per baris, atau unduh hasilnya sebagai CSV (maks. 50.000 baris).",
    tooltip:
      "Data baris usaha dari snapshot usaha_tabular dengan filter & paginasi server-side",
  },
} as const;

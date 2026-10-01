# UX Specification — Analitik dan Profil UMKM

**Status:** target UX disetujui
**Bahasa:** Indonesia
**Perangkat utama:** desktop dan tablet

## 1. Prinsip UX

1. Mulai dari pertanyaan pengguna, bukan struktur database.
2. Filter aktif, coverage, denominator, dan waktu data selalu terlihat.
3. Aksi filter, drill-down, dan buka record tidak ambigu.
4. Detail operasional worker tidak terlihat oleh pengguna.
5. Grafik selalu mempunyai alternatif tabel.
6. State dapat dipulihkan melalui URL dan browser navigation.
7. Field baru tidak boleh merusak layout atau keamanan.

## 2. Navigasi

Sidebar authenticated:

```text
Infografis
Analitik
Data Tabular
Peta Spasial
```

Route profil UMKM tidak harus menjadi menu utama; route dibuka dari hasil drill-down, tabel, atau tautan internal.

Landing page tetap publik. Tautan Dashboard pada landing mengarah ke `/sign-in` bila sesi tidak ada.

## 3. Login

### Layout

- Logo/nama program
- Email
- Password
- Show/hide password
- Tombol **Masuk**
- Pesan error generik

### Perilaku

- Jangan membedakan email tidak ditemukan versus password salah.
- Setelah berhasil, kembali ke route tujuan yang aman.
- Route tujuan tidak boleh menerima open redirect eksternal.
- Tidak ada registrasi atau lupa password publik pada MVP.
- Session expired mengarahkan ke login dengan pesan sederhana dan menyimpan intended route.
- Logout mencabut session Directus lalu kembali ke sign-in/landing.

## 4. Canvas Analitik

```text
┌─────────────────────────────────────────────────────────────┐
│ Analisis Data UMKM                     Data per: ...          │
├─────────────────────────────────────────────────────────────┤
│ Template                                                     │
├─────────────────────────────────────────────────────────────┤
│ Metrik | Kelompokkan | Breakdown | Filter        [Terapkan] │
│ [chip filter] [chip filter]                                  │
├─────────────────────────────────────────────────────────────┤
│ KPI                    Insight otomatis                      │
├─────────────────────────────────────────────────────────────┤
│ Grafik / choropleth utama                                    │
│ [Ganti visual] [Lihat tabel]                                 │
├─────────────────────────────────────────────────────────────┤
│ Breakdown                                                    │
├─────────────────────────────────────────────────────────────┤
│ Record UMKM [Lihat profil]                                   │
└─────────────────────────────────────────────────────────────┘
```

Yang tidak boleh tampil: nama job, queue depth, stack trace, retry count, cache status, dan jargon infrastruktur.

### Header data

Normal:

> Data terakhir diperbarui pada 16 Agustus 2026, 13.36 WIB.

Processing:

> Pembaruan data sedang diproses.

Degraded:

> Data terbaru belum tersedia; menampilkan data terakhir yang berhasil diproses.

Detail teknis hanya berada pada Directus/operational docs.

## 5. Query builder

Halaman pertama kali membuka preset **Sebaran UMKM Saat Ini** pada level kabupaten/kota.

Urutan kontrol:

1. Metrik
2. Kelompokkan berdasarkan
3. Breakdown opsional
4. Filter
5. Terapkan
6. Reset

Field picker dikelompokkan:

- Metrik resmi
- Wilayah
- Profil usaha
- KBLI
- Tenaga kerja
- Kualitas data
- Field baru/belum dikategorikan

Badge registry:

- **Baru** — baru dideteksi;
- **Perlu konfigurasi** — quarantined/ambiguous;
- **Tidak tersedia** — field saved view telah berubah/dihapus;
- **Sensitif** — capability dibatasi.

Field yang tidak diizinkan tidak boleh dapat dipaksa melalui URL atau request manual.

### Apply model

Perubahan kontrol disimpan sebagai draft lokal. Query hanya dieksekusi setelah **Terapkan**. Tombol menampilkan loading dan disabled sementara request aktif. Request lama dibatalkan atau diabaikan jika request baru sudah diterapkan.

## 6. Filter behavior

- Geography dan KBLI bersifat cascading.
- Opsi searchable dan virtualized bila besar.
- Setiap filter menjadi chip dengan label manusia, bukan ID.
- Clear satu chip tidak menghapus filter lain yang masih valid.
- Mengubah parent membersihkan child yang tidak kompatibel.
- Filter aktif, sort, page, query config, dan selected visualization tersimpan di URL.
- UUID record, NIK, telepon, atau data sensitif tidak boleh masuk URL.

## 7. Visual rules

| Data shape | Default visual |
|---|---|
| Satu metric | KPI |
| Kategori ≤20 | Horizontal/vertical bar |
| Kategori kecil ≤6 | Donut bila part-to-whole |
| Dimension + breakdown | Stacked/grouped bar |
| Geography | Choropleth |
| Numeric distribution | Histogram |
| High cardinality/detail | Table |

Rules:

- `Lainnya` menggabungkan kategori setelah top 20.
- Donut tidak dipakai untuk nilai negatif atau bukan part-to-whole.
- Tidak ada line chart tanpa waktu valid.
- Axis, unit, denominator, dan format harus sesuai metadata.
- Legend, tooltip, table, dan screen-reader summary memakai definisi yang sama.
- Share adalah bagian dari total filter, bukan indeks terhadap nilai terbesar.

## 8. Interaction model

### Cross-filter

Klik bar/area/map region memilih nilai dan memperbarui chips. Selected state terlihat jelas selain warna.

### Drill-down

Aksi eksplisit **Drill down** mengikuti hierarki:

```text
Jawa Barat → Kabupaten/Kota → Kecamatan → Desa/Kelurahan → UMKM
Sektor A–U → Divisi → Kode KBLI → UMKM
```

### Record detail

Aksi **Lihat record** menampilkan tabel record pada filter aktif. Klik nama/aksi membuka `/dashboard/umkm/:id`. Return link, browser back, dan previous/next mempertahankan query config, page, sort, dan scroll context.

## 9. Insight panel

Setiap insight berisi:

- headline nonkausal;
- nilai dan unit;
- filter/cakupan;
- formula/threshold yang dapat dibuka;
- tombol **Lihat bukti**;
- peringatan coverage bila diperlukan.

Contoh wording yang aman:

> Kabupaten A memiliki share UMKM sektor C terbesar dalam filter ini (18,2%).

Wording yang dilarang:

> Sektor C berkembang karena program X.

## 10. Empty, loading, dan error state

### Loading

- Skeleton mempertahankan layout.
- Existing last-known-good tidak dihapus saat refetch.
- Tunjukkan bahwa filter sedang diterapkan tanpa jargon backend.

### Empty

> Tidak ada UMKM yang sesuai dengan filter. Hapus atau ubah filter untuk memperluas hasil.

Sediakan aksi **Reset filter**.

### Partial data

> Sebagian record tidak memiliki KBLI yang dapat dipetakan. Coverage: 56,33%.

### Query invalid

> Kombinasi analisis ini belum didukung. Kurangi jumlah dimensi atau pilih metrik lain.

### Field berubah

> Field “X” tidak lagi tersedia. Analisis lainnya tetap ditampilkan.

### General failure

> Data belum dapat dimuat. Coba lagi.

Jangan menampilkan SQL, stack trace, job ID, atau detail internal.

## 11. Profil UMKM

### Visual hierarchy

```text
┌──────────────── Hero/Cover ────────────────┐
│ [Foto] Nama Usaha                          │
│ [Aktif/Arsip] [Skala] [KBLI]               │
│ Lokasi ringkas                             │
└────────────────────────────────────────────┘
[Edit] [Archive/Restore] [Salin tautan] [PDF]

Ringkasan | Usaha | Lokasi | Finansial | Tenaga Kerja |
Pelaku Usaha | Kualitas Data | Informasi Tambahan
```

Boleh memakai tabs pada desktop jika seluruh section tetap dapat dituju melalui URL fragment dan keyboard. Mobile lebih baik memakai stacked sections/accordion.

### Field presentation

- Label dan format berasal dari registry.
- Empty tampil **Belum tersedia**.
- Invalid tampil **Perlu verifikasi**.
- Nilai sumber tampil **Dilaporkan** bila relevan.
- Text di-escape; URL/file divalidasi; HTML mentah tidak dirender.
- Image memakai fallback dan lazy loading.
- Field baru aman masuk **Informasi Tambahan** bila group belum ditentukan.
- Quarantined field tidak tampil.

### Privacy

- NIK: `************1234`.
- Telepon: `08******1234`.
- Tanggal lahir: kelompok usia.
- Domisili pribadi: tidak tampil.
- Nama pelaku: tampil untuk sesi authenticated.
- Alamat/peta usaha: tampil.
- Raw PII hanya pada pengalaman Edit yang berizin, bukan endpoint profil Analitik.

### Navigation/actions

- **Kembali ke analisis** mengembalikan state.
- Previous/next mengikuti daftar hasil dan berhenti di batasnya.
- Archived record dapat dibuka dengan badge yang jelas.
- Copy link menghasilkan internal authenticated URL.
- PDF membawa waktu data, timestamp ekspor, dan masking.

## 12. Saved analysis

- Save meminta nama saja; description/catatan keputusan tidak diperlukan.
- Open selalu menjalankan config pada current state.
- Rename dan delete tersedia.
- Jika field berubah, tampilkan warning dan pertahankan bagian config lain.
- Share URL tetap memerlukan login.
- Tidak ada public share link.

## 13. Export UX

- Tampilkan filter, jumlah estimasi, format, masking, dan batas sebelum submit.
- Detail CSV >50.000 tidak dapat diajukan; sarankan mempersempit filter.
- Job export tidak memblokir canvas.
- Status memakai bahasa: **Menunggu**, **Diproses**, **Selesai**, **Gagal**.
- Download link privat kedaluwarsa dalam 24 jam.
- Jangan tampilkan queue/worker detail.

## 14. Responsive

### Desktop/tablet

- Query controls horizontal atau grid.
- Grafik dan insight berdampingan bila ruang cukup.
- Tabel dapat memiliki sticky header.

### Mobile

- Query builder dalam drawer.
- KPI stacked/grid dua kolom.
- Grafik disederhanakan; alternatif tabel mudah dijangkau.
- Profil menjadi stacked sections.
- Tabel memakai card/list atau horizontal scroll yang diberi affordance.

## 15. Accessibility checklist

- WCAG 2.1 AA contrast.
- Semua kontrol memiliki accessible name.
- Fokus terlihat dan urutan logis.
- Dialog/drawer mengunci dan mengembalikan fokus.
- Grafik memiliki ringkasan serta data table.
- Tooltip bukan satu-satunya sumber informasi.
- Status tidak hanya dibedakan warna.
- Map memiliki daftar wilayah alternatif.
- Angka dibaca screen reader dengan unit yang benar.
- Reduced-motion dihormati.

## 16. Format lokal

- Bahasa antarmuka: Indonesia.
- Zona waktu: WIB.
- Tanggal: format Indonesia dengan nama bulan bila ruang cukup.
- Angka: pemisah ribuan Indonesia.
- Mata uang: Rupiah (`Rp`).
- Persentase menyatakan denominator.

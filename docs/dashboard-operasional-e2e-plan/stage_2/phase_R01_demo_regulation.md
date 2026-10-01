# R01 — Branding, SSO, demo peran, dan aspek regulasi

- **Stage:** merah; **ID:** N1-01, N1-02, N1-03, N2-01, N5-01. **Dependency:** Y10 berstatus done.
- **Rujukan teknis lama:** `../legacy/phase_2.md` (switcher), `../legacy/phase_5.md` (5 aspek), `../legacy/phase_7.md` (toggle offline). Keputusan kuning tetap prioritas.
- **Scope:** manifest R01. Tidak boleh mengganti proteksi role API dengan switcher frontend.

## Implementasi

1. Pasang logo resmi DISKUK Provinsi Jawa Barat dan identitas Portal Integrasi Satu Data SIDT Jabar pada login, dengan asset/izin branding yang benar dan alt text.
2. SSO Jabar Digital Services harus memakai kontrak IdP riil (OIDC/SAML sesuai penyedia), state/nonce/PKCE jika relevan, mapping account dan role Y01, logout, error, serta fallback login. Jika IdP belum memberi sandbox, label `not provider-proven`, jangan mengklaim SSO aktif.
3. Widget Mode Pengujian Prototipe memakai **hanya akun demo `dummy_`** dan endpoint session demo yang aman pada environment disposable. Empat contoh akun `admin@diskuk.jabarprov.go.id`, `admin.subang@jabarprov.go.id`, `coach.pendamping@jabarprov.go.id`, dan `wawan.leathercraft@gmail.com` membuka dashboard dan data scoped masing-masing. Jangan menaruh credential/token dalam bundle atau membiarkan widget di production tanpa feature flag dan otorisasi.
4. Tabulasi lima aspek perkembangan usaha: legalitas/formalitas, manajemen/tata kelola, pemasaran/digitalisasi, keuangan/akses pembiayaan, kemitraan/jejaring. Tetapkan definisi numerator/denominator, sumber data, nilai hilang, dan versi regulasi sebelum label kepatuhan.
5. Toggle simulasi offline PWA hanya dalam mode demo. Ia harus melalui antrean/sinkronisasi asli Y03 dan membedakan keadaan simulasi dari konektivitas nyata; tidak boleh menghasilkan laporan di luar aturan Jumat.

## Acceptance per ID

| ID | Aksi | Bukti wajib |
| --- | --- | --- |
| N1-01 | Buka login desktop/mobile | Kedua identitas terlihat jelas, logo resmi dan alt text benar. |
| N1-02 | SSO masuk/keluar, callback salah/ulang | Akun terpetakan, scope benar, CSRF/state terjaga, provider receipt sandbox. |
| N1-03 | Klik empat akun demo | Tiap dashboard/kuota/antrian/Passport sesuai role; akun produksi tidak dapat dipilih. |
| N2-01 | Pilih lima aspek dan filter wilayah | Indikator/angka terhitung dari sumber yang terdefinisi, bukan label kosong. |
| N5-01 | Toggle offline, buat laporan Jumat, online kembali | Banner simulasi jelas; antrean lalu sinkron sekali via jalur Y03. |

## State dan gate

- Uji IdP unavailable, user tanpa mapping, role berubah, switcher dua tab, token demo kedaluwarsa, data aspek kosong, toggle saat sync berjalan. Gate: provider sandbox SSO, browser empat persona, API scope, regresi Y01/Y03 dan angka regulasi, no-secret scan.

## Catatan pelaksanaan 28 September 2026

Pengguna meminta pekerjaan R01 berjalan paralel walau receipt Y10 masih `blocked`. Implementasi boleh disiapkan, tetapi verdict R01 tetap `partial` dan R05 tidak boleh menganggap Stage 2 terbuka. Kontrak sandbox IdP Jabar belum tersedia; atas arahan pengguna, tombol SSO memakai simulasi akun `dummy_` pada stack disposable dan harus tetap dilabeli simulasi. SSO provider asli tetap `not provider-proven`.

JDIH Kementerian UMKM mencatat [Permen UMKM Nomor 2 Tahun 2026](https://jdih.umkm.go.id/doc/detail/kdaGwXzTbbXQnHCu4fNxvWoUg8_eQQDh3hRUoD9-tj8qjKHI89VYeSW0ITaDbHP-) tentang Pedoman Klasifikasi dan Tingkat Perkembangan UMKM (diundangkan 4 Mei 2026). PDF yang dapat diunduh dari portal peraturan pusat masih bertanda “RANCANGAN”; Pasal 16–17/Lampiran I pada PDF itu memakai bukti dokumen verifikatif dan penilaian SAPA UMKM. Field boolean `usaha_atribut_jabar` adalah indikator operasional dari brief, belum setara dengan bukti dokumen resmi. UI harus menyebut numerator, denominator data diketahui, data kosong, sumber, dan tidak menampilkan skor/tahap kepatuhan resmi sampai naskah final, pemetaan dokumen, dan integrasi SAPA terverifikasi.

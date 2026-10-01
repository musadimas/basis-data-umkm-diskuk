# Receipt R03 — Pendaftaran kegiatan, e-pass/sertifikat, fasilitasi bantuan

- **Tanggal:** 29 September 2026.
- **Verdict:** `partial`. API, migrasi, dan mock browser terbukti; Y10 kini `partial` (bukan `done`) sehingga gate Stage 2 belum lulus. Jangan menyatakan `done`.
- **ID:** N7-01, N7-02, N7-03.
- **Keputusan pengguna:** WhatsApp e-pass **dihapus** dari lingkup (tanpa dispatcher/outbox/route resi). E-pass = QR di halaman peserta. Ekspor XLSX untuk provinsi + kabkota ter-scope. Dua indikator IP-UMKM ditambahkan. Kuota bantuan `terisi` dikurasi lewat endpoint provinsi.
- **Isolasi:** seluruh mutasi runtime pada clone `r03_clone` dan container `r03-directus`; keduanya sudah dihapus. Stack bersama tidak disentuh. Detail: [runtime-evidence.md](artifacts/R03/runtime-evidence.md).

## Hasil per ID

| ID | Bukti | Sisa gate |
| --- | --- | --- |
| N7-01 | Real HTTP pada clone: prefill hanya sesi pemilik (parameter NIB/usaha diabaikan); event `registration_url` → 409 `PENDAFTARAN_EKSTERNAL`; skala/wilayah/NIB → 422; pakta/consent/aksesibilitas → 400; daftar ulang 409; empat pendaftar serentak untuk kuota 1 → `menunggu` + 3 `daftar_tunggu`. | Browser real-API belum dijalankan. |
| N7-02 | Keputusan + audit (8 baris), `KUOTA_PENUH` 409, daftar tunggu naik saat batal, scan QR dua kali → satu presensi, QR lintas peserta 404, sertifikat ditolak pada 47/59 (79,7%), tugas gagal, peserta ditolak; terbit pada 48/59 dan 8/10; tiga retry paralel → satu sertifikat + satu baris dampak aktif; cabut → `aktif=FALSE` dan verifikasi publik `dicabut`; XLSX dibuka openpyxl, tanpa NIK/NIB; umkm 403, kabkota hanya kotanya. | 79,9% persis tak terjangkau (`jumlah_sesi` ≤ 60); batas dibuktikan 79,7/81,4/80,0 dan unit test 1000 sesi. Pemindaian QR kamera dan PDF sertifikat tidak ada. |
| N7-03 | Draft tersembunyi, 8 kartu setelah terbit, filter uang/barang/jasa, filter tidak valid 400, `serverNow` dari server, kuota 0 → sisa 0, `PATCH /:id/terisi` hanya provinsi dan ≤ kuota. | Kartu sisa 0 masih `statusPendaftaran: "dibuka"` (status hanya dari tanggal): keputusan produk. |

## Bug yang ditemukan bukti runtime dan diperbaiki

1. Syarat wilayah selalu gagal (`u.kota_nama` vs alias `kota`).
2. Kuota tidak menahan slot pendaftar `menunggu`.
3. Kabkota bisa menilai tugas, menerbitkan, dan mencabut sertifikat kota lain (kini 404).
4. Penerbitan sertifikat 500 (6 placeholder, 5 binding).
Tes regresi ditambahkan di `test/registrasi.test.js`.

## Perbaikan kontrak dan pembersihan

- Penghapusan WhatsApp dari R03: hook `registrasi-epass.js`, `kirimNotifikasi`, route `/notifikasi/receipt`, tabel `kegiatan_notifikasi`, kolom `epass_dikirim_pada`, OAS, tes, manifest, dan tipe/UI web.
- `permen-aspek.js`: ketiadaan sertifikat dihitung `belumAdaData`, bukan `tidak`.
- Route `operasional|GET|/aspek-perkembangan` dicatat sebagai legacy di contract test (memakai `wrap` seperti route operasional lain).
- Tes browser mock `registrasi-kegiatan.spec.ts`: pola `toPass` pada langkah pindai QR (klik sebelum hidrasi).

## Bukti perintah

| Perintah | Hasil |
| --- | --- |
| `node --test services/directus/extensions/program/test/*.test.js` | 169 pass, 0 fail |
| `node --test services/directus/test/*.test.mjs` | 51 pass, 3 skip, 0 fail |
| `node --test …/directus-extension-operasional/test/*.cjs` | 25 pass (18 sebelum tes tambahan agen runtime) |
| `pnpm --dir apps/web typecheck`, ESLint terarah `--max-warnings 0` | lulus |
| `pnpm exec playwright test tests/e2e/{fasilitasi,registrasi-kegiatan,kegiatan}.spec.ts --project=chromium` | 14 pass, 3 skip; dua tes registrasi flaky saat mesin dibebani, lulus pada rerun dengan pola `toPass` |
| `check_coverage.py` | exit 0 |
| Migrasi G `latest` → `down` → `latest` pada clone | bersih (readback tabel, kolom, 18 indeks) |

## Keputusan desain (29 September 2026, pengguna)

- **Daftar tunggu naik:** admin kabkota hanya menaikkan antrean kotanya sendiri; provinsi menaikkan antrean tertua kegiatan. Diimplementasikan di `putuskanPendaftar` dan diuji (`registrasi.test.js`). Belum diuji di runtime clone.
- **Kartu bantuan kuota habis:** `statusPendaftaran` = `penuh` ("Kuota penuh") bila `terisi >= kuota`, setelah pemeriksaan `ditutup`/`segera`. Diuji unit dan mock browser (`fasilitasi.spec.ts` 3/3).
- **Diterima tanpa `skor_talent`:** peserta daftar tunggu yang naik tidak dihitung skornya. Pengguna menerima apa adanya.
- **Verifikasi publik sertifikat** menampilkan UUID usaha dan kegiatan: diterima pengguna.
- Angka XLSX ditulis sebagai teks (kosmetik).

## Sisa gate

Y10 `blocked`; bukti browser real-API R03; keputusan untuk titik desain di atas; `scope_guard` global masih bercampur dengan pekerjaan paralel.

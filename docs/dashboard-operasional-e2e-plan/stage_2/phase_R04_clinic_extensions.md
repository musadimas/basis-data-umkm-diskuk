# R04 — Statistik klinik dan integrasi hasil konsultasi

- **Stage:** merah; **ID:** N7-04, N7-05. **Dependency:** Y10 done dan Y09.
- **Scope:** manifest R04; tambah metrik/direktori dan event integrasi, tanpa melemahkan kerahasiaan tiket.

## Implementasi

1. Halaman depan klinik memperjelas layanan dan menampilkan total konsultasi selesai, waktu respons rata-rata, CSAT dari jawaban dengan consent, direktori coach/konsultan dan ketersediaan slot yang benar. Definisikan timestamp awal/akhir dan denominator; jangan tampilkan CSAT dari sampel nol sebagai nilai numerik.
2. Saat tiket `Selesai`, tulis outcome terstruktur: kepatuhan/perbaikan usaha yang diverifikasi, indikator perkembangan usaha yang terpengaruh, sumber tiket/aktor/tanggal. Integrasi ke profil UMKM memakai outbox atau transaksi dengan idempotency; hanya outcome yang diperbolehkan masuk profil, bukan catatan sensitif sesi. Rekalkulasi indikator memakai versi dan memungkinkan koreksi/revoke dengan audit.

## Acceptance per ID

| ID | Input/aksi | Bukti |
| --- | --- | --- |
| N7-04 | Fixture tiket selesai/belum, CSAT kosong/isi, jadwal coach | Total/rata-rata/CSAT benar, direktori dan ketersediaan cocok dengan DB. |
| N7-05 | Tutup tiket dengan outcome terverifikasi, retry dan koreksi | Profil/indikator berubah tepat sekali; sumber dan histori terlacak, catatan privat tidak bocor. |

## State dan gate

- Uji tiket tanpa outcome, outcome belum terverifikasi, dua close bersamaan, pekerjaan integrasi gagal, hasil dikoreksi, tiket dibuka ulang, coach tidak tersedia. Gate: perhitungan metrik, SQL readback profil/outbox, API IDOR, browser klinik/profil, scan PII, regresi status Stage 1.

## Addendum implementasi 29 September 2026

Manifest lama menunjuk `directus-extension-operasional/src/klinik-*-service.js`, migrasi `20260926P` (sudah dipakai `katalog-media`), dan halaman `dashboard/klinik/[id].vue` yang tidak pernah ada. Jalur kanonik pasca-`790559b` adalah `extensions/program/src/endpoints/klinik/` dan satu halaman `dashboard/klinik.vue`; manifest R04 diganti ke path nyata (alasan di receipt).

**Keputusan pengguna (29 September 2026, via tanya-jawab):**

1. **Direktori** = tabel kurasi baru `klinik_konsultan` (nama, poli/keahlian, afiliasi PLUT/Dinas/Praktisi, hari + slot mingguan, tautan opsional ke akun pendamping, aktif). Dikelola admin lewat Data Studio seperti `konsultasi_poli`; tidak ada grant Public, publik hanya lewat DTO allowlist. Belum ada UI kurasi khusus provinsi.
2. **CSAT** diisi pemohon sendiri setelah tiket `selesai` lewat Lacak Tiket (nomor + WhatsApp + ALTCHA) dengan checkbox consent. Satu jawaban per tiket. Jawaban tanpa consent tersimpan tetapi tidak pernah dihitung.
3. **Outcome dua langkah, beda aktor:** petugas yang menangani mengajukan (`diajukan`); provinsi atau kab/kota pemilik wilayah usaha memverifikasi (`terverifikasi`), dan tidak boleh orang yang sama dengan pengaju. Koreksi (versi baru langsung terverifikasi, versi lama `dicabut` dengan alasan) dan pencabutan adalah hak verifikator dan wajib beralasan.
4. **`selesai` tetap final** (kontrak Y09 dipertahankan). Salah catat diperbaiki lewat koreksi/cabut outcome; satu-satunya "buka ulang" yang sah tetap `batal → dijadwalkan`.

**Definisi angka publik (`GET /v1/program/klinik/statistik`; teks definisi ikut dikirim server):**

| Angka | Definisi |
| --- | --- |
| Total konsultasi selesai | Jumlah `konsultasi_tiket` berstatus `selesai`, semua waktu. |
| Waktu respons rata-rata | Awal = `konsultasi_tiket.date_created`. Akhir = transisi status pertama ke status selain `batal` di `konsultasi_tiket_audit` (petugas memproses tiket). Penyebut = tiket yang punya transisi itu; tiket masih "Tiket Masuk" atau hanya dibatalkan tidak dihitung. Jam kalender, bukan jam kerja. |
| CSAT | Rata-rata nilai 1–5 dari jawaban ber-`consent = true`. Sampel nol ⇒ `null` (UI: "Belum ada penilaian"), tidak pernah 0. |

**Ketersediaan konsultan** (`GET /v1/program/klinik/konsultan?hari=1..30`, default 14): hari kerja mulai besok (aturan `tanggalTidakValid` yang sama dengan pemesanan), jadwal mingguan konsultan dikurangi (a) slot poli-nya yang dipegang tiket aktif dan (b) bila konsultan tertaut akun pendamping, slot yang dipegang pendamping itu di tiket lain. Dua query tetap berapa pun jumlah konsultan. Pemesanan tiket tidak diubah: slot tetap per poli; ketersediaan konsultan bersifat informasi.

**Model outcome:** `konsultasi_outcome` (satu outcome hidup per tiket lewat unique parsial, `versi`, status `diajukan/terverifikasi/dicabut`, pengaju/verifikator/pencabut + nama snapshot + waktu, `menggantikan`), `konsultasi_outcome_item` (atribut dari 15 kolom `usaha_atribut_jabar` × jenis `kepatuhan|perbaikan`), `konsultasi_outcome_audit`. Tidak ada kolom teks bebas dari sesi. Integrasi: (1) profil usaha `GET /operasional/usaha/:id` memuat `hasilKonsultasi` (hanya terverifikasi: nomor tiket, poli, verifikator, tanggal, atribut+jenis); (2) indikator IP-UMKM `aspek-perkembangan` menjadi `indikator-operasional-v2`: indikator atribut bernilai `ya` bila lapangan `ya` **atau** ada outcome terverifikasi untuk atribut itu; nilai lapangan `ya` tidak pernah diubah menjadi `tidak`. Penutupan tiket boleh membawa `outcome` dalam PATCH yang sama (atomik dengan status `selesai`), atau diajukan kemudian lewat `POST /tiket/:id/outcome`.

**Kontrak baru (semuanya di `/v1/program/klinik`):** `GET /statistik`, `GET /konsultan`, `POST /tiket/csat` (publik, captcha); `POST /tiket/:id/outcome`, `GET /outcome`, `POST /outcome/:id/{verifikasi,koreksi,cabut}` (petugas; tiga terakhir hanya provinsi/kabkota). DTO tiket petugas bertambah `outcome` dan `outcomeBisaDicatat` (server yang memutuskan tombol apa yang tampil); DTO lacak bertambah `csat`.

**Keputusan yang dicatat, bukan disembunyikan:** tiket tanpa `usaha` (pemesan anonim, `sumber_identitas = manual`) tidak dapat memiliki outcome (409 `USAHA_TIDAK_TERTAUT`) karena tidak ada profil untuk diperbarui. Verifikator wajib berbeda dari pengaju: pada instalasi dengan satu akun provinsi dan tanpa kab/kota untuk usaha itu, outcome yang diajukan provinsi tidak bisa diverifikasi. Koreksi oleh verifikator adalah verifikasi versi barunya (pengoreksi boleh sama dengan pengaju versi lama).

**Berkas web (jalur nyata):** `components/klinik/{Statistik,Direktori,OutcomeForm,OutcomePanel,OutcomeCatat,OutcomeAntrean}.vue` (baru), `LacakTiket.vue`, `pages/(public)/konsultasi.vue`, `pages/(private)/dashboard/klinik.vue` (hanya wiring), `pages/(private)/dashboard/data-lapangan/[id].vue` (bagian "Hasil konsultasi klinik (terverifikasi)"), `lib/klinik.ts`, `constants/PROGRAM.ts`, tipe di `types/{program,operasional}.ts`, mock/fixture, dan spec `tests/e2e/klinik-outcome.spec.ts`. Bukti dan verdict: `receipt_R04_clinic_extensions.md`, `artifacts/R04/runtime-evidence.md`.

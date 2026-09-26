# Y02 — Tabular dan Talent Scouting

- **Stage:** kuning; **ID:** M4-01…M4-04. **Dependency:** Y01.
- **Rujukan teknis:** `../legacy/phase_4.md` dan `../legacy/phase_6.md`; cek `../main_plan.md`.
- **Scope:** manifest Y02. Lima aspek perkembangan usaha N2-01 bukan bagian tahap ini.

## Implementasi

1. Pastikan 15 atribut Jabar dan field legalitas/data lapangan yang dipakai Talent tersedia dengan sumber, timestamp, dan aturan verifikasi. Tambahkan aksi Lihat Detail dan Ajukan ke Talent Scouting per baris Tabular yang berizin. Filter server, pagination, dan scoping Y01 tetap berlaku.
2. Form nominasi mengambil data SIDT server-side. Nama usaha, NIB, omzet historis, alamat, serta NIK **terenkripsi/tersamarkan** ditampilkan read-only. NIK mentah tidak boleh dikirim sebagai field editable maupun dicatat dalam browser/log. Isian petugas: kapasitas bulanan dan satuan, kesiapan Halal/BPOM/PIRT/HKI, QRIS/pencatatan digital, komitmen kegiatan, serta unggah surat komitmen berlabel simulasi jika belum memakai dokumen riil.
3. Simpan snapshot input dan versi formula Talent Index. Implementasikan empat aspek 25% (finansial, pasar/produk, legalitas, pengelolaan/SDM), skor total 0–100 deterministik, normalisasi, penanganan data hilang, dan rekomendasi yang dapat dijelaskan. Animasi Hitung Skor hanya menggambarkan kalkulasi server yang selesai.
4. Nominasi bergerak `diajukan → dinilai → scouting`. Hanya admin provinsi menerbitkan Berita Acara; operasi transaksi atomik mengisi BA dan `talent_status=Scouting`, dengan idempotency pada retry. Jangan menyamakan status Scouting dengan label yang lebih tinggi tanpa aturan.

## Acceptance per ID

| ID | Input/aksi | Bukti wajib |
| --- | --- | --- |
| M4-01 | Klik kedua aksi pada baris berizin, lalu coba baris luar scope | Detail/nominasi benar; request lintas wilayah ditolak. |
| M4-02 | Buka form dari SIDT dan isi seluruh field, unggah bukti | Read-only tetap tidak dapat diubah lewat POST; isian tersimpan dan dibaca ulang; NIK tersamarkan. |
| M4-03 | Hitung fixture lengkap, kosong, dan batas 0/100 | Empat skor 25%, total dan rekomendasi konsisten antara API dan UI; animasi berakhir pada hasil persisted. |
| M4-04 | Provinsi terbitkan BA, pendamping/kota mencoba aksi sama | BA dapat dibuka ulang; status Scouting persisted; role lain ditolak, duplikat tidak menerbitkan dua BA. |

## State dan gate

- Uji kosong, data SIDT berubah setelah form dibuka, dua petugas menilai bersamaan, dua klik BA, lampiran gagal, nominasi sudah Scouting, dan retry jaringan.
- Gate: schema rollback disposable, kontrak skor dengan fixture angka hasil hitung manual, query readback BA/status, API role-scope, browser dari Tabular sampai BA. Receipt menyebut sumber tiap atribut dan kekosongan data yang masih perlu keputusan domain.

## Receipt eksekusi Y02 (26 Sep 2026, agen paralel bersama Y01)

- **Verdict: `partial`** — semua unit/contract/browser mock hijau; `not runtime-proven`
  (tidak ada disposable stack Docker dijalankan; `operasional.directus.spec.ts`
  skip tanpa `PLAYWRIGHT_USE_REAL_API`). Bukan `done` sampai readback BA/status
  pada stack disposable + Y01 `done` (dependency).
- **ID:** M4-01 (aksi Tabular + tolak lintas wilayah), M4-02 (prefill read-only,
  NIK tersamar, 400 tak bisa bypass), M4-03 (4×25% deterministik, fixture
  hitung manual), M4-04 (BA atomik provinsi-only, idempotent retry).
- **Amandemen scope (reviewable):** `scope_manifest.json` Y02 tambah 3 path shell
  extension bersama Y01 — `...-operasional/package.json`, `src/errors.js`,
  `test/index.test.cjs`. 31 path `outside` sisanya milik agen Y01 (tak disentuh).
- **Merge dengan Y01 (file bersama, Y01 pemilik logika):** `src/index.js` (+3 route
  Y01 `/me`, `/aktivitas`, `/internal/resolve-nib` dari `me-service.js`);
  `operasional-schema.contract.test.mjs` (test Y01 utuh + 3 test Y02);
  `seed-dummy-operasional.{mjs,sql}` + `cleanup-*.sql` (blok Y02 berlabel,
  memakai akun/usaha Y01); `profile-service.js` (`canEdit` provinsi+kabkota,
  `editPath` in-app — arsip tetap Y01); mock `+ /panel/operasional/me`
  (wajib setelah `useAuth.currentUser` Y01 pindah ke route ini).
- **Sumber atribut & keputusan domain:** 15 atribut dari `usaha_atribut_jabar`
  (nullable; `null`="Belum didata", dihitung 0); SIDT dari `usaha`+join wilayah;
  NIK hanya `maskNik` (tidak pernah ke browser/log); omzet/TK dari seed Y01.
  Terbukti silang: 7 literal skor seed = hitung manual atas omzet/TK Y01
  (01→97.75, 02→78.00, 03→93.50, 04→50.44, 05→73.75, 07→19.25, 08→87.88).
  Butuh keputusan domain: lima aspek N2-01 di luar tahap (tak disentuh);
  label legacy `phase_6.md` "(Status: Dipertimbangkan)" untuk 79.38 bertentangan
  dengan ledger (≥75 → Direkomendasikan) — dipakai ledger.
- **Perintah + exit:** operasional ext 41/41, contract 11/11, worker
  legacy 4/4 + suite 22/22, analitik 37/38 (1 skip bawaan), directus 13/13,
  web unit 22/22, typecheck 0, eslint 0, oxlint 0 error (4 warning milik Y01),
  compose config OK, `node --check` seed OK, playwright chromium 7/7
  (4 Y02 + tabular/umkm-profile). Screenshot: `data-lapangan.png`,
  `talenta-ajukan.png`, `talenta-daftar.png`, `umkm-profile-actions.png`.
- **Tidak berjalan:** disposable stack + `operasional.directus.spec.ts`,
  migrasi C/E `up/down` terhadap DB nyata, browser tablet/mobile, cleanup dummy
  verde (`nol baris dummy_`). Risiko: agen Y01 masih menulis file bersama
  (`me-service.js`, `useAuth`, `SignInForm`) — pull/rebase sebelum Y10.

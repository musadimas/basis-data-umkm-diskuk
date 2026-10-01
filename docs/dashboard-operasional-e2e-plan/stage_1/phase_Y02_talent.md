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

## Receipt eksekusi Y02

Lihat dokumen receipt lengkap di [Receipt Y02](stage_1/receipt_Y02_talent.md).
- **Verdict:** `partial` (27 September 2026, pasca-merge `790559b`).
- Seluruh unit test, kontrak skema, typecheck, dan mock browser E2E Playwright hijau (11/11 suite Playwright terkait, 50/50 extension program, 15/15 contract test, 40/40 vitest).
- Status `not runtime-proven` hingga runtime stack disposable PostgreSQL/Directus diuji bersamaan dengan Y01 via `PLAYWRIGHT_USE_REAL_API=1`.

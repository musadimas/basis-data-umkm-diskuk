# R02 — Agregasi eksekutif, peta risiko, direktori investor

- **Stage:** merah; **ID:** N5-02, N5-03, N6-01, N6-02. **Dependency:** Y10 done; memakai Y03/Y04/Y05/Y06.
- **Rujukan:** `../legacy/phase_9.md` untuk agregat dan at-risk. Direktori investor adalah penambahan baru, bukan sekadar katalog publik.

## Implementasi

1. Agregat provinsi/kota: delta omzet peserta Accelerator versus baseline SIDT dengan aturan nol/missing, kepatuhan pelaporan Jumat (>95% sebagai target yang ditampilkan, bukan angka dipaksa), grafik 12 minggu target agregat putus-putus dan realisasi terverifikasi hijau tebal. Agregat tidak boleh menghitung draft/ditolak.
2. Deteksi penurunan omzet ≥30% dua pekan berturut-turut dari realisasi terverifikasi, sesuaikan baseline/minggu hilang; buat pin risiko merah dan tugas pendamping wilayah yang idempotent. Hak akses kota/pendamping tetap dari Y01.
3. Direktori investor mengindeks profil yang telah disetujui untuk dibagikan, filter kebutuhan modal <Rp50 juta/Rp50–500 juta/>Rp500 juta, skema KUR/LPDB/offtaker/penyertaan modal/konsinyasi/ekspor dan KBLI. Data finansial privat hanya untuk investor terverifikasi dengan persetujuan dan audit akses; tidak masuk endpoint katalog umum.
4. Deal card menampilkan profil, jenama, domisili, Talent Index, pertumbuhan omzet mingguan, margin, kebutuhan dana/kapasitas, portofolio, Executive Summary/pitch deck PDF, serta LOI digital terhubung ke jalur Y06. Bedakan nilai terverifikasi dan deklarasi.

## Acceptance per ID

| ID | Input/aksi | Bukti |
| --- | --- | --- |
| N5-02 | Fixture 12 minggu, baseline, minggu ditolak/hilang | Grafik/rasio terhitung benar; target >95% ditampilkan sebagai target. |
| N5-03 | Dua penurunan beruntun dan satu pekan data hilang | Pin+tugas hanya untuk kasus valid, tidak duplikat pada recompute. |
| N6-01 | Kombinasikan tiga rentang modal, skema, KBLI | Query server dan hasil tepat; data tanpa persetujuan tersembunyi. |
| N6-02 | Buka deal card/PDF dan kirim LOI | Semua field dari sumber sah; PDF valid; satu LOI persisted/readback. |

## State dan gate

- Uji data dasar nol, variasi zona/minggu, dua job agregasi, akses investor tanpa verifikasi, pencabutan persetujuan, data margin kosong, duplicate LOI. Gate: fixture matematika manual, SQL agregat/tugas, API scope/PII, browser grafik+peta+direktori, parser PDF, regresi Stage 1.

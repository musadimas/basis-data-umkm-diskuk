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

## Addendum implementasi 28 September 2026 — kontrak aktif

- Source aktif ialah `services/directus/extensions/program/src/endpoints/executive/{index,rules}.js`, bukan `directus-extension-operasional` atau tabel `talenta` dalam rujukan legacy. Endpoint berada di `/v1/program/executive`. Migrasi baru `20260928F-executive-investor.js` tidak memakai kembali nomor M yang sudah ditempati kegiatan. Manifest R02 diselaraskan dengan file nyata.
- Minggu selesai dihitung dari `program_peserta.tanggal_mulai` menurut tanggal `Asia/Jakarta`, maksimum 12. Kepatuhan = jumlah laporan **disetujui** / jumlah minggu selesai peserta. Target `>95%` hanya label ambang; data tidak dinaikkan paksa. Tren menjumlah target peserta tiap minggu dan `realisasi_omzet` disetujui; minggu tanpa realisasi tetap `null`. Kenaikan omzet ialah rata-rata persentase per peserta terhadap `usaha.omzet_tahunan / 52` (SIDT), mengecualikan baseline kosong/nol. Hanya fase `akselerasi` dengan status aktif/selesai masuk agregat.
- Risiko aktif hanya bila dua minggu selesai **terakhir** mempunyai laporan disetujui dan masing-masing realisasi `≤70%` dari baseline positif; minggu hilang/ditolak memutus rangkaian. `POST /monitoring/recompute` membuat tugas pendamping unik `(peserta, minggu_akhir)` dan melewatkan peserta tanpa pendamping. `GET /monitoring` dan `/monitoring/tugas` mengikuti scope `provinsi`/`kabkota`/`pendamping` dari Cakupan Pemanggil.
- Profil investor disimpan privat dalam `investor_profil`, dengan persetujuan eksplisit pemilik usaha dan persetujuan kurator. Pembaruan profil meminta kurasi ulang; pencabutan langsung menyembunyikan direktori/detail/PDF/LOI. Akun investor terpisah memakai pengguna Directus `app_role = NULL` dan role Directus **Investor Terverifikasi** dari migrasi R02. Policy role ini hanya dapat membaca data akun sendiri; role umum Application User mempunyai izin koleksi lain dan tidak boleh dipakai investor. Kurator memverifikasi akun dalam `investor_verifikasi`. Seluruh route direktori/deal card mengecek sesi, role khusus, dan verifikasi dalam handler; `publik()` dipakai hanya sebagai adapter route karena empat role dashboard tidak mencakup investor. List/detail/PDF/pitch deck/LOI mencatat `investor_akses_audit`. Tidak ada izin Directus Public ke tabel privat.
- Filter server memakai rentang modal `kecil <50 juta`, `menengah 50–500 juta` inklusif, `besar >500 juta`, salah satu dari enam skema, dan awalan KBLI 2–5 digit. Detail menampilkan Talent Index dari pengajuan disetujui, pertumbuhan dari dua laporan KPI disetujui berurutan, dan margin berlabel `deklarasi` hingga ada verifikasi sah. Executive Summary PDF dibuat server; pitch deck hanya tersedia jika PDF milik usaha diunggah. LOI investor memakai `produk_loi` Y06, hanya untuk produk tayang, dengan `idempotency_key` dan identitas investor terverifikasi.
- Halaman: `/dashboard/akselerasi`, `/dashboard/usaha/investor`, `/dashboard/investor-kurasi`, `/investor`, `/investor/:id`. Tautan `/sign-in?returnTo=/investor` memakai sesi Directus yang sama. Lihat `receipt_R02_executive_investor.md` untuk verdict dan bukti yang sudah/ belum ada; Y10 tetap `blocked` sampai receipt gate Stage 1 berubah.
- Peta memakai MapLibre bila WebGL2 tersedia. Bila WebGL2 tidak tersedia, grafik koordinat tetap menunjukkan pin merah dan daftar teks; uji browser isolasi menjalankan cabang fallback ini.

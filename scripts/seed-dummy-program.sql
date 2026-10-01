-- Seed data dummy untuk sembilan menu Program (Talent Scouting, Akselerasi, Monitoring Eksekutif,
-- Kurasi Investor, Kurasi/Produk Katalog, Talent Passport, Klinik, Kegiatan & Pendaftar).
-- Aman untuk database berisi data nyata: memakai 27 kab/kota asli (tanpa wilayah dummy), tidak
-- mengubah usaha asli, dan tidak memicu rebuild penuh read model analitik.
--
-- Penanda (semua dibersihkan oleh scripts/cleanup-dummy-program.sql):
--   usaha.sumber_id 'dummy_prog_NNN', pelaku_usaha.nik 'dummy_pu_NNN', alamat.alamat_jalan 'dummy_…'
--   talent_berita_acara.nomor, konsultasi_tiket.nomor, klinik_konsultan.nama, kegiatan.judul 'dummy_…'
--   Nama yang tampil (usaha, produk, jenama, kegiatan, konsultan) juga diawali 'dummy_'.
--   Baris turunan (pengajuan, peserta, KPI, produk, passport, outcome, pendaftaran) ikut terhapus
--   lewat FK CASCADE dari usaha/tiket/kegiatan dummy.
--
-- Prasyarat: akun dummy_admin@…, dummy_coach.pendamping@…, dummy_wawan.leathercraft@… sudah ada
-- (scripts/seed-dummy-operasional.mjs seed). Sesudah ini jalankan scripts/sign-dummy-program.mjs
-- di container directus supaya passport dan sertifikat dummy bertanda tangan sah.
--
-- Pemakaian: psql -v ON_ERROR_STOP=1 -f scripts/seed-dummy-program.sql
\set ON_ERROR_STOP on
BEGIN;
-- Trigger analitik pada pelaku_usaha/alamat mengantrekan rebuild PENUH (jutaan baris). Matikan
-- selama seed; proyeksi per usaha dummy diantrekan manual di akhir.
SET LOCAL diskuk.analytics_bulk_ingest = 'on';
SET LOCAL TIME ZONE 'Asia/Jakarta';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM usaha WHERE sumber_id LIKE 'dummy\_prog\_%') THEN
    RAISE EXCEPTION 'Data dummy program sudah ada: jalankan scripts/cleanup-dummy-program.sql dulu';
  END IF;
END $$;

CREATE TEMP TABLE dm_akun ON COMMIT DROP AS SELECT
  (SELECT id FROM directus_users WHERE email = 'dummy_admin@diskuk.jabarprov.go.id') AS admin,
  (SELECT id FROM directus_users WHERE email = 'dummy_coach.pendamping@jabarprov.go.id') AS coach,
  (SELECT id FROM directus_users WHERE email = 'dummy_wawan.leathercraft@gmail.com') AS umkm;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM dm_akun WHERE admin IS NULL OR coach IS NULL OR umkm IS NULL) THEN
    RAISE EXCEPTION 'Akun dummy belum lengkap: jalankan scripts/seed-dummy-operasional.mjs seed dulu';
  END IF;
END $$;

-- Hari ini (WIB) sebagai jangkar semua tanggal relatif, supaya data selalu "segar" saat di-seed.
CREATE TEMP TABLE dm_hari ON COMMIT DROP AS SELECT CURRENT_DATE AS hari_ini;

-- ── 30 usaha dummy di 8 kab/kota asli ────────────────────────────────────────
CREATE TEMP TABLE dm_usaha (
  n INT PRIMARY KEY, nama TEXT, kota INT, kbli TEXT, skala TEXT, omzet BIGINT, produk TEXT, kategori TEXT,
  jk TEXT, pemilik TEXT,
  usaha UUID NOT NULL DEFAULT gen_random_uuid(), pelaku UUID NOT NULL DEFAULT gen_random_uuid(),
  alamat INT, kelurahan INT, lat NUMERIC, lng NUMERIC
) ON COMMIT DROP;
INSERT INTO dm_usaha (n, nama, kota, kbli, skala, omzet, produk, kategori, jk, pemilik) VALUES
  (1,  'Batik Mega Mendung',          42, '13134', 'small', 480000000, 'Batik tulis',            'fashion',              'female', 'Siti Aminah'),
  (2,  'Keripik Tempe Rasa Sunda',    43, '10794', 'micro', 180000000, 'Keripik tempe',          'makanan',              'female', 'Dewi Lestari'),
  (3,  'Kopi Puntang Wangi',          43, '10750', 'small', 620000000, 'Kopi arabika sangrai',   'minuman',              'male',   'Asep Saepudin'),
  (4,  'Tas Kulit Garut Jaya',        38, '15121', 'small', 750000000, 'Tas kulit',              'fashion',              'male',   'Dadang Hermawan'),
  (5,  'Dodol Garut Manis',           38, '10792', 'micro', 240000000, 'Dodol',                  'makanan',              'female', 'Euis Kurniasih'),
  (6,  'Anyaman Rajapolah',           41, '16299', 'small', 390000000, 'Anyaman mendong',        'kerajinan',            'female', 'Nani Suryani'),
  (7,  'Bordir Kawalu Indah',         41, '13921', 'micro', 210000000, 'Mukena bordir',          'fashion',              'female', 'Yeti Rahmawati'),
  (8,  'Nanas Subang Segar',          45, '10750', 'micro', 160000000, 'Selai nanas',            'makanan',              'male',   'Ujang Supriatna'),
  (9,  'Konveksi Pagaden Mandiri',    45, '14111', 'small', 540000000, 'Seragam sekolah',        'fashion',              'male',   'Wahyu Hidayat'),
  (10, 'Bakery Sehat Bekasi',         54, '10710', 'micro', 300000000, 'Roti gandum',            'makanan',              'female', 'Rina Marlina'),
  (11, 'Sambal Bu Iis',               54, '10750', 'micro', 150000000, 'Sambal kemasan',         'makanan',              'female', 'Iis Suryati'),
  (12, 'Mebel Jati Leuwiliang',       55, '31001', 'small', 820000000, 'Mebel jati',             'kerajinan',            'male',   'Ahmad Fauzi'),
  (13, 'Bolu Talas Bogor',            55, '10792', 'micro', 200000000, 'Bolu talas',             'makanan',              'female', 'Neneng Hasanah'),
  (14, 'Sepatu Cibaduyut Prima',      58, '15121', 'small', 900000000, 'Sepatu kulit',           'fashion',              'male',   'Budi Santoso'),
  (15, 'Kaos Distro Braga',           58, '14111', 'micro', 350000000, 'Kaos sablon',            'fashion',              'male',   'Rizky Pratama'),
  (16, 'Kosmetik Herbal Geulis',      58, '47724', 'micro', 260000000, 'Sabun herbal',           'kesehatan_kecantikan', 'female', 'Ayu Wulandari'),
  (17, 'Nasi Liwet Teh Ocoh',         58, '56101', 'micro', 190000000, 'Nasi liwet',             'makanan',              'female', 'Ocoh Rohaeti'),
  (18, 'Susu Pangalengan Murni',      43, '10750', 'small', 700000000, 'Yoghurt',                'minuman',              'male',   'Iwan Setiawan'),
  (19, 'Rotan Tegalwangi',            42, '31001', 'small', 650000000, 'Kursi rotan',            'kerajinan',            'male',   'Karsim'),
  (20, 'Empal Gentong Cirebon',       42, '56101', 'micro', 230000000, 'Empal gentong kemasan',  'makanan',              'female', 'Rukmini'),
  (21, 'Payung Geulis Tasik',         41, '32909', 'micro', 140000000, 'Payung hias',            'kerajinan',            'female', 'Enok Sumiati'),
  (22, 'Jeruk Garut Organik',         38, '10750', 'micro', 170000000, 'Sirup jeruk',            'minuman',              'male',   'Cecep Gunawan'),
  (23, 'Rengginang Subang',           45, '10794', 'micro', 120000000, 'Rengginang',             'makanan',              'female', 'Titin Kartini'),
  (24, 'Kerajinan Bambu Bogor',       55, '16299', 'micro', 180000000, 'Anyaman bambu',          'kerajinan',            'male',   'Jajang Nurjaman'),
  (25, 'Batik Nusantara Online',      54, '47911', 'small', 560000000, 'Batik cap',              'fashion',              'female', 'Fitri Handayani'),
  (26, 'Kue Balok Bandung',           58, '10792', 'micro', 130000000, 'Kue balok',              'makanan',              'male',   'Yayan Sopian'),
  (27, 'Jaket Kulit Sukaregang',      38, '14111', 'small', 610000000, 'Jaket kulit',            'fashion',              'male',   'Hendra Kusnadi'),
  (28, 'Madu Hutan Leuwiliang',       55, '10750', 'micro', 110000000, 'Madu hutan',             'agribisnis',           'male',   'Endang Suhendar'),
  (29, 'Kerupuk Kulit Bekasi',        54, '10794', 'micro', 145000000, 'Kerupuk kulit',          'makanan',              'female', 'Imas Masitoh'),
  (30, 'Opak Ketan Subang',           45, '10792', 'micro', 115000000, 'Opak ketan',             'makanan',              'female', 'Onih Suhaenah');

-- Kelurahan asli (yang punya titik koordinat) di kab/kota tersebut; alamat id dipesan dari sequence.
UPDATE dm_usaha d SET alamat = nextval('alamat_id_seq'), kelurahan = (
  SELECT l.id FROM kelurahan l JOIN kecamatan k ON k.id = l.kecamatan
   WHERE k.kota = d.kota AND l.coordinate IS NOT NULL
   ORDER BY l.id OFFSET (d.n * 7) % 40 LIMIT 1);
UPDATE dm_usaha d SET lat = ROUND((ST_Y(l.coordinate) + (d.n % 7 - 3) * 0.0007)::numeric, 7),
                      lng = ROUND((ST_X(l.coordinate) + (d.n % 5 - 2) * 0.0007)::numeric, 7)
  FROM kelurahan l WHERE l.id = d.kelurahan;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM dm_usaha WHERE kelurahan IS NULL) THEN RAISE EXCEPTION 'Kelurahan untuk usaha dummy tidak ditemukan'; END IF;
  IF EXISTS (SELECT 1 FROM usaha WHERE nib IN (SELECT '99990' || lpad(n::text, 8, '0') FROM dm_usaha)) THEN
    RAISE EXCEPTION 'NIB dummy 99990… bentrok dengan data yang ada';
  END IF;
END $$;

INSERT INTO alamat (id, kelurahan, alamat_jalan, rt, rw)
SELECT alamat, kelurahan, 'dummy_Jl. ' || produk || ' No. ' || n, lpad((n % 9 + 1)::text, 3, '0'), lpad((n % 5 + 1)::text, 3, '0')
  FROM dm_usaha;

INSERT INTO pelaku_usaha (id, nik, nama_lengkap, jenis_kelamin, tingkat_pendidikan, telepon, alamat)
SELECT pelaku, 'dummy_pu_' || lpad(n::text, 3, '0'), 'dummy_' || pemilik, jk,
       (ARRAY['senior_high', 'diploma', 'bachelor', 'junior_high'])[n % 4 + 1], '0800000' || lpad(n::text, 5, '0'), alamat
  FROM dm_usaha;

INSERT INTO usaha (id, sumber_id, pelaku_usaha, nib, nama, kegiatan_utama, produk_utama, klasifikasi, status_hukum, skala,
                   modal_pendirian, bulan_mulai_operasi, tahun_mulai_operasi, omzet_tahunan, total_aset, alamat, latitude, longitude,
                   talent_status, talent_batch, pdn_terverifikasi, ramah_disabilitas, nomor_whatsapp)
SELECT d.usaha, 'dummy_prog_' || lpad(d.n::text, 3, '0'), d.pelaku, '99990' || lpad(d.n::text, 8, '0'), 'dummy_' || d.nama,
       'Produksi ' || lower(d.produk), d.produk, (SELECT k.id FROM klasifikasi_usaha k WHERE k.kode = d.kbli ORDER BY k.id LIMIT 1),
       CASE WHEN d.skala = 'small' THEN 'cv' ELSE 'sole_proprietorship' END, d.skala,
       d.omzet / 4, d.n % 12 + 1, 2012 + d.n % 12, d.omzet, d.omzet * 3 / 5, d.alamat, d.lat, d.lng,
       CASE WHEN d.n <= 4 THEN 'talent_pool' WHEN d.n <= 6 THEN 'accelerator' WHEN d.n <= 12 THEN 'scouting'
            WHEN d.n <= 15 THEN 'nominated' ELSE 'none' END,
       CASE WHEN d.n <= 6 THEN 'dummy_batch_2026_A' END,
       d.n IN (1, 4), d.n % 10 = 7, '0800000' || lpad(d.n::text, 5, '0')
  FROM dm_usaha d;

-- Atribut Jabar (lima aspek perkembangan): campuran ya/tidak/belum ada data.
INSERT INTO usaha_atribut_jabar (usaha, npwp_usaha, izin_edar, sertifikat_halal, pirt_bpom, hki_merek, sni, rekening_terpisah,
                                 sop_tertulis, ecommerce, medsos_bisnis, qris, pembukuan_digital, akses_kur,
                                 rantai_pasok_industri, kontrak_offtaker, diperbarui_oleh)
SELECT usaha, n % 3 <> 0, CASE WHEN n % 5 = 0 THEN NULL ELSE n % 4 = 0 END, n % 2 = 1, n % 3 = 1, n % 6 = 0, n % 9 = 0,
       n % 4 <> 3, CASE WHEN n % 7 = 0 THEN NULL ELSE n % 3 = 2 END, n % 2 = 0, n % 5 <> 4, n % 3 <> 2, n % 4 = 1,
       CASE WHEN n % 6 = 5 THEN NULL ELSE n % 4 = 2 END, n % 8 = 0, n % 10 = 3, (SELECT admin FROM dm_akun)
  FROM dm_usaha;

-- Legalitas tercatat dinas (bahan badge passport dan detail katalog).
INSERT INTO usaha_legalitas (usaha, jenis, nomor, status, berlaku_hingga)
SELECT d.usaha, v.jenis, 'dummy_' || upper(v.jenis) || '-' || lpad(d.n::text, 4, '0'), v.status,
       (SELECT hari_ini FROM dm_hari) + 700
  FROM dm_usaha d
  JOIN (VALUES (1, 'halal', 'terbit'), (2, 'halal', 'terbit'), (3, 'pirt', 'terbit'), (4, 'hki', 'dalam_proses'),
               (5, 'halal', 'terbit'), (5, 'pirt', 'terbit'), (6, 'pirt', 'terbit'), (10, 'pirt', 'terbit'),
               (13, 'halal', 'dalam_proses'), (16, 'bpom', 'terbit')) AS v(n, jenis, status) ON v.n = d.n;

-- ── Menu: Kurasi Talent Scouting ─────────────────────────────────────────────
INSERT INTO talent_berita_acara (id, nomor, tanggal, disetujui_oleh, catatan, date_created)
SELECT gen_random_uuid(), v.nomor, (SELECT hari_ini FROM dm_hari) - v.umur, (SELECT admin FROM dm_akun), v.catatan,
       now() - make_interval(days => v.umur)
  FROM (VALUES ('dummy_BA-TS/2026/0001', 40, 'dummy_Rapat kurasi batch A tahap 1'),
               ('dummy_BA-TS/2026/0002', 20, 'dummy_Rapat kurasi batch A tahap 2')) AS v(nomor, umur, catatan);

-- 1–6 disetujui (BA 0001: 1–3, BA 0002: 4–6), 7–12 dinilai, 13–15 draft, 16–18 ditolak.
INSERT INTO talent_pengajuan (usaha, diajukan_oleh, kapasitas_produksi, satuan, kesiapan_legalitas, literasi_qris,
                              literasi_pembukuan_digital, skor_finansial, skor_pasar, skor_legalitas, skor_sdm, skor_total,
                              rubrik_versi, dinilai_at, status, catatan, berita_acara, date_created, date_updated,
                              alasan_tolak, ditolak_at)
SELECT d.usaha, (SELECT admin FROM dm_akun), 200 + d.n * 35, (ARRAY['pcs', 'kg', 'lusin'])[d.n % 3 + 1],
       jsonb_build_object('halal', (ARRAY['terbit', 'dalam_proses', 'belum'])[d.n % 3 + 1], 'pirt', (ARRAY['belum', 'terbit'])[d.n % 2 + 1]),
       d.n % 3 <> 0, d.n % 2 = 0,
       s.f, s.p, s.l, s.s, CASE WHEN d.n <= 15 AND d.n > 12 THEN NULL ELSE ROUND((s.f + s.p + s.l + s.s) / 4, 2) END,
       CASE WHEN d.n BETWEEN 13 AND 15 THEN NULL ELSE 'placeholder-v0' END,
       CASE WHEN d.n BETWEEN 13 AND 15 THEN NULL ELSE now() - make_interval(days => 45 - d.n) END,
       CASE WHEN d.n <= 6 THEN 'disetujui' WHEN d.n <= 12 THEN 'dinilai' WHEN d.n <= 15 THEN 'draft' ELSE 'ditolak' END,
       NULL,
       CASE WHEN d.n <= 3 THEN (SELECT id FROM talent_berita_acara WHERE nomor = 'dummy_BA-TS/2026/0001')
            WHEN d.n <= 6 THEN (SELECT id FROM talent_berita_acara WHERE nomor = 'dummy_BA-TS/2026/0002') END,
       now() - make_interval(days => 60 - d.n), now() - make_interval(days => 30 - d.n),
       CASE WHEN d.n > 15 THEN 'dummy_Kapasitas produksi belum stabil; ajukan kembali batch berikutnya' END,
       CASE WHEN d.n > 15 THEN now() - make_interval(days => 30 - d.n) END
  FROM dm_usaha d
  CROSS JOIN LATERAL (
    SELECT CASE WHEN d.n BETWEEN 13 AND 15 THEN NULL ELSE LEAST(100, 55 + (d.n * 13) % 30 + CASE WHEN d.n <= 6 THEN 15 WHEN d.n > 15 THEN -20 ELSE 0 END) END::numeric AS f,
           CASE WHEN d.n BETWEEN 13 AND 15 THEN NULL ELSE LEAST(100, 50 + (d.n * 7) % 40 + CASE WHEN d.n <= 6 THEN 20 WHEN d.n > 15 THEN -15 ELSE 0 END) END::numeric AS p,
           CASE WHEN d.n BETWEEN 13 AND 15 THEN NULL ELSE LEAST(100, 40 + (d.n * 11) % 40 + CASE WHEN d.n <= 6 THEN 20 WHEN d.n > 15 THEN -10 ELSE 0 END) END::numeric AS l,
           CASE WHEN d.n BETWEEN 13 AND 15 THEN NULL ELSE LEAST(100, 50 + (d.n * 5) % 35 + CASE WHEN d.n <= 6 THEN 15 WHEN d.n > 15 THEN -20 ELSE 0 END) END::numeric AS s
  ) s
 WHERE d.n <= 18;

-- ── Menu: Program Akselerasi + Monitoring Eksekutif ──────────────────────────
-- 12 peserta mulai 45 hari lalu: 6 minggu penuh berlalu, minggu ke-7 berjalan.
INSERT INTO program_peserta (usaha, batch, fase, pendamping, tanggal_mulai, jumlah_minggu, target_mingguan, rekomendasi_pitching, status)
SELECT usaha, 'dummy_batch_2026_A', 'akselerasi', (SELECT coach FROM dm_akun), (SELECT hari_ini FROM dm_hari) - 45, 12,
       ROUND(omzet / 52 * 1.15, -3), n IN (1, 4), 'aktif'
  FROM dm_usaha WHERE n <= 12;

-- Laporan minggu 1–6 umumnya disetujui; pengecualian: ditolak (n3 m4, n7 m2), menunggu review
-- (m6 untuk n2, n5, n9), tidak melapor (n10 m5–6). n11 dan n12 dua minggu terakhir ≤ 70% baseline
-- (masuk daftar berisiko di Monitoring). Minggu berjalan (7): n1, n4, n6, n8 sudah mengirim.
INSERT INTO kpi_laporan (peserta, minggu_ke, target, realisasi_omzet, jumlah_transaksi, kendala, client_uuid, status,
                         catatan_pendamping, direview_oleh, direview_at, dikirim_oleh, date_created, date_updated)
SELECT p.id, w.m, p.target_mingguan, v.realisasi, 8 + (d.n * w.m) % 25,
       CASE WHEN v.risiko THEN 'dummy_Bahan baku langka dan permintaan turun' END,
       gen_random_uuid(), v.status,
       CASE v.status WHEN 'ditolak' THEN 'dummy_Foto bukti transaksi tidak terbaca, mohon unggah ulang'
                     WHEN 'disetujui' THEN CASE WHEN v.risiko THEN 'dummy_Perlu kunjungan pendampingan' END END,
       CASE WHEN v.status <> 'menunggu' THEN (SELECT coach FROM dm_akun) END,
       CASE WHEN v.status <> 'menunggu' THEN v.dikirim + interval '1 day' END,
       NULL, v.dikirim, COALESCE(CASE WHEN v.status <> 'menunggu' THEN v.dikirim + interval '1 day' END, v.dikirim)
  FROM program_peserta p
  JOIN dm_usaha d ON d.usaha = p.usaha
  CROSS JOIN LATERAL generate_series(1, 7) AS w(m)
  CROSS JOIN LATERAL (
    SELECT (d.n IN (11, 12) AND w.m >= 5) AS risiko,
           ROUND(CASE WHEN d.n IN (11, 12) AND w.m >= 5 THEN d.omzet / 52 * 0.55
                      ELSE d.omzet / 52 * (1.0 + 0.05 * w.m + ((d.n * w.m) % 5) * 0.04) END, -3)::bigint AS realisasi,
           CASE WHEN (d.n, w.m) IN ((3, 4), (7, 2)) THEN 'ditolak'
                WHEN w.m = 7 OR (w.m = 6 AND d.n IN (2, 5, 9)) THEN 'menunggu'
                ELSE 'disetujui' END AS status,
           CASE WHEN w.m = 7 THEN now() - make_interval(hours => d.n)
                ELSE (p.tanggal_mulai + w.m * 7 - 1)::timestamp + time '10:00' + make_interval(mins => d.n * 7) END AS dikirim
  ) v
 WHERE p.batch = 'dummy_batch_2026_A'
   AND NOT (d.n = 10 AND w.m IN (5, 6))
   AND (w.m < 7 OR d.n IN (1, 4, 6, 8));

-- ── Menu: Kurasi Investor ────────────────────────────────────────────────────
-- 1–2 disetujui, 3–5 menunggu kurasi, 6–7 belum disetujui usaha, 8 persetujuan dicabut.
INSERT INTO investor_profil (usaha, jenama, kebutuhan_modal, skema, kapasitas_pasok, margin_persen, margin_sumber,
                             disetujui_berbagi_oleh, disetujui_berbagi_pada, disetujui_kurator_oleh, disetujui_kurator_pada,
                             dicabut_pada, date_updated)
SELECT d.usaha, 'dummy_' || d.nama, (50 + d.n * 25) * 1000000,
       CASE d.n % 4 WHEN 0 THEN ARRAY['kur', 'offtaker'] WHEN 1 THEN ARRAY['lpdb'] WHEN 2 THEN ARRAY['penyertaan_modal', 'ekspor']
                    ELSE ARRAY['konsinyasi', 'kur'] END,
       (500 + d.n * 150) || ' unit/bulan', 18 + d.n * 2.5, CASE WHEN d.n <= 2 THEN 'terverifikasi' ELSE 'deklarasi' END,
       CASE WHEN d.n NOT IN (6, 7) THEN (SELECT umkm FROM dm_akun) END,
       CASE WHEN d.n NOT IN (6, 7) THEN now() - make_interval(days => 20 - d.n) END,
       CASE WHEN d.n <= 2 THEN (SELECT admin FROM dm_akun) END,
       CASE WHEN d.n <= 2 THEN now() - make_interval(days => 10 - d.n) END,
       CASE WHEN d.n = 8 THEN now() - interval '3 days' END,
       now() - make_interval(hours => d.n * 5)
  FROM dm_usaha d WHERE d.n <= 8;

-- ── Menu: Kurasi Katalog + Produk Katalog (UMKM) ─────────────────────────────
-- Dua produk per usaha 1–12: 8 tayang, 4 rekomendasi marketplace, 8 menunggu, 4 ditolak.
-- Kolom usaha_* diisi trigger produk_usaha_snapshot dari usaha/alamat.
INSERT INTO produk (usaha, nama, deskripsi, kategori, kbli, harga_retail, harga_grosir, moq, dimensi, berat, shelf_life,
                    bahan_baku, tkdn_persen, kapasitas_bulanan, lead_time, persen_bahan_lokal, pdn_deklarasi,
                    status_kurasi, catatan_kurasi, dikurasi_oleh, dikurasi_at, date_created, date_updated)
SELECT d.usaha, 'dummy_' || d.produk || CASE v.k WHEN 1 THEN ' Kemasan Eceran' ELSE ' Paket Grosir' END,
       'Produk dummy untuk uji tampilan katalog: ' || lower(d.produk) || ' buatan ' || d.nama || '.',
       d.kategori, d.kbli, (25 + d.n * 7) * 1000 * v.k, (20 + d.n * 6) * 1000 * v.k, 10 * v.k,
       '20 x 15 x 8 cm', (250 * v.k) || ' g', CASE WHEN d.kategori IN ('makanan', 'minuman') THEN '6 bulan' END,
       'Bahan baku lokal Jawa Barat', 60 + d.n, (300 * v.k) || ' pcs/bulan', (3 + v.k) || ' hari kerja', 70 + d.n, d.n % 3 <> 0,
       s.status,
       CASE WHEN s.status = 'ditolak' THEN 'dummy_Foto produk belum sesuai standar katalog; lengkapi label dan izin edar' END,
       CASE WHEN s.status <> 'menunggu' THEN (SELECT admin FROM dm_akun) END,
       CASE WHEN s.status <> 'menunggu' THEN now() - make_interval(days => 25 - s.idx) END,
       now() - make_interval(days => 40 - s.idx), now() - make_interval(days => 25 - s.idx)
  FROM dm_usaha d
  CROSS JOIN (VALUES (1), (2)) AS v(k)
  CROSS JOIN LATERAL (
    SELECT (d.n - 1) * 2 + v.k AS idx,
           CASE WHEN (d.n - 1) * 2 + v.k <= 8 THEN 'tayang' WHEN (d.n - 1) * 2 + v.k <= 12 THEN 'rekomendasi_marketplace'
                WHEN (d.n - 1) * 2 + v.k <= 20 THEN 'menunggu' ELSE 'ditolak' END AS status
  ) s
 WHERE d.n <= 12;

-- Minat pembeli (LoI) pada produk tayang.
INSERT INTO produk_loi (produk, nama, instansi, email, telepon, jumlah, pesan, status, persetujuan_kontak, date_created)
SELECT p.id, 'dummy_Pembeli ' || x.i, 'dummy_PT Mitra Ritel ' || x.i, 'dummy_buyer' || x.i || '@example.com',
       '0800001' || lpad(x.i::text, 5, '0'), (100 * x.i) || ' pcs/bulan',
       'dummy_Kami tertarik menjadi pemasok tetap untuk jaringan toko kami.', (ARRAY['baru', 'ditindaklanjuti', 'ditutup'])[x.i % 3 + 1],
       TRUE, now() - make_interval(days => x.i * 2)
  FROM (SELECT id, row_number() OVER (ORDER BY date_created) AS i FROM produk
         WHERE status_kurasi = 'tayang' AND usaha IN (SELECT usaha FROM dm_usaha)) p
  CROSS JOIN LATERAL (SELECT p.i::int AS i) x
 WHERE p.i <= 6;

-- ── Menu: Talent Passport ────────────────────────────────────────────────────
-- Passport aktif untuk usaha 1–5 (usaha 6 memenuhi syarat tapi belum diterbitkan → tombol terbit).
-- payload_hash/signature diisi 'unsigned' lalu ditandatangani scripts/sign-dummy-program.mjs.
INSERT INTO talent_passport (usaha, kode, payload, payload_hash, signature, kid, skor_finansial, skor_pasar, skor_legalitas,
                             skor_sdm, skor_kinerja, status_badge, status, diterbitkan_oleh, diterbitkan_at)
SELECT d.usaha, x.kode,
       jsonb_build_object(
         'versi', 1, 'kode', x.kode,
         'usaha', jsonb_build_object('nama', 'dummy_' || d.nama, 'skala', d.skala, 'kota', k.nama, 'kbli', d.kbli),
         'statusBadge', x.badge,
         'skor', jsonb_build_object('finansial', tp.skor_finansial, 'pasar', tp.skor_pasar, 'legalitas', tp.skor_legalitas,
                                    'sdm', tp.skor_sdm, 'kinerja', x.kinerja),
         'rubrikVersi', 'placeholder-v0',
         'sumberSkor', jsonb_build_array(
           jsonb_build_object('dimensi', 'finansial', 'sumber', 'Talent Scouting (rubrik placeholder-v0)'),
           jsonb_build_object('dimensi', 'pasar', 'sumber', 'Talent Scouting (rubrik placeholder-v0)'),
           jsonb_build_object('dimensi', 'legalitas', 'sumber', 'Talent Scouting (rubrik placeholder-v0)'),
           jsonb_build_object('dimensi', 'sdm', 'sumber', 'Talent Scouting (rubrik placeholder-v0)'),
           jsonb_build_object('dimensi', 'kinerja', 'sumber', 'KPI mingguan disetujui: ' || x.memenuhi || '/7 minggu memenuhi target.')),
         'badges', (
           SELECT COALESCE(jsonb_agg(b.badge ORDER BY b.urut), '[]'::jsonb) FROM (
             SELECT 1 AS urut, jsonb_build_object('key', 'pdn', 'label', '100% Produk Dalam Negeri (PDN)', 'terverifikasi', TRUE,
                                                  'sumber', 'Diverifikasi dinas (pdn_terverifikasi)') AS badge
              WHERE d.n IN (1, 4)
             UNION ALL
             SELECT 2, jsonb_build_object('key', 'naik_kelas', 'label', 'Siap Naik Kelas', 'terverifikasi', TRUE,
                                          'sumber', 'Skor Talent Index ' || x.indeks || ' ≥ 75 (rubrik placeholder-v0)')
              WHERE x.indeks >= 75
             UNION ALL
             SELECT 3, jsonb_build_object('key', 'legalitas_' || l.jenis,
                                          'label', CASE l.jenis WHEN 'halal' THEN 'Sertifikat Halal' WHEN 'pirt' THEN 'PIRT' ELSE upper(l.jenis) END || ' aktif',
                                          'terverifikasi', FALSE, 'sumber', 'Tercatat dinas tanpa berkas — belum terverifikasi penuh')
               FROM usaha_legalitas l WHERE l.usaha = d.usaha AND l.status = 'terbit'
           ) b),
         'sertifikasi', (SELECT COALESCE(jsonb_agg(DISTINCT l.jenis), '[]'::jsonb) FROM usaha_legalitas l WHERE l.usaha = d.usaha AND l.status = 'terbit'),
         'pdnTerverifikasi', d.n IN (1, 4),
         'diterbitkanAt', to_char(x.terbit AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
       'unsigned', 'unsigned', NULL, tp.skor_finansial, tp.skor_pasar, tp.skor_legalitas, tp.skor_sdm, x.kinerja, x.badge, 'aktif',
       (SELECT admin FROM dm_akun), x.terbit
  FROM dm_usaha d
  JOIN kota k ON k.id = d.kota
  JOIN talent_pengajuan tp ON tp.usaha = d.usaha AND tp.status = 'disetujui'
  CROSS JOIN LATERAL (
    SELECT 'TPDMY' || lpad(d.n::text, 7, '0') AS kode,
           CASE WHEN d.n <= 4 THEN 'Talent Pool Jawa Barat' ELSE 'Akselerator Jawa Barat' END AS badge,
           m.memenuhi, ROUND(m.memenuhi * 100.0 / 7, 2) AS kinerja,
           ROUND((tp.skor_finansial + tp.skor_pasar + tp.skor_legalitas + tp.skor_sdm) / 4, 2) AS indeks,
           date_trunc('second', now() - make_interval(days => 12 - d.n)) AS terbit
      FROM (SELECT COUNT(*)::int AS memenuhi FROM kpi_laporan l JOIN program_peserta pp ON pp.id = l.peserta
             WHERE pp.usaha = d.usaha AND l.status = 'disetujui' AND l.realisasi_omzet >= l.target AND l.minggu_ke <= 7) m
  ) x
 WHERE d.n <= 5;

-- ── Menu: Klinik Konsultasi ──────────────────────────────────────────────────
INSERT INTO klinik_konsultan (nama, poli, afiliasi, hari, slot, pendamping, aktif, sort)
SELECT 'dummy_' || v.nama, po.id, v.afiliasi, v.hari::jsonb, '["09:00", "10:30", "13:00", "14:30"]'::jsonb,
       CASE WHEN v.kode = 'legalitas' THEN (SELECT coach FROM dm_akun) END, TRUE, v.urut
  FROM (VALUES (1, 'legalitas', 'Rina Pendamping (Legalitas)', 'dinas', '["senin", "rabu", "jumat"]'),
               (2, 'keuangan', 'Hendra Wijaya, SE (Keuangan)', 'plut', '["selasa", "kamis"]'),
               (3, 'pemasaran', 'Maya Kartika (Digital Marketing)', 'praktisi', '["senin", "selasa", "rabu", "kamis", "jumat"]'),
               (4, 'advokasi', 'Andri Nugraha, SH (Mediasi PMSE)', 'dinas', '["rabu", "jumat"]'),
               (5, 'bantuan', 'Sri Mulyani R. (Akses Bantuan)', 'plut', '["senin", "kamis"]'),
               (6, 'inklusif', 'Dian Permana (UMKM Inklusif)', 'praktisi', '["selasa", "jumat"]')) AS v(urut, kode, nama, afiliasi, hari)
  JOIN konsultasi_poli po ON po.kode = v.kode;

-- 20 tiket: k1–4 masuk, 5–8 dijadwalkan, 9–11 berjalan, 12–14 tindak lanjut, 15–19 selesai, 20 batal.
CREATE TEMP TABLE dm_tiket ON COMMIT DROP AS
SELECT k, gen_random_uuid() AS id,
       CASE WHEN k <= 18 THEN 12 + k ELSE k - 18 END AS n,
       (ARRAY['legalitas', 'keuangan', 'pemasaran', 'advokasi', 'bantuan', 'inklusif'])[(k - 1) % 6 + 1] AS poli_kode,
       CASE WHEN k <= 4 THEN 'masuk' WHEN k <= 8 THEN 'dijadwalkan' WHEN k <= 11 THEN 'berjalan'
            WHEN k <= 14 THEN 'tindak_lanjut' WHEN k <= 19 THEN 'selesai' ELSE 'batal' END AS status,
       -- Tiket yang belum selesai dijadwalkan ke depan, sisanya sudah lewat.
       CASE WHEN k <= 11 THEN 1 ELSE -1 END * (k % 9 + 2) AS geser
  FROM generate_series(1, 20) AS k;
CREATE TEMP TABLE dm_urut_status ON COMMIT DROP AS
SELECT * FROM (VALUES (0, 'masuk'), (1, 'dijadwalkan'), (2, 'berjalan'), (3, 'tindak_lanjut'), (4, 'selesai')) AS v(urut, status);

INSERT INTO konsultasi_tiket (id, nomor, usaha, nama_usaha, nama_kontak, whatsapp, email, poli, deskripsi, moda, jadwal_tanggal,
                              jadwal_slot, prioritas, status, pendamping, link_meet, diagnosis, action_plan, rujukan, catatan,
                              date_created, date_updated, sumber_identitas, wa_consent)
SELECT t.id, 'dummy_KLN-2026-' || lpad(t.k::text, 4, '0'), d.usaha, 'dummy_' || d.nama, 'dummy_' || d.pemilik,
       '0800000' || lpad(d.n::text, 5, '0'), 'dummy_klinik' || t.k || '@example.com', po.id,
       CASE t.poli_kode
         WHEN 'legalitas' THEN 'dummy_Ingin mengurus sertifikat halal dan PIRT untuk produk baru.'
         WHEN 'keuangan' THEN 'dummy_Butuh bantuan memisahkan rekening usaha dan menyusun laporan keuangan sederhana.'
         WHEN 'pemasaran' THEN 'dummy_Penjualan marketplace menurun, ingin konsultasi strategi promosi dan QRIS.'
         WHEN 'advokasi' THEN 'dummy_Akun toko online dibekukan sepihak oleh platform, butuh mediasi.'
         WHEN 'bantuan' THEN 'dummy_Ingin tahu kelayakan proposal bantuan alat produksi.'
         ELSE 'dummy_Pendampingan akses pasar untuk pelaku usaha disabilitas.' END,
       CASE WHEN t.k % 2 = 0 THEN 'daring' ELSE 'luring' END,
       j.tanggal, (ARRAY['09:00', '10:30', '13:00', '14:30'])[t.k % 4 + 1],
       CASE WHEN t.k = 4 THEN 'mendesak' WHEN t.k IN (3, 10, 13) THEN 'tinggi' ELSE 'normal' END,
       t.status,
       CASE WHEN t.status NOT IN ('masuk', 'batal') THEN (SELECT coach FROM dm_akun) END,
       CASE WHEN t.k % 2 = 0 AND t.status NOT IN ('masuk', 'batal') THEN 'https://meet.example.com/dummy-klinik-' || t.k END,
       CASE WHEN t.status IN ('berjalan', 'tindak_lanjut', 'selesai')
            THEN jsonb_build_object(t.poli_kode_diag, 'dummy_Hasil diagnosis awal: dokumen pendukung belum lengkap.') ELSE '{}'::jsonb END,
       CASE WHEN t.status IN ('tindak_lanjut', 'selesai') THEN 'dummy_1) Lengkapi dokumen 2) Ajukan melalui OSS 3) Evaluasi 2 minggu' END,
       CASE WHEN t.status IN ('tindak_lanjut', 'selesai') THEN (ARRAY['["sarpras"]', '["talent_lab"]', '["mediasi_sapa"]', '[]'])[t.k % 4 + 1]::jsonb
            ELSE '[]'::jsonb END,
       CASE WHEN t.status = 'batal' THEN 'dummy_Dibatalkan pemohon' END,
       j.dibuat, LEAST(j.dibuat + interval '2 days', now()), 'sidt', t.k % 3 = 0
  FROM (SELECT *, CASE WHEN poli_kode IN ('legalitas', 'keuangan', 'pemasaran') THEN poli_kode ELSE 'sdm' END AS poli_kode_diag FROM dm_tiket) t
  JOIN dm_usaha d ON d.n = t.n
  JOIN konsultasi_poli po ON po.kode = t.poli_kode
  CROSS JOIN LATERAL (
    SELECT tgl + CASE EXTRACT(ISODOW FROM tgl) WHEN 6 THEN 2 WHEN 7 THEN 1 ELSE 0 END AS tanggal,
           LEAST((tgl::timestamp + time '08:00')::timestamptz - interval '6 days', now() - make_interval(hours => t.k * 3)) AS dibuat
      FROM (SELECT (SELECT hari_ini FROM dm_hari) + t.geser AS tgl) g
  ) j;

-- Riwayat transisi (dasar statistik waktu respons publik): satu baris per langkah kanban.
INSERT INTO konsultasi_tiket_audit (tiket, aktor, aktor_nama, aksi, status_dari, status_ke, perubahan, date_created)
SELECT t.id, (SELECT coach FROM dm_akun), 'dummy_Rina Pendamping Wilayah', 'transisi', dari.status, ke.status,
       jsonb_build_array(jsonb_build_object('field', 'status', 'dari', dari.status, 'ke', ke.status)),
       kt.date_created + make_interval(hours => ke.urut * (4 + t.k % 9))
  FROM dm_tiket t
  JOIN konsultasi_tiket kt ON kt.id = t.id
  JOIN dm_urut_status akhir ON akhir.status = t.status
  JOIN dm_urut_status ke ON ke.urut BETWEEN 1 AND akhir.urut
  JOIN dm_urut_status dari ON dari.urut = ke.urut - 1
UNION ALL
SELECT t.id, (SELECT coach FROM dm_akun), 'dummy_Rina Pendamping Wilayah', 'transisi', 'masuk', 'batal',
       jsonb_build_array(jsonb_build_object('field', 'status', 'dari', 'masuk', 'ke', 'batal')), kt.date_created + interval '5 hours'
  FROM dm_tiket t JOIN konsultasi_tiket kt ON kt.id = t.id WHERE t.status = 'batal';

-- CSAT pemohon untuk tiket selesai (k19 tanpa persetujuan publikasi → tidak dihitung).
INSERT INTO konsultasi_tiket_csat (tiket, nilai, consent, date_created)
SELECT t.id, v.nilai, v.consent, kt.date_updated + interval '1 day'
  FROM dm_tiket t JOIN konsultasi_tiket kt ON kt.id = t.id
  JOIN (VALUES (15, 5, TRUE), (16, 4, TRUE), (17, 5, TRUE), (18, 4, TRUE), (19, 3, FALSE)) AS v(k, nilai, consent) ON v.k = t.k;

-- Outcome terverifikasi (k15, k16) dan satu menunggu verifikasi (k17).
CREATE TEMP TABLE dm_outcome ON COMMIT DROP AS
SELECT gen_random_uuid() AS id, t.id AS tiket, d.usaha, v.status, v.atribut, kt.date_updated AS selesai
  FROM dm_tiket t JOIN dm_usaha d ON d.n = t.n JOIN konsultasi_tiket kt ON kt.id = t.id
  JOIN (VALUES (15, 'terverifikasi', ARRAY['npwp_usaha:kepatuhan', 'pembukuan_digital:perbaikan']),
               (16, 'terverifikasi', ARRAY['ecommerce:perbaikan', 'medsos_bisnis:perbaikan']),
               (17, 'diajukan', ARRAY['izin_edar:kepatuhan'])) AS v(k, status, atribut) ON v.k = t.k;
INSERT INTO konsultasi_outcome (id, tiket, usaha, versi, status, diajukan_oleh, diajukan_nama, diajukan_pada,
                                diverifikasi_oleh, diverifikasi_nama, diverifikasi_pada)
SELECT o.id, o.tiket, o.usaha, 1, o.status, (SELECT coach FROM dm_akun), 'dummy_Rina Pendamping Wilayah', o.selesai + interval '3 hours',
       CASE WHEN o.status = 'terverifikasi' THEN (SELECT admin FROM dm_akun) END,
       CASE WHEN o.status = 'terverifikasi' THEN 'dummy_Admin DISKUK Provinsi' END,
       CASE WHEN o.status = 'terverifikasi' THEN o.selesai + interval '1 day' END
  FROM dm_outcome o;
INSERT INTO konsultasi_outcome_item (outcome, atribut, jenis)
SELECT o.id, split_part(a, ':', 1), split_part(a, ':', 2) FROM dm_outcome o CROSS JOIN LATERAL unnest(o.atribut) AS a;
INSERT INTO konsultasi_outcome_audit (outcome, aktor, aktor_nama, aksi, status_dari, status_ke, versi, date_created)
SELECT o.id, (SELECT coach FROM dm_akun), 'dummy_Rina Pendamping Wilayah', 'ajukan', NULL, 'diajukan', 1, o.selesai + interval '3 hours'
  FROM dm_outcome o
UNION ALL
SELECT o.id, (SELECT admin FROM dm_akun), 'dummy_Admin DISKUK Provinsi', 'verifikasi', 'diajukan', 'terverifikasi', 1, o.selesai + interval '1 day'
  FROM dm_outcome o WHERE o.status = 'terverifikasi';

-- ── Menu: Kegiatan & Pendaftar ───────────────────────────────────────────────
-- K1 sudah selesai (presensi + sertifikat), K2 sedang berjalan, K3–K4 akan datang.
CREATE TEMP TABLE dm_kegiatan ON COMMIT DROP AS
SELECT gen_random_uuid() AS id, v.*
  FROM (VALUES
    (1, 'Pelatihan Manajemen Keuangan UMKM Naik Kelas', 'pelatihan', 'luring', 'KOTA BANDUNG', -24, -23, 2, TRUE, 30),
    (2, 'Bootcamp Akselerasi Ekspor Produk Kriya', 'akselerasi', 'hybrid', 'KAB. GARUT', -1, 2, 4, FALSE, 25),
    (3, 'Klinik Sertifikasi Halal Gratis', 'sertifikasi', 'luring', 'KAB. CIREBON', 14, 14, 1, FALSE, 40),
    (4, 'Literasi Digital: Jualan di Marketplace', 'literasi_digital', 'daring', NULL, 30, 31, 2, TRUE, 100)
  ) AS v(no, judul, kategori, metode, kota_nama, mulai, selesai, sesi, tugas, kuota);

INSERT INTO kegiatan (id, judul, ringkasan, kategori, penyelenggara, kota_nama, metode, ramah_disabilitas, tanggal_mulai,
                      tanggal_selesai, batas_registrasi, lokasi, link, kuota, terisi, silabus, narasumber, fasilitas, syarat,
                      status_publikasi, syarat_skala, syarat_wilayah, syarat_nib, pendaftaran_internal, butuh_pakta_integritas,
                      jumlah_sesi, butuh_tugas, date_created)
SELECT g.id, 'dummy_' || g.judul, 'Kegiatan dummy untuk uji menu Kegiatan & Pendaftar.', g.kategori,
       'Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat', g.kota_nama, g.metode, g.no IN (1, 4),
       ((SELECT hari_ini FROM dm_hari) + g.mulai)::timestamp + time '08:00',
       ((SELECT hari_ini FROM dm_hari) + g.selesai)::timestamp + time '16:00',
       ((SELECT hari_ini FROM dm_hari) + g.mulai - 3)::timestamp + time '23:59',
       CASE WHEN g.metode <> 'daring' THEN 'dummy_Gedung Pelatihan UMKM, ' || COALESCE(g.kota_nama, 'Jawa Barat') END,
       CASE WHEN g.metode <> 'luring' THEN 'https://meet.example.com/dummy-kegiatan-' || g.no END,
       g.kuota, 0, 'Sesi 1: materi inti; sesi berikutnya: praktik dan studi kasus.', 'dummy_Narasumber praktisi UMKM',
       'Modul, sertifikat, konsumsi', 'Pelaku UMKM Jawa Barat dengan NIB aktif', 'terbit',
       'Mikro dan kecil', NULL, g.no <> 4, TRUE, g.no = 2, g.sesi, g.tugas, now() - interval '40 days'
  FROM dm_kegiatan g;

-- Pendaftar: K1 8 orang (usaha 1–8), K2 7 (9–15), K3 6 (16–21), K4 5 (22–26).
CREATE TEMP TABLE dm_daftar ON COMMIT DROP AS
SELECT gen_random_uuid() AS id, g.no AS kegiatan_no, g.id AS kegiatan, g.sesi, g.tugas, d.n, d.usaha,
       row_number() OVER (PARTITION BY g.no ORDER BY d.n) AS urut
  FROM dm_kegiatan g
  JOIN dm_usaha d ON (g.no = 1 AND d.n BETWEEN 1 AND 8) OR (g.no = 2 AND d.n BETWEEN 9 AND 15)
                  OR (g.no = 3 AND d.n BETWEEN 16 AND 21) OR (g.no = 4 AND d.n BETWEEN 22 AND 26);
ALTER TABLE dm_daftar ADD COLUMN status TEXT;
UPDATE dm_daftar SET status = CASE
  WHEN kegiatan_no = 1 THEN CASE WHEN urut <= 6 THEN 'diterima' WHEN urut = 7 THEN 'ditolak' ELSE 'batal' END
  WHEN kegiatan_no = 2 THEN CASE WHEN urut <= 4 THEN 'diterima' WHEN urut <= 6 THEN 'menunggu' ELSE 'daftar_tunggu' END
  WHEN kegiatan_no = 3 THEN CASE WHEN urut <= 2 THEN 'diterima' WHEN urut = 3 THEN 'ditolak' ELSE 'menunggu' END
  ELSE 'menunggu' END;

INSERT INTO kegiatan_pendaftaran (id, kegiatan, usaha, pendaftar, status, skor_talent, skor_rubrik, administrasi_lolos,
                                  butuh_disabilitas, kebutuhan_aksesibilitas, pakta_integritas, consent, alasan, diputuskan_oleh,
                                  diputuskan_pada, tugas_selesai, tugas_dinilai_oleh, tugas_dinilai_pada, date_created, date_updated)
SELECT p.id, p.kegiatan, p.usaha, NULL, p.status, 55 + (p.n * 9) % 40, 'placeholder-v0', p.status NOT IN ('ditolak', 'batal'),
       p.n % 10 = 7, CASE WHEN p.n % 10 = 7 THEN 'dummy_Butuh akses kursi roda' END, p.kegiatan_no = 2, TRUE,
       CASE WHEN p.status = 'ditolak' THEN 'dummy_Tidak memenuhi syarat skala usaha' END,
       CASE WHEN p.status IN ('diterima', 'ditolak', 'daftar_tunggu') THEN (SELECT admin FROM dm_akun) END,
       CASE WHEN p.status IN ('diterima', 'ditolak', 'daftar_tunggu') THEN now() - make_interval(days => 30 - p.kegiatan_no * 5) END,
       p.kegiatan_no = 1 AND p.status = 'diterima' AND p.urut <= 5,
       CASE WHEN p.kegiatan_no = 1 AND p.status = 'diterima' AND p.urut <= 5 THEN (SELECT admin FROM dm_akun) END,
       CASE WHEN p.kegiatan_no = 1 AND p.status = 'diterima' AND p.urut <= 5 THEN now() - interval '22 days' END,
       now() - make_interval(days => 45 - p.kegiatan_no * 5, hours => p.urut::int), now() - make_interval(days => 30 - p.kegiatan_no * 5)
  FROM dm_daftar p;

INSERT INTO kegiatan_keputusan_audit (pendaftaran, status_dari, status_ke, skor_talent, skor_rubrik, alasan, diputuskan_oleh, diputuskan_pada)
SELECT kp.id, 'menunggu', kp.status, kp.skor_talent, kp.skor_rubrik, kp.alasan, kp.diputuskan_oleh, kp.diputuskan_pada
  FROM kegiatan_pendaftaran kp JOIN dm_daftar p ON p.id = kp.id WHERE kp.diputuskan_oleh IS NOT NULL;

-- Presensi K1: peserta diterima 1–5 hadir dua sesi, peserta ke-6 hanya sesi 1 (tidak lolos 80%).
INSERT INTO kegiatan_presensi (pendaftaran, sesi_ke, hadir, dipindai_oleh, dipindai_pada)
SELECT p.id, s.sesi, TRUE, (SELECT admin FROM dm_akun),
       ((SELECT hari_ini FROM dm_hari) - 25 + s.sesi)::timestamp + time '08:30' + make_interval(mins => p.urut::int)
  FROM dm_daftar p CROSS JOIN generate_series(1, 2) AS s(sesi)
 WHERE p.kegiatan_no = 1 AND p.status = 'diterima' AND (p.urut <= 5 OR s.sesi = 1);

UPDATE kegiatan g SET terisi = (SELECT COUNT(*) FROM kegiatan_pendaftaran p WHERE p.kegiatan = g.id AND p.status = 'diterima')
 WHERE g.id IN (SELECT id FROM dm_kegiatan);

-- Sertifikat K1 untuk peserta 1–4 (peserta 5 memenuhi syarat tapi belum diterbitkan → tombol terbit).
-- Kode SKDUMMY… ; payload_hash/signature diisi sign-dummy-program.mjs.
INSERT INTO kegiatan_sertifikat (pendaftaran, kode, payload_hash, signature, kid, status, diterbitkan_oleh, diterbitkan_pada)
SELECT p.id, 'SKDUMMY' || translate(lpad(p.urut::text, 5, '0'), '01', 'AB'), 'unsigned', 'unsigned', NULL, 'aktif',
       (SELECT admin FROM dm_akun), now() - interval '21 days'
  FROM dm_daftar p WHERE p.kegiatan_no = 1 AND p.status = 'diterima' AND p.urut <= 4;
INSERT INTO kegiatan_sertifikat_dampak (sertifikat, usaha, aktif, diperbarui_pada)
SELECT s.id, p.usaha, TRUE, s.diterbitkan_pada
  FROM kegiatan_sertifikat s JOIN dm_daftar p ON p.id = s.pendaftaran;

-- Proyeksikan usaha dummy ke read model (usaha_tabular dsb.) satu per satu, bukan rebuild penuh.
SELECT COUNT(*) AS proyeksi_diantrekan
  FROM (SELECT analitik_enqueue_job('project_record_change', 'project_record:' || usaha::text, usaha) FROM dm_usaha) q;

SELECT 'usaha' AS tabel, COUNT(*) FROM usaha WHERE sumber_id LIKE 'dummy\_prog\_%'
UNION ALL SELECT 'talent_pengajuan', COUNT(*) FROM talent_pengajuan WHERE usaha IN (SELECT usaha FROM dm_usaha)
UNION ALL SELECT 'program_peserta', COUNT(*) FROM program_peserta WHERE batch = 'dummy_batch_2026_A'
UNION ALL SELECT 'kpi_laporan', COUNT(*) FROM kpi_laporan WHERE peserta IN (SELECT id FROM program_peserta WHERE batch = 'dummy_batch_2026_A')
UNION ALL SELECT 'investor_profil', COUNT(*) FROM investor_profil WHERE usaha IN (SELECT usaha FROM dm_usaha)
UNION ALL SELECT 'produk', COUNT(*) FROM produk WHERE usaha IN (SELECT usaha FROM dm_usaha)
UNION ALL SELECT 'produk_loi', COUNT(*) FROM produk_loi WHERE email LIKE 'dummy\_%'
UNION ALL SELECT 'talent_passport', COUNT(*) FROM talent_passport WHERE usaha IN (SELECT usaha FROM dm_usaha)
UNION ALL SELECT 'klinik_konsultan', COUNT(*) FROM klinik_konsultan WHERE nama LIKE 'dummy\_%'
UNION ALL SELECT 'konsultasi_tiket', COUNT(*) FROM konsultasi_tiket WHERE nomor LIKE 'dummy\_%'
UNION ALL SELECT 'konsultasi_outcome', COUNT(*) FROM konsultasi_outcome WHERE usaha IN (SELECT usaha FROM dm_usaha)
UNION ALL SELECT 'kegiatan', COUNT(*) FROM kegiatan WHERE judul LIKE 'dummy\_%'
UNION ALL SELECT 'kegiatan_pendaftaran', COUNT(*) FROM kegiatan_pendaftaran WHERE usaha IN (SELECT usaha FROM dm_usaha)
UNION ALL SELECT 'kegiatan_sertifikat', COUNT(*) FROM kegiatan_sertifikat WHERE kode LIKE 'SKDUMMY%';

COMMIT;

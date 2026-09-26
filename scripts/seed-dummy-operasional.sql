-- Seed data dummy dashboard operasional (fase Y01). HANYA untuk stack disposable.
-- Jalankan SETELAH: node scripts/seed-dummy-operasional.mjs seed
-- Semua baris bertanda dummy_ dan dibersihkan oleh scripts/cleanup-dummy-operasional.sql.
BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM directus_users WHERE email LIKE 'dummy\_%') < 4 THEN
    RAISE EXCEPTION 'Jalankan node scripts/seed-dummy-operasional.mjs seed terlebih dahulu';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.dummy_kelurahan(token text) RETURNS integer AS $fn$
DECLARE
  v_provinsi integer;
  v_kota integer;
  v_kecamatan integer;
  v_kelurahan integer;
  v_count integer;
BEGIN
  SELECT id INTO v_provinsi FROM provinsi WHERE lower(nama) = 'jawa barat' LIMIT 1;
  IF v_provinsi IS NULL THEN
    INSERT INTO provinsi (nama, kode) VALUES ('JAWA BARAT', 'dummy_32') RETURNING id INTO v_provinsi;
  END IF;

  SELECT count(*) INTO v_count FROM kota WHERE provinsi = v_provinsi AND lower(nama) LIKE '%' || token || '%';
  IF v_count > 1 THEN
    RAISE EXCEPTION 'Token wilayah % ambigu pada tabel kota', token;
  ELSIF v_count = 1 THEN
    SELECT id INTO v_kota FROM kota WHERE provinsi = v_provinsi AND lower(nama) LIKE '%' || token || '%' LIMIT 1;
  ELSE
    INSERT INTO kota (nama, kode, provinsi) VALUES ('KABUPATEN ' || upper(token), 'dummy_kota_' || token, v_provinsi)
    RETURNING id INTO v_kota;
  END IF;

  SELECT min(id) INTO v_kecamatan FROM kecamatan WHERE kota = v_kota;
  IF v_kecamatan IS NULL THEN
    INSERT INTO kecamatan (nama, kode, kota) VALUES (upper(token) || ' TENGAH', 'dummy_kec_' || token, v_kota)
    RETURNING id INTO v_kecamatan;
  END IF;

  SELECT min(id) INTO v_kelurahan FROM kelurahan WHERE kecamatan = v_kecamatan;
  IF v_kelurahan IS NULL THEN
    INSERT INTO kelurahan (nama, kode, kecamatan) VALUES ('DESA ' || upper(token), 'dummy_kel_' || token, v_kecamatan)
    RETURNING id INTO v_kelurahan;
  END IF;

  RETURN v_kelurahan;
END;
$fn$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.dummy_klasifikasi(p_kode text, p_kategori text, p_deskripsi text) RETURNS integer AS $fk$
DECLARE
  v_id integer;
BEGIN
  SELECT id INTO v_id FROM klasifikasi_usaha WHERE kode = p_kode LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO klasifikasi_usaha (kode, kategori, deskripsi)
    VALUES (p_kode, p_kategori, 'dummy_' || p_deskripsi)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$fk$ LANGUAGE plpgsql;

DO $seed$
DECLARE
  v_kelurahan_01 integer;
  v_kbli_01 integer;
  v_alamat_01 integer;
  v_pelaku_01 uuid;
  v_kelurahan_02 integer;
  v_kbli_02 integer;
  v_alamat_02 integer;
  v_pelaku_02 uuid;
  v_kelurahan_03 integer;
  v_kbli_03 integer;
  v_alamat_03 integer;
  v_pelaku_03 uuid;
  v_kelurahan_04 integer;
  v_kbli_04 integer;
  v_alamat_04 integer;
  v_pelaku_04 uuid;
  v_kelurahan_05 integer;
  v_kbli_05 integer;
  v_alamat_05 integer;
  v_pelaku_05 uuid;
  v_kelurahan_06 integer;
  v_kbli_06 integer;
  v_alamat_06 integer;
  v_pelaku_06 uuid;
  v_kelurahan_07 integer;
  v_kbli_07 integer;
  v_alamat_07 integer;
  v_pelaku_07 uuid;
  v_kelurahan_08 integer;
  v_kbli_08 integer;
  v_alamat_08 integer;
  v_pelaku_08 uuid;
BEGIN

  -- 01 Wawan Leathercraft
  SELECT pg_temp.dummy_kelurahan('subang') INTO v_kelurahan_01;
  SELECT pg_temp.dummy_klasifikasi('15121', 'INDUSTRI PENGOLAHAN', 'Industri Barang dari Kulit') INTO v_kbli_01;

  SELECT id INTO v_alamat_01 FROM alamat WHERE alamat_jalan = 'Jl. Contoh No. 01' LIMIT 1;
  IF v_alamat_01 IS NULL THEN
    INSERT INTO alamat (kelurahan, alamat_jalan) VALUES (v_kelurahan_01, 'Jl. Contoh No. 01')
    RETURNING id INTO v_alamat_01;
  END IF;

  INSERT INTO pelaku_usaha (nik, nama_lengkap, jenis_kelamin, tingkat_pendidikan, alamat)
  VALUES ('dummy_0000000001', 'Wawan Setiawan', 'male', NULL, v_alamat_01)
  ON CONFLICT (nik) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap, alamat = EXCLUDED.alamat
  RETURNING id INTO v_pelaku_01;

  INSERT INTO usaha (id, sumber_id, pelaku_usaha, nib, nama, kegiatan_utama, klasifikasi,
                     status, status_hukum, skala, omzet_tahunan, total_aset, alamat, latitude, longitude)
  VALUES ('d0000000-0000-4000-8000-000000000001', 'dummy_usaha_01', v_pelaku_01, '9900000000001', 'Wawan Leathercraft',
          'Industri Barang dari Kulit', v_kbli_01, 'active', 'sole_proprietorship', 'small', 780000000, 250000000, v_alamat_01,
          -6.5715, 107.7587)
  ON CONFLICT (id) DO UPDATE SET
    nama = EXCLUDED.nama, nib = EXCLUDED.nib, klasifikasi = EXCLUDED.klasifikasi, status = 'active',
    status_hukum = EXCLUDED.status_hukum, skala = EXCLUDED.skala, omzet_tahunan = EXCLUDED.omzet_tahunan,
    total_aset = EXCLUDED.total_aset, alamat = EXCLUDED.alamat, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;

  INSERT INTO statistik_tenaga_kerja (usaha, dibayar_laki_laki, dibayar_perempuan)
  VALUES ('d0000000-0000-4000-8000-000000000001', 4, 3)
  ON CONFLICT (usaha) DO UPDATE SET
    dibayar_laki_laki = EXCLUDED.dibayar_laki_laki, dibayar_perempuan = EXCLUDED.dibayar_perempuan;

  -- 02 Tahu Sumedang Bu Ika
  SELECT pg_temp.dummy_kelurahan('sumedang') INTO v_kelurahan_02;
  SELECT pg_temp.dummy_klasifikasi('10792', 'INDUSTRI PENGOLAHAN', 'Industri Tahu Kedelai') INTO v_kbli_02;

  SELECT id INTO v_alamat_02 FROM alamat WHERE alamat_jalan = 'Jl. Contoh No. 02' LIMIT 1;
  IF v_alamat_02 IS NULL THEN
    INSERT INTO alamat (kelurahan, alamat_jalan) VALUES (v_kelurahan_02, 'Jl. Contoh No. 02')
    RETURNING id INTO v_alamat_02;
  END IF;

  INSERT INTO pelaku_usaha (nik, nama_lengkap, jenis_kelamin, tingkat_pendidikan, alamat)
  VALUES ('dummy_0000000002', 'Ika Kartika', 'female', NULL, v_alamat_02)
  ON CONFLICT (nik) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap, alamat = EXCLUDED.alamat
  RETURNING id INTO v_pelaku_02;

  INSERT INTO usaha (id, sumber_id, pelaku_usaha, nib, nama, kegiatan_utama, klasifikasi,
                     status, status_hukum, skala, omzet_tahunan, total_aset, alamat, latitude, longitude)
  VALUES ('d0000000-0000-4000-8000-000000000002', 'dummy_usaha_02', v_pelaku_02, '9900000000002', 'Tahu Sumedang Bu Ika',
          'Industri Tahu Kedelai', v_kbli_02, 'active', 'sole_proprietorship', 'micro', 420000000, 90000000, v_alamat_02,
          -6.8586, 107.9164)
  ON CONFLICT (id) DO UPDATE SET
    nama = EXCLUDED.nama, nib = EXCLUDED.nib, klasifikasi = EXCLUDED.klasifikasi, status = 'active',
    status_hukum = EXCLUDED.status_hukum, skala = EXCLUDED.skala, omzet_tahunan = EXCLUDED.omzet_tahunan,
    total_aset = EXCLUDED.total_aset, alamat = EXCLUDED.alamat, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;

  INSERT INTO statistik_tenaga_kerja (usaha, dibayar_laki_laki, dibayar_perempuan)
  VALUES ('d0000000-0000-4000-8000-000000000002', 2, 4)
  ON CONFLICT (usaha) DO UPDATE SET
    dibayar_laki_laki = EXCLUDED.dibayar_laki_laki, dibayar_perempuan = EXCLUDED.dibayar_perempuan;

  -- 03 Kopi Gunung Garut
  SELECT pg_temp.dummy_kelurahan('garut') INTO v_kelurahan_03;
  SELECT pg_temp.dummy_klasifikasi('10761', 'INDUSTRI PENGOLAHAN', 'Industri Pengolahan Kopi') INTO v_kbli_03;

  SELECT id INTO v_alamat_03 FROM alamat WHERE alamat_jalan = 'Jl. Contoh No. 03' LIMIT 1;
  IF v_alamat_03 IS NULL THEN
    INSERT INTO alamat (kelurahan, alamat_jalan) VALUES (v_kelurahan_03, 'Jl. Contoh No. 03')
    RETURNING id INTO v_alamat_03;
  END IF;

  INSERT INTO pelaku_usaha (nik, nama_lengkap, jenis_kelamin, tingkat_pendidikan, alamat)
  VALUES ('dummy_0000000003', 'Asep Hidayat', 'male', NULL, v_alamat_03)
  ON CONFLICT (nik) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap, alamat = EXCLUDED.alamat
  RETURNING id INTO v_pelaku_03;

  INSERT INTO usaha (id, sumber_id, pelaku_usaha, nib, nama, kegiatan_utama, klasifikasi,
                     status, status_hukum, skala, omzet_tahunan, total_aset, alamat, latitude, longitude)
  VALUES ('d0000000-0000-4000-8000-000000000003', 'dummy_usaha_03', v_pelaku_03, '9900000000003', 'Kopi Gunung Garut',
          'Industri Pengolahan Kopi', v_kbli_03, 'active', 'sole_proprietorship', 'small', 950000000, 400000000, v_alamat_03,
          -7.2279, 107.9087)
  ON CONFLICT (id) DO UPDATE SET
    nama = EXCLUDED.nama, nib = EXCLUDED.nib, klasifikasi = EXCLUDED.klasifikasi, status = 'active',
    status_hukum = EXCLUDED.status_hukum, skala = EXCLUDED.skala, omzet_tahunan = EXCLUDED.omzet_tahunan,
    total_aset = EXCLUDED.total_aset, alamat = EXCLUDED.alamat, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;

  INSERT INTO statistik_tenaga_kerja (usaha, dibayar_laki_laki, dibayar_perempuan)
  VALUES ('d0000000-0000-4000-8000-000000000003', 6, 2)
  ON CONFLICT (usaha) DO UPDATE SET
    dibayar_laki_laki = EXCLUDED.dibayar_laki_laki, dibayar_perempuan = EXCLUDED.dibayar_perempuan;

  -- 04 Batik Cimahi Lestari
  SELECT pg_temp.dummy_kelurahan('cimahi') INTO v_kelurahan_04;
  SELECT pg_temp.dummy_klasifikasi('13134', 'INDUSTRI PENGOLAHAN', 'Industri Batik') INTO v_kbli_04;

  SELECT id INTO v_alamat_04 FROM alamat WHERE alamat_jalan = 'Jl. Contoh No. 04' LIMIT 1;
  IF v_alamat_04 IS NULL THEN
    INSERT INTO alamat (kelurahan, alamat_jalan) VALUES (v_kelurahan_04, 'Jl. Contoh No. 04')
    RETURNING id INTO v_alamat_04;
  END IF;

  INSERT INTO pelaku_usaha (nik, nama_lengkap, jenis_kelamin, tingkat_pendidikan, alamat)
  VALUES ('dummy_0000000004', 'Dewi Lestari', 'female', NULL, v_alamat_04)
  ON CONFLICT (nik) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap, alamat = EXCLUDED.alamat
  RETURNING id INTO v_pelaku_04;

  INSERT INTO usaha (id, sumber_id, pelaku_usaha, nib, nama, kegiatan_utama, klasifikasi,
                     status, status_hukum, skala, omzet_tahunan, total_aset, alamat, latitude, longitude)
  VALUES ('d0000000-0000-4000-8000-000000000004', 'dummy_usaha_04', v_pelaku_04, '9900000000004', 'Batik Cimahi Lestari',
          'Industri Batik', v_kbli_04, 'active', 'sole_proprietorship', 'micro', 300000000, 60000000, v_alamat_04,
          -6.8722, 107.5425)
  ON CONFLICT (id) DO UPDATE SET
    nama = EXCLUDED.nama, nib = EXCLUDED.nib, klasifikasi = EXCLUDED.klasifikasi, status = 'active',
    status_hukum = EXCLUDED.status_hukum, skala = EXCLUDED.skala, omzet_tahunan = EXCLUDED.omzet_tahunan,
    total_aset = EXCLUDED.total_aset, alamat = EXCLUDED.alamat, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;

  INSERT INTO statistik_tenaga_kerja (usaha, dibayar_laki_laki, dibayar_perempuan)
  VALUES ('d0000000-0000-4000-8000-000000000004', 1, 5)
  ON CONFLICT (usaha) DO UPDATE SET
    dibayar_laki_laki = EXCLUDED.dibayar_laki_laki, dibayar_perempuan = EXCLUDED.dibayar_perempuan;

  -- 05 Keripik Nanas Subang
  SELECT pg_temp.dummy_kelurahan('subang') INTO v_kelurahan_05;
  SELECT pg_temp.dummy_klasifikasi('10794', 'INDUSTRI PENGOLAHAN', 'Industri Kerupuk, Keripik, Peyek dan Sejenisnya') INTO v_kbli_05;

  SELECT id INTO v_alamat_05 FROM alamat WHERE alamat_jalan = 'Jl. Contoh No. 05' LIMIT 1;
  IF v_alamat_05 IS NULL THEN
    INSERT INTO alamat (kelurahan, alamat_jalan) VALUES (v_kelurahan_05, 'Jl. Contoh No. 05')
    RETURNING id INTO v_alamat_05;
  END IF;

  INSERT INTO pelaku_usaha (nik, nama_lengkap, jenis_kelamin, tingkat_pendidikan, alamat)
  VALUES ('dummy_0000000005', 'Siti Aminah', 'female', NULL, v_alamat_05)
  ON CONFLICT (nik) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap, alamat = EXCLUDED.alamat
  RETURNING id INTO v_pelaku_05;

  INSERT INTO usaha (id, sumber_id, pelaku_usaha, nib, nama, kegiatan_utama, klasifikasi,
                     status, status_hukum, skala, omzet_tahunan, total_aset, alamat, latitude, longitude)
  VALUES ('d0000000-0000-4000-8000-000000000005', 'dummy_usaha_05', v_pelaku_05, '9900000000005', 'Keripik Nanas Subang',
          'Industri Kerupuk, Keripik, Peyek dan Sejenisnya', v_kbli_05, 'active', 'sole_proprietorship', 'micro', 240000000, 45000000, v_alamat_05,
          -6.5602, 107.7731)
  ON CONFLICT (id) DO UPDATE SET
    nama = EXCLUDED.nama, nib = EXCLUDED.nib, klasifikasi = EXCLUDED.klasifikasi, status = 'active',
    status_hukum = EXCLUDED.status_hukum, skala = EXCLUDED.skala, omzet_tahunan = EXCLUDED.omzet_tahunan,
    total_aset = EXCLUDED.total_aset, alamat = EXCLUDED.alamat, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;

  INSERT INTO statistik_tenaga_kerja (usaha, dibayar_laki_laki, dibayar_perempuan)
  VALUES ('d0000000-0000-4000-8000-000000000005', 1, 3)
  ON CONFLICT (usaha) DO UPDATE SET
    dibayar_laki_laki = EXCLUDED.dibayar_laki_laki, dibayar_perempuan = EXCLUDED.dibayar_perempuan;

  -- 06 Madu Hutan Subang
  SELECT pg_temp.dummy_kelurahan('subang') INTO v_kelurahan_06;
  SELECT pg_temp.dummy_klasifikasi('10799', 'INDUSTRI PENGOLAHAN', 'Industri Produk Makanan Lainnya') INTO v_kbli_06;

  SELECT id INTO v_alamat_06 FROM alamat WHERE alamat_jalan = 'Jl. Contoh No. 06' LIMIT 1;
  IF v_alamat_06 IS NULL THEN
    INSERT INTO alamat (kelurahan, alamat_jalan) VALUES (v_kelurahan_06, 'Jl. Contoh No. 06')
    RETURNING id INTO v_alamat_06;
  END IF;

  INSERT INTO pelaku_usaha (nik, nama_lengkap, jenis_kelamin, tingkat_pendidikan, alamat)
  VALUES ('dummy_0000000006', 'Dadan Ramdani', 'male', NULL, v_alamat_06)
  ON CONFLICT (nik) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap, alamat = EXCLUDED.alamat
  RETURNING id INTO v_pelaku_06;

  INSERT INTO usaha (id, sumber_id, pelaku_usaha, nib, nama, kegiatan_utama, klasifikasi,
                     status, status_hukum, skala, omzet_tahunan, total_aset, alamat, latitude, longitude)
  VALUES ('d0000000-0000-4000-8000-000000000006', 'dummy_usaha_06', v_pelaku_06, '9900000000006', 'Madu Hutan Subang',
          'Industri Produk Makanan Lainnya', v_kbli_06, 'active', 'sole_proprietorship', 'micro', 180000000, 30000000, v_alamat_06,
          -6.6105, 107.7402)
  ON CONFLICT (id) DO UPDATE SET
    nama = EXCLUDED.nama, nib = EXCLUDED.nib, klasifikasi = EXCLUDED.klasifikasi, status = 'active',
    status_hukum = EXCLUDED.status_hukum, skala = EXCLUDED.skala, omzet_tahunan = EXCLUDED.omzet_tahunan,
    total_aset = EXCLUDED.total_aset, alamat = EXCLUDED.alamat, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;

  INSERT INTO statistik_tenaga_kerja (usaha, dibayar_laki_laki, dibayar_perempuan)
  VALUES ('d0000000-0000-4000-8000-000000000006', 2, 1)
  ON CONFLICT (usaha) DO UPDATE SET
    dibayar_laki_laki = EXCLUDED.dibayar_laki_laki, dibayar_perempuan = EXCLUDED.dibayar_perempuan;

  -- 07 Anyaman Bambu Karawang
  SELECT pg_temp.dummy_kelurahan('karawang') INTO v_kelurahan_07;
  SELECT pg_temp.dummy_klasifikasi('16292', 'INDUSTRI PENGOLAHAN', 'Industri Kerajinan Anyaman dari Bambu, Rotan dan Sejenisnya') INTO v_kbli_07;

  SELECT id INTO v_alamat_07 FROM alamat WHERE alamat_jalan = 'Jl. Contoh No. 07' LIMIT 1;
  IF v_alamat_07 IS NULL THEN
    INSERT INTO alamat (kelurahan, alamat_jalan) VALUES (v_kelurahan_07, 'Jl. Contoh No. 07')
    RETURNING id INTO v_alamat_07;
  END IF;

  INSERT INTO pelaku_usaha (nik, nama_lengkap, jenis_kelamin, tingkat_pendidikan, alamat)
  VALUES ('dummy_0000000007', 'Nining Suryani', 'female', NULL, v_alamat_07)
  ON CONFLICT (nik) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap, alamat = EXCLUDED.alamat
  RETURNING id INTO v_pelaku_07;

  INSERT INTO usaha (id, sumber_id, pelaku_usaha, nib, nama, kegiatan_utama, klasifikasi,
                     status, status_hukum, skala, omzet_tahunan, total_aset, alamat, latitude, longitude)
  VALUES ('d0000000-0000-4000-8000-000000000007', 'dummy_usaha_07', v_pelaku_07, '9900000000007', 'Anyaman Bambu Karawang',
          'Industri Kerajinan Anyaman dari Bambu, Rotan dan Sejenisnya', v_kbli_07, 'active', 'sole_proprietorship', 'micro', 150000000, 25000000, v_alamat_07,
          -6.3227, 107.3376)
  ON CONFLICT (id) DO UPDATE SET
    nama = EXCLUDED.nama, nib = EXCLUDED.nib, klasifikasi = EXCLUDED.klasifikasi, status = 'active',
    status_hukum = EXCLUDED.status_hukum, skala = EXCLUDED.skala, omzet_tahunan = EXCLUDED.omzet_tahunan,
    total_aset = EXCLUDED.total_aset, alamat = EXCLUDED.alamat, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;

  INSERT INTO statistik_tenaga_kerja (usaha, dibayar_laki_laki, dibayar_perempuan)
  VALUES ('d0000000-0000-4000-8000-000000000007', 0, 4)
  ON CONFLICT (usaha) DO UPDATE SET
    dibayar_laki_laki = EXCLUDED.dibayar_laki_laki, dibayar_perempuan = EXCLUDED.dibayar_perempuan;

  -- 08 Sambal Subang Mantap
  SELECT pg_temp.dummy_kelurahan('subang') INTO v_kelurahan_08;
  SELECT pg_temp.dummy_klasifikasi('10779', 'INDUSTRI PENGOLAHAN', 'Industri Bumbu Masak dan Penyedap Masakan Lainnya') INTO v_kbli_08;

  SELECT id INTO v_alamat_08 FROM alamat WHERE alamat_jalan = 'Jl. Contoh No. 08' LIMIT 1;
  IF v_alamat_08 IS NULL THEN
    INSERT INTO alamat (kelurahan, alamat_jalan) VALUES (v_kelurahan_08, 'Jl. Contoh No. 08')
    RETURNING id INTO v_alamat_08;
  END IF;

  INSERT INTO pelaku_usaha (nik, nama_lengkap, jenis_kelamin, tingkat_pendidikan, alamat)
  VALUES ('dummy_0000000008', 'Yudi Permana', 'male', NULL, v_alamat_08)
  ON CONFLICT (nik) DO UPDATE SET nama_lengkap = EXCLUDED.nama_lengkap, alamat = EXCLUDED.alamat
  RETURNING id INTO v_pelaku_08;

  INSERT INTO usaha (id, sumber_id, pelaku_usaha, nib, nama, kegiatan_utama, klasifikasi,
                     status, status_hukum, skala, omzet_tahunan, total_aset, alamat, latitude, longitude)
  VALUES ('d0000000-0000-4000-8000-000000000008', 'dummy_usaha_08', v_pelaku_08, '9900000000008', 'Sambal Subang Mantap',
          'Industri Bumbu Masak dan Penyedap Masakan Lainnya', v_kbli_08, 'active', 'sole_proprietorship', 'micro', 360000000, 70000000, v_alamat_08,
          -6.5488, 107.761)
  ON CONFLICT (id) DO UPDATE SET
    nama = EXCLUDED.nama, nib = EXCLUDED.nib, klasifikasi = EXCLUDED.klasifikasi, status = 'active',
    status_hukum = EXCLUDED.status_hukum, skala = EXCLUDED.skala, omzet_tahunan = EXCLUDED.omzet_tahunan,
    total_aset = EXCLUDED.total_aset, alamat = EXCLUDED.alamat, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;

  INSERT INTO statistik_tenaga_kerja (usaha, dibayar_laki_laki, dibayar_perempuan)
  VALUES ('d0000000-0000-4000-8000-000000000008', 2, 2)
  ON CONFLICT (usaha) DO UPDATE SET
    dibayar_laki_laki = EXCLUDED.dibayar_laki_laki, dibayar_perempuan = EXCLUDED.dibayar_perempuan;

  -- Tautkan akun dummy ke wilayah/usaha.
  UPDATE directus_users u
  SET kota = (
    SELECT k.id FROM kota k JOIN provinsi p ON p.id = k.provinsi
    WHERE lower(p.nama) = 'jawa barat' AND lower(k.nama) LIKE '%subang%'
    LIMIT 1
  )
  WHERE u.email = 'dummy_admin.subang@jabarprov.go.id';

  UPDATE directus_users
  SET usaha = 'd0000000-0000-4000-8000-000000000001'
  WHERE email = 'dummy_wawan.leathercraft@gmail.com';

  -- Bangun ulang read model agar usaha_tabular/infografis memuat baris dummy.
  PERFORM analitik_enqueue_job('rebuild_current_model', 'rebuild_current_model', NULL);
END;
$seed$;

-- ── Y02: 15 atribut Jabar + talenta/BA (skor = literal rubrik v1, terverifikasi
-- silang terhadap omzet/TK seed Y01 di atas: 01→97.75, 02→78.00, 03→93.50,
-- 04→50.44, 05→73.75, 07→19.25, 08→87.88) ───────────────────────────────
WITH admin AS (
  SELECT
    (SELECT id FROM directus_users WHERE email = 'dummy_admin@diskuk.jabarprov.go.id') AS prov,
    (SELECT id FROM directus_users WHERE email = 'dummy_admin.subang@jabarprov.go.id') AS subang
),
atribut(usaha, npwp, izin, halal, pirt, hki, sni, rek, sop, ecom, medsos, qris, buku, kur, rantai, offtaker, verifikator, verifikasi_pada) AS (
  VALUES
    ('d0000000-0000-4000-8000-000000000001'::uuid, TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE, TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  'subang', '2026-09-20T03:00:00Z'),
    ('d0000000-0000-4000-8000-000000000002'::uuid, TRUE,  TRUE,  TRUE,  TRUE,  FALSE, FALSE, TRUE,  FALSE, TRUE,  TRUE,  TRUE,  FALSE, TRUE,  FALSE, FALSE, NULL,     NULL),
    ('d0000000-0000-4000-8000-000000000003'::uuid, TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE, TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE, TRUE,  TRUE,  'prov',   '2026-09-20T03:00:00Z'),
    ('d0000000-0000-4000-8000-000000000004'::uuid, FALSE, FALSE, FALSE, FALSE, TRUE,  FALSE, FALSE, FALSE, TRUE,  TRUE,  TRUE,  FALSE, FALSE, FALSE, FALSE, NULL,     NULL),
    ('d0000000-0000-4000-8000-000000000005'::uuid, TRUE,  TRUE,  TRUE,  TRUE,  FALSE, FALSE, TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE, TRUE,  FALSE, NULL,     NULL),
    ('d0000000-0000-4000-8000-000000000007'::uuid, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE, NULL,     NULL),
    ('d0000000-0000-4000-8000-000000000008'::uuid, TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE, TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  'subang', '2026-09-20T03:00:00Z')
)
INSERT INTO usaha_atribut_jabar (
  usaha, npwp_usaha, izin_edar, sertifikat_halal, pirt_bpom, hki_merek, sni,
  rekening_terpisah, sop_tertulis, ecommerce, medsos_bisnis, qris,
  pembukuan_digital, akses_kur, rantai_pasok_industri, kontrak_offtaker,
  diperbarui_oleh, terverifikasi_oleh, terverifikasi_pada
)
SELECT
  a.usaha, a.npwp, a.izin, a.halal, a.pirt, a.hki, a.sni,
  a.rek, a.sop, a.ecom, a.medsos, a.qris,
  a.buku, a.kur, a.rantai, a.offtaker,
  CASE a.verifikator WHEN 'subang' THEN (SELECT subang FROM admin) WHEN 'prov' THEN (SELECT prov FROM admin) ELSE (SELECT prov FROM admin) END,
  CASE a.verifikator WHEN 'subang' THEN (SELECT subang FROM admin) WHEN 'prov' THEN (SELECT prov FROM admin) ELSE NULL END,
  a.verifikasi_pada::timestamptz
FROM atribut a
JOIN usaha u ON u.id = a.usaha
WHERE NOT EXISTS (SELECT 1 FROM usaha_atribut_jabar j WHERE j.usaha = a.usaha);

INSERT INTO talenta_berita_acara (nomor, tanggal, catatan, diterbitkan_oleh)
SELECT 'dummy_BA-TS/2026/0001', '2026-08-01'::date, 'Seed Y02 disposable',
  (SELECT id FROM directus_users WHERE email = 'dummy_admin@diskuk.jabarprov.go.id')
WHERE NOT EXISTS (SELECT 1 FROM talenta_berita_acara WHERE nomor = 'dummy_BA-TS/2026/0001');

WITH admin AS (
  SELECT
    (SELECT id FROM directus_users WHERE email = 'dummy_admin@diskuk.jabarprov.go.id') AS prov,
    (SELECT id FROM directus_users WHERE email = 'dummy_admin.subang@jabarprov.go.id') AS subang,
    (SELECT id FROM directus_files WHERE filename_download = 'dummy_surat-komitmen.jpg' LIMIT 1) AS surat,
    (SELECT id FROM talenta_berita_acara WHERE nomor = 'dummy_BA-TS/2026/0001' LIMIT 1) AS ba
),
kota_usaha AS (
  SELECT u.id AS usaha, ko.id AS kota, ko.nama AS kota_nama
  FROM usaha u
  LEFT JOIN alamat a ON a.id = u.alamat
  LEFT JOIN kelurahan kl ON kl.id = a.kelurahan
  LEFT JOIN kecamatan kc ON kc.id = kl.kecamatan
  LEFT JOIN kota ko ON ko.id = kc.kota
),
talenta_seed(usaha, status, kapasitas, satuan, halal, pirt, hki, qris, catat, surat_ada, fin, pas, leg, sdm, total, rekomendasi, ba_ya, dinominasikan_pada, alasan, ditolak_pada) AS (
  VALUES
    ('d0000000-0000-4000-8000-000000000001'::uuid, 'scouting', 1200, 'unit', TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  100.00, 100.00, 100.00, 91.00, 97.75, 'Direkomendasikan Masuk Talent Pool', TRUE,  NULL, NULL, NULL),
    ('d0000000-0000-4000-8000-000000000002'::uuid, 'scouting', 3000, 'kg',   TRUE,  TRUE,  FALSE, TRUE,  FALSE, TRUE,  64.00,  100.00, 80.00,  68.00, 78.00, 'Direkomendasikan Masuk Talent Pool', TRUE,  NULL, NULL, NULL),
    ('d0000000-0000-4000-8000-000000000003'::uuid, 'scouting', 800,  'kg',   TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  85.00,  95.00,  100.00, 94.00, 93.50, 'Direkomendasikan Masuk Talent Pool', TRUE,  NULL, NULL, NULL),
    ('d0000000-0000-4000-8000-000000000004'::uuid, 'diajukan', 150,  'unit', FALSE, FALSE, TRUE,  TRUE,  FALSE, TRUE,  35.00,  78.75,  40.00,  48.00, 50.44, 'Belum Direkomendasikan',               FALSE, NULL, NULL, NULL),
    ('d0000000-0000-4000-8000-000000000005'::uuid, 'dinilai',  600,  'kg',   TRUE,  TRUE,  FALSE, TRUE,  TRUE,  TRUE,  43.00,  90.00,  80.00,  82.00, 73.75, 'Dipertimbangkan',                        FALSE, '2026-09-22T03:00:00Z', NULL, NULL),
    ('d0000000-0000-4000-8000-000000000007'::uuid, 'ditolak',  100,  'unit', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 17.50,  27.50,  20.00,  12.00, 19.25, 'Belum Direkomendasikan',               FALSE, NULL, 'Kapasitas produksi belum memadai', '2026-07-25T03:00:00Z'),
    ('d0000000-0000-4000-8000-000000000008'::uuid, 'scouting', 900,  'kg',   TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  72.00,  97.50,  100.00, 82.00, 87.88, 'Direkomendasikan Masuk Talent Pool', TRUE,  NULL, NULL, NULL)
)
INSERT INTO talenta (
  usaha, kota, status, kapasitas_produksi_bulanan, satuan_kapasitas,
  kesiapan_halal, kesiapan_pirt_bpom, kesiapan_hki, adopsi_qris, pencatatan_keuangan_digital,
  surat_komitmen, skor_finansial, skor_pasar, skor_legalitas, skor_sdm, skor_total,
  rubrik_versi, rekomendasi, diajukan_oleh,
  dinominasikan_oleh, dinominasikan_pada,
  alasan_penolakan, ditolak_oleh, ditolak_pada, berita_acara
)
SELECT
  s.usaha, ku.kota, s.status, s.kapasitas, s.satuan,
  s.halal, s.pirt, s.hki, s.qris, s.catat,
  CASE WHEN s.surat_ada THEN (SELECT surat FROM admin) ELSE NULL END,
  s.fin, s.pas, s.leg, s.sdm, s.total,
  1, s.rekomendasi,
  CASE WHEN ku.kota_nama ILIKE '%subang%' THEN (SELECT subang FROM admin) ELSE (SELECT prov FROM admin) END,
  CASE WHEN s.status IN ('dinilai','scouting') OR s.dinominasikan_pada IS NOT NULL THEN (SELECT prov FROM admin) ELSE NULL END,
  s.dinominasikan_pada::timestamptz,
  s.alasan,
  CASE WHEN s.status = 'ditolak' THEN (SELECT prov FROM admin) ELSE NULL END,
  s.ditolak_pada::timestamptz,
  CASE WHEN s.ba_ya THEN (SELECT ba FROM admin) ELSE NULL END
FROM talenta_seed s
JOIN kota_usaha ku ON ku.usaha = s.usaha
WHERE NOT EXISTS (SELECT 1 FROM talenta t WHERE t.usaha = s.usaha);

-- ── Y03: batch program + penugasan pendamping + laporan Jumat ──────────────
-- Batch mulai 35 hari lalu (WIB) agar minggu berjalan = 6 pada hari seed.
INSERT INTO program_batch (kode, nama, tahap, tanggal_mulai, jumlah_minggu, faktor_target, dibuat_oleh)
SELECT 'dummy_ACC-2026-B1', 'Batch 1', 'accelerator',
  (now() AT TIME ZONE 'Asia/Jakarta')::date - 35, 12, 1.20,
  (SELECT id FROM directus_users WHERE email = 'dummy_admin@diskuk.jabarprov.go.id')
WHERE NOT EXISTS (SELECT 1 FROM program_batch WHERE kode = 'dummy_ACC-2026-B1');

INSERT INTO program_batch (kode, nama, tahap, tanggal_mulai, jumlah_minggu, faktor_target, dibuat_oleh)
SELECT 'dummy_TL-2026-B1', 'Talent Lab Batch 1', 'talent_lab',
  (now() AT TIME ZONE 'Asia/Jakarta')::date - 10, 4, 1.00,
  (SELECT id FROM directus_users WHERE email = 'dummy_admin@diskuk.jabarprov.go.id')
WHERE NOT EXISTS (SELECT 1 FROM program_batch WHERE kode = 'dummy_TL-2026-B1');

UPDATE talenta t SET
  status = 'accelerator',
  batch = (SELECT id FROM program_batch WHERE kode = 'dummy_ACC-2026-B1'),
  pendamping = (SELECT id FROM directus_users WHERE email = 'dummy_coach.pendamping@jabarprov.go.id')
WHERE t.usaha IN ('d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000008');

UPDATE talenta t SET
  status = 'talent_lab',
  batch = (SELECT id FROM program_batch WHERE kode = 'dummy_TL-2026-B1')
WHERE t.usaha = 'd0000000-0000-4000-8000-000000000003';

-- Laporan: client_uuid deterministik, dikirim Jumat WIB (minggu*7-2 hari setelah mulai, jam 10 WIB).
WITH batch AS (SELECT id, tanggal_mulai FROM program_batch WHERE kode = 'dummy_ACC-2026-B1' LIMIT 1),
coach AS (SELECT id FROM directus_users WHERE email = 'dummy_coach.pendamping@jabarprov.go.id' LIMIT 1),
bukti AS (SELECT id FROM directus_files WHERE filename_download = 'dummy_nota-mingguan.jpg' LIMIT 1),
seed(nn, minggu, omzet, transaksi, status, catatan_pendamping, kendala) AS (
  VALUES
    ('01', 1, 16500000, 42, 'disetujui', 'Pertahankan pencatatan harian.', NULL),
    ('01', 2, 18200000, 47, 'disetujui', 'Target tercapai.', NULL),
    ('01', 3, 19000000, 51, 'disetujui', 'Bagus, stok bahan kulit aman.', NULL),
    ('01', 4, 20100000, 55, 'disetujui', 'Konsisten di atas target.', NULL),
    ('01', 5, 21000000, 58, 'menunggu', NULL, NULL),
    ('02', 1, 9800000, 130, 'disetujui', 'Target tercapai.', NULL),
    ('02', 2, 6100000, 88, 'disetujui', 'Harga kedelai naik, evaluasi harga jual.', 'Kenaikan harga bahan baku kedelai'),
    ('02', 3, 6400000, 90, 'disetujui', 'Perlu bimbingan teknis pemasaran.', NULL),
    ('08', 1, 8500000, 210, 'disetujui', 'Target tercapai.', NULL),
    ('08', 2, 8900000, 220, 'disetujui', 'Target tercapai.', NULL),
    ('08', 3, 7900000, 190, 'ditolak', 'Foto nota tidak terbaca, mohon unggah ulang.', NULL),
    ('08', 4, 8600000, 205, 'menunggu', NULL, NULL)
)
INSERT INTO talenta_laporan_mingguan
  (talenta, minggu_ke, omzet, jumlah_transaksi, target, bukti, catatan_kendala, status,
   catatan_pendamping, diverifikasi_oleh, diverifikasi_pada, client_uuid, dikirim_pada, provenance)
SELECT
  (SELECT id FROM talenta WHERE usaha = ('d0000000-0000-4000-8000-0000000000' || s.nn)::uuid LIMIT 1),
  s.minggu, s.omzet, s.transaksi,
  CASE
    WHEN s.nn = '01' THEN 18000000
    WHEN s.nn = '02' THEN 9692308
    ELSE 8307692
  END,
  (SELECT id FROM bukti),
  s.kendala, s.status::text,
  s.catatan_pendamping,
  CASE WHEN s.status IN ('disetujui','ditolak') THEN (SELECT id FROM coach) ELSE NULL END,
  CASE WHEN s.status IN ('disetujui','ditolak')
    THEN ((SELECT tanggal_mulai FROM batch) + (s.minggu*7 - 2))::timestamptz + interval '1 day' + time '03:00'
    ELSE NULL END,
  ('d1000000-0000-4000-8000-00000000' || s.nn || lpad(s.minggu::text, 2, '0'))::uuid,
  (((SELECT tanggal_mulai FROM batch) + (s.minggu*7 - 2))::timestamptz + time '03:00'),
  'online'
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM talenta_laporan_mingguan l
  JOIN talenta t ON t.id = l.talenta
  WHERE t.usaha = ('d0000000-0000-4000-8000-0000000000' || s.nn)::uuid AND l.minggu_ke = s.minggu
);

COMMIT;

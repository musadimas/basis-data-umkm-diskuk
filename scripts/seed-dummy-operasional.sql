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
  SET kota_scope = (
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

-- ── Y02: 15 atribut Jabar ───────────────────────────────────────────────
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

-- ── Y03: Program Akselerasi & Peserta Dummy ───────────────────────────────
WITH pendamping AS (
  SELECT id FROM directus_users WHERE email = 'dummy_coach.pendamping@jabarprov.go.id' LIMIT 1
)
INSERT INTO program_peserta (
  id, usaha, batch, fase, pendamping, tanggal_mulai, jumlah_minggu, target_mingguan, status
)
SELECT
  'd1000000-0000-4000-8000-000000000001'::uuid,
  'd0000000-0000-4000-8000-000000000001'::uuid,
  '2026-1',
  'akselerasi',
  p.id,
  (CURRENT_DATE - INTERVAL '35 days')::date,
  12,
  18000000,
  'aktif'
FROM pendamping p
ON CONFLICT (usaha, batch) DO UPDATE
SET pendamping = EXCLUDED.pendamping,
    tanggal_mulai = EXCLUDED.tanggal_mulai,
    target_mingguan = EXCLUDED.target_mingguan;

-- Laporan historis minggu 1-3 disetujui (streak 3), minggu 4 menunggu review pendamping
WITH pendamping AS (
  SELECT id FROM directus_users WHERE email = 'dummy_coach.pendamping@jabarprov.go.id' LIMIT 1
),
umkm AS (
  SELECT id FROM directus_users WHERE email = 'dummy_wawan.leathercraft@gmail.com' LIMIT 1
),
laporan_histori(minggu, target, realisasi, trx, kendala, cuuid, status, direview) AS (
  VALUES
    (1, 18000000::bigint, 19500000::bigint, 35, NULL, '55555555-5555-4555-8555-000000000001'::uuid, 'disetujui', TRUE),
    (2, 18000000::bigint, 18200000::bigint, 30, NULL, '55555555-5555-4555-8555-000000000002'::uuid, 'disetujui', TRUE),
    (3, 18000000::bigint, 21000000::bigint, 42, NULL, '55555555-5555-4555-8555-000000000003'::uuid, 'disetujui', TRUE),
    (4, 18000000::bigint, 20500000::bigint, 38, 'Permintaan pasar ekspor meningkat', '55555555-5555-4555-8555-000000000004'::uuid, 'menunggu', FALSE)
)
INSERT INTO kpi_laporan (
  peserta, minggu_ke, target, realisasi_omzet, jumlah_transaksi, kendala, client_uuid,
  status, direview_oleh, direview_at, dikirim_oleh
)
SELECT
  'd1000000-0000-4000-8000-000000000001'::uuid,
  h.minggu,
  h.target,
  h.realisasi,
  h.trx,
  h.kendala,
  h.cuuid,
  h.status,
  CASE WHEN h.direview THEN (SELECT id FROM pendamping) ELSE NULL END,
  CASE WHEN h.direview THEN NOW() - INTERVAL '14 days' ELSE NULL END,
  (SELECT id FROM umkm)
FROM laporan_histori h
ON CONFLICT (peserta, minggu_ke) DO NOTHING;

-- ── Y06: Referensi 27 Kabupaten/Kota + produk katalog dummy ───────────────
-- Tabel `kota` adalah sumber filter wilayah katalog publik (grant 20260926R). Wilayah dummy yang
-- sudah dipakai akun/usaha dinormalkan ke nama resmi lebih dulu, lalu 22 sisanya dilengkapi supaya
-- stack disposable benar-benar memuat 27 kabupaten/kota Jawa Barat.
UPDATE kota SET nama = 'Kabupaten Subang',   kode = 'dummy_3213' WHERE kode = 'dummy_kota_subang';
UPDATE kota SET nama = 'Kabupaten Sumedang', kode = 'dummy_3211' WHERE kode = 'dummy_kota_sumedang';
UPDATE kota SET nama = 'Kabupaten Garut',    kode = 'dummy_3205' WHERE kode = 'dummy_kota_garut';
UPDATE kota SET nama = 'Kota Cimahi',        kode = 'dummy_3277' WHERE kode = 'dummy_kota_cimahi';
UPDATE kota SET nama = 'Kabupaten Karawang', kode = 'dummy_3215' WHERE kode = 'dummy_kota_karawang';

WITH wilayah(kode, nama) AS (
  VALUES ('dummy_3201','Kabupaten Bogor'), ('dummy_3202','Kabupaten Sukabumi'), ('dummy_3203','Kabupaten Cianjur'),
         ('dummy_3204','Kabupaten Bandung'), ('dummy_3206','Kabupaten Tasikmalaya'), ('dummy_3207','Kabupaten Ciamis'),
         ('dummy_3208','Kabupaten Kuningan'), ('dummy_3209','Kabupaten Cirebon'), ('dummy_3210','Kabupaten Majalengka'),
         ('dummy_3212','Kabupaten Indramayu'), ('dummy_3214','Kabupaten Purwakarta'), ('dummy_3216','Kabupaten Bekasi'),
         ('dummy_3217','Kabupaten Bandung Barat'), ('dummy_3218','Kabupaten Pangandaran'),
         ('dummy_3271','Kota Bogor'), ('dummy_3272','Kota Sukabumi'), ('dummy_3273','Kota Bandung'),
         ('dummy_3274','Kota Cirebon'), ('dummy_3275','Kota Bekasi'), ('dummy_3276','Kota Depok'),
         ('dummy_3278','Kota Tasikmalaya'), ('dummy_3279','Kota Banjar')
), provinsi AS (
  SELECT id FROM provinsi WHERE lower(nama) = 'jawa barat' LIMIT 1
)
INSERT INTO kota (nama, kode, provinsi)
SELECT w.nama, w.kode, p.id
  FROM wilayah w CROSS JOIN provinsi p
 WHERE NOT EXISTS (SELECT 1 FROM kota k WHERE k.kode = w.kode);

-- Kontak penjualan terverifikasi, tahap talenta, PDN terverifikasi, dan satu sertifikat terbit:
-- bahan untuk badge, CTA WhatsApp, dan nomor legalitas di halaman detail.
UPDATE usaha
   SET nomor_whatsapp = '081200000005', talent_status = 'champion', pdn_terverifikasi = TRUE
 WHERE id = 'd0000000-0000-4000-8000-000000000005';

INSERT INTO usaha_legalitas (usaha, jenis, nomor, status, berlaku_hingga)
SELECT 'd0000000-0000-4000-8000-000000000005'::uuid, 'halal', 'ID3210000123456', 'terbit', '2030-01-01'::date
 WHERE NOT EXISTS (
   SELECT 1 FROM usaha_legalitas WHERE usaha = 'd0000000-0000-4000-8000-000000000005' AND jenis = 'halal'
 );

-- Satu produk tayang dan satu draft: gate Y06 memastikan hanya yang tayang yang muncul.
INSERT INTO produk (id, usaha, nama, deskripsi, kategori, kbli, harga_retail, harga_grosir, moq, dimensi, berat,
                    tkdn_persen, kapasitas_bulanan, lead_time, persen_bahan_lokal, pdn_deklarasi, status_kurasi)
VALUES
  ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', 'Keripik Nanas Subang Premium',
   'Keripik nanas dari kebun Subang, renyah tanpa pengawet.', 'makanan', '10794', 18000, 15000, 24,
   '20 x 15 x 6 cm', '250 g', 82.50, '4.000 pcs', '5 hari', 95.00, TRUE, 'tayang'),
  ('e1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000005', 'Keripik Nanas Subang Uji Coba',
   'Produk uji coba yang belum boleh tayang.', 'makanan', '10794', 17000, NULL, 12, NULL, NULL,
   NULL, NULL, NULL, NULL, FALSE, 'menunggu')
ON CONFLICT (id) DO UPDATE SET
  nama = EXCLUDED.nama, deskripsi = EXCLUDED.deskripsi, status_kurasi = EXCLUDED.status_kurasi,
  harga_retail = EXCLUDED.harga_retail, harga_grosir = EXCLUDED.harga_grosir, moq = EXCLUDED.moq,
  dimensi = EXCLUDED.dimensi, berat = EXCLUDED.berat, tkdn_persen = EXCLUDED.tkdn_persen,
  kapasitas_bulanan = EXCLUDED.kapasitas_bulanan, lead_time = EXCLUDED.lead_time;

-- ── Y07: Agenda kegiatan publik (status per hari relatif NOW(), jadi selalu segar) ─────────────
-- Lima kategori brief, tautan resmi, syarat skala/wilayah/NIB, materi setelah acara, dan satu baris
-- dibatalkan yang tidak boleh pernah tampil publik.
INSERT INTO kegiatan (id, judul, ringkasan, kategori, penyelenggara, kota_nama, metode, ramah_disabilitas,
                      tanggal_mulai, tanggal_selesai, batas_registrasi, lokasi, link, kuota, terisi,
                      silabus, narasumber, fasilitas, syarat, syarat_skala, syarat_wilayah, syarat_nib,
                      registration_url, dokumen_url, materi_url, status_publikasi)
VALUES
  ('f1000000-0000-4000-8000-000000000001', 'Pelatihan Pemasaran Digital UMKM',
   'Kelas daring pemasaran digital untuk pelaku UMKM Jawa Barat.', 'literasi_digital',
   'Dinas KUKM Provinsi Jawa Barat', NULL, 'daring', FALSE,
   NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', NULL, NULL,
   'https://streaming.example.invalid/pemasaran-digital', 100, 37,
   'Media sosial, marketplace, dan iklan berbayar.', 'Praktisi pemasaran digital',
   'Sertifikat dan modul digital', 'Mengikuti seluruh sesi daring.', 'Mikro, Kecil', 'Jawa Barat', FALSE,
   NULL, NULL, NULL, 'terbit'),
  ('f1000000-0000-4000-8000-000000000002', 'Sertifikasi Halal Gratis Gelombang 3',
   'Pendampingan berkas dan audit dapur untuk sertifikasi halal.', 'sertifikasi',
   'Dinas KUMKM Kabupaten Subang', 'Kabupaten Subang', 'luring', TRUE,
   NOW() + INTERVAL '10 days', NOW() + INTERVAL '12 days', NOW() + INTERVAL '8 days',
   'Aula Dinas KUMKM Kabupaten Subang', NULL, 50, 10,
   'Alur sertifikasi halal dan audit dapur.', 'BPJPH dan pendamping halal',
   'Pendampingan berkas dan sertifikat', 'Menyerahkan fotokopi NIB dan KTP.', 'Mikro, Kecil', 'Kabupaten Subang', TRUE,
   'https://daftar.example.invalid/halal-gelombang-3', 'https://dokumen.example.invalid/panduan-halal.pdf', NULL, 'terbit'),
  ('f1000000-0000-4000-8000-000000000003', 'Pameran Produk Unggulan Jawa Barat',
   'Pameran produk unggulan dengan calon pembeli regional.', 'pameran',
   'Dinas KUKM Provinsi Jawa Barat', 'Kota Bandung', 'luring', TRUE,
   NOW() + INTERVAL '20 days', NOW() + INTERVAL '22 days', NOW() + INTERVAL '18 days',
   'Gedung Sate, Bandung', NULL, 60, 12,
   NULL, NULL, 'Stan pameran dan materi promosi', 'Memiliki NIB dan produk siap jual.', 'Mikro, Kecil, Menengah', NULL, TRUE,
   NULL, NULL, NULL, 'terbit'),
  ('f1000000-0000-4000-8000-000000000004', 'Temu Bisnis Ekspor Rempah',
   'Pertemuan dengan pembeli ekspor untuk komoditas rempah.', 'akselerasi',
   'Kementerian/Lembaga', NULL, 'hybrid', FALSE,
   NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days', NOW() - INTERVAL '2 days', NULL, NULL, 40, 40,
   NULL, NULL, NULL, 'Peserta program akselerasi.', 'Kecil, Menengah', 'Jawa Barat', TRUE,
   NULL, NULL, NULL, 'terbit'),
  ('f1000000-0000-4000-8000-000000000005', 'Seminar Literasi Digital Batch 2',
   'Seminar daring literasi digital dan keamanan data usaha.', 'literasi_digital',
   'Mitra Kampus', NULL, 'daring', TRUE,
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', NULL, NULL, NULL, NULL, 0,
   NULL, NULL, NULL, NULL, NULL, NULL, FALSE,
   NULL, NULL, 'https://materi.example.invalid/seminar-literasi-batch-2', 'terbit'),
  ('f1000000-0000-4000-8000-000000000006', 'Pelatihan yang Dibatalkan Kurator',
   'Baris uji: ditarik dari publik setelah kurasi.', 'pelatihan',
   'Dinas KUKM Provinsi Jawa Barat', NULL, 'luring', FALSE,
   NOW() + INTERVAL '3 days', NOW() + INTERVAL '4 days', NULL, NULL, NULL, NULL, 0,
   NULL, NULL, NULL, NULL, NULL, NULL, FALSE,
   NULL, NULL, NULL, 'dibatalkan')
ON CONFLICT (id) DO UPDATE SET
  judul = EXCLUDED.judul, kategori = EXCLUDED.kategori, metode = EXCLUDED.metode,
  tanggal_mulai = EXCLUDED.tanggal_mulai, tanggal_selesai = EXCLUDED.tanggal_selesai,
  batas_registrasi = EXCLUDED.batas_registrasi, kuota = EXCLUDED.kuota, terisi = EXCLUDED.terisi,
  registration_url = EXCLUDED.registration_url, dokumen_url = EXCLUDED.dokumen_url,
  materi_url = EXCLUDED.materi_url, status_publikasi = EXCLUDED.status_publikasi,
  syarat_skala = EXCLUDED.syarat_skala, syarat_wilayah = EXCLUDED.syarat_wilayah, syarat_nib = EXCLUDED.syarat_nib;

COMMIT;


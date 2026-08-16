CREATE TEMP TABLE sidt_new ON COMMIT DROP AS
SELECT
  btrim(id_data_badan_usaha) AS sumber_id,
  CASE
    WHEN btrim(nik_pengusaha) ~ '^[0-9]{16}$' THEN btrim(nik_pengusaha)
    ELSE 'S' || substr(md5(btrim(id_data_badan_usaha)), 1, 15)
  END AS nik,
  COALESCE(NULLIF(left(btrim(nama_pengusaha), 255), ''), 'Tidak tersedia') AS nama_pengusaha,
  CASE WHEN lower(btrim(jenis_kelamin)) IN ('perempuan', 'wanita', 'female', 'f') THEN 'female' ELSE 'male' END AS jenis_kelamin,
  lower(btrim(is_disabilitas)) IN ('1', 'true', 'ya', 'yes') AS penyandang_disabilitas,
  CASE WHEN btrim(tanggal_lahir) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN btrim(tanggal_lahir)::date END AS birth_date,
  CASE
    WHEN lower(pendidikan_formal) LIKE '%s3%' OR lower(pendidikan_formal) LIKE '%doktor%' THEN 'doctorate'
    WHEN lower(pendidikan_formal) LIKE '%s2%' OR lower(pendidikan_formal) LIKE '%magister%' THEN 'master'
    WHEN lower(pendidikan_formal) LIKE '%s1%' OR lower(pendidikan_formal) LIKE '%sarjana%' THEN 'bachelor'
    WHEN lower(pendidikan_formal) LIKE '%diploma%' THEN 'diploma'
    WHEN lower(pendidikan_formal) LIKE '%sma%' OR lower(pendidikan_formal) LIKE '%smk%' OR lower(pendidikan_formal) LIKE '%paket c%' OR lower(pendidikan_formal) = 'ma' THEN 'senior_high'
    WHEN lower(pendidikan_formal) LIKE '%smp%' OR lower(pendidikan_formal) LIKE '%mts%' OR lower(pendidikan_formal) LIKE '%paket b%' THEN 'junior_high'
    WHEN lower(pendidikan_formal) LIKE '%sd%' OR lower(pendidikan_formal) = 'mi' THEN 'elementary'
    ELSE 'none'
  END AS tingkat_pendidikan,
  NULLIF(left(btrim(kontak_hp), 50), '') AS telepon,
  NULLIF(left(btrim(nib), 255), '') AS nib,
  COALESCE(NULLIF(left(btrim(nama_usaha), 255), ''), 'Tidak tersedia') AS nama_usaha,
  NULLIF(btrim(kegiatan_utama), '') AS kegiatan_utama,
  NULLIF(btrim(produk_utama), '') AS produk_utama,
  NULLIF(left(btrim(kode_kbli), 255), '') AS kode_kbli,
  COALESCE(NULLIF(left(btrim(kategori_kbli), 255), ''), 'Tidak tersedia') AS kategori_kbli,
  CASE
    WHEN lower(status_badan_usaha) LIKE '%perorangan%' OR lower(status_badan_usaha) LIKE '%perseorangan%' THEN 'sole_proprietorship'
    WHEN lower(status_badan_usaha) LIKE '%cv%' THEN 'cv'
    WHEN lower(status_badan_usaha) LIKE '%pt%' THEN 'pt'
    WHEN lower(status_badan_usaha) LIKE '%firma%' THEN 'firm'
    WHEN lower(status_badan_usaha) LIKE '%koperasi%' THEN 'cooperative'
    WHEN NULLIF(btrim(status_badan_usaha), '') IS NOT NULL THEN 'other'
  END AS status_hukum,
  CASE
    WHEN lower(skala_usaha) LIKE '%mikro%' THEN 'micro'
    WHEN lower(skala_usaha) LIKE '%kecil%' THEN 'small'
    WHEN lower(skala_usaha) LIKE '%menengah%' THEN 'medium'
  END AS skala,
  CASE WHEN btrim(modal_pendirian) ~ '^[0-9]{1,18}$' THEN btrim(modal_pendirian)::bigint END AS modal_pendirian,
  CASE WHEN btrim(bulan_mulai_operasi) ~ '^(1[0-2]|[1-9])$' THEN btrim(bulan_mulai_operasi)::smallint END AS bulan_mulai_operasi,
  CASE WHEN btrim(tahun_mulai_operasi) ~ '^[0-9]{1,4}$' THEN btrim(tahun_mulai_operasi)::smallint END AS tahun_mulai_operasi,
  CASE WHEN btrim(omzet_tahunan) ~ '^[0-9]{1,18}$' THEN btrim(omzet_tahunan)::bigint END AS omzet_tahunan,
  CASE WHEN btrim(asset) ~ '^[0-9]{1,18}$' THEN btrim(asset)::bigint END AS total_aset,
  COALESCE(NULLIF(left(btrim(prov_usaha), 255), ''), 'Tidak diketahui') AS provinsi,
  COALESCE(NULLIF(left(btrim(kab_usaha), 255), ''), 'Tidak diketahui') AS kota,
  COALESCE(NULLIF(left(btrim(kec_usaha), 255), ''), 'Tidak diketahui') AS kecamatan,
  COALESCE(NULLIF(left(btrim(kel_usaha), 255), ''), 'Tidak diketahui') AS kelurahan,
  NULLIF(btrim(alamat_usaha), '') AS alamat_jalan,
  NULLIF(left(btrim(rt_usaha), 10), '') AS rt,
  NULLIF(left(btrim(rw_usaha), 10), '') AS rw,
  NULLIF(left(btrim(foto_usaha), 255), '') AS foto,
  CASE WHEN btrim(alamat_latitude) ~ '^-?[0-9]+(\.[0-9]+)?$' AND btrim(alamat_latitude)::numeric BETWEEN -90 AND 90 THEN btrim(alamat_latitude)::numeric END AS latitude,
  CASE WHEN btrim(alamat_longitude) ~ '^-?[0-9]+(\.[0-9]+)?$' AND btrim(alamat_longitude)::numeric BETWEEN -180 AND 180 THEN btrim(alamat_longitude)::numeric END AS longitude,
  CASE WHEN btrim(tk_dibayar_laki) ~ '^[0-9]{1,9}$' THEN btrim(tk_dibayar_laki)::integer ELSE 0 END AS dibayar_laki_laki,
  CASE WHEN btrim(tk_dibayar_perempuan) ~ '^[0-9]{1,9}$' THEN btrim(tk_dibayar_perempuan)::integer ELSE 0 END AS dibayar_perempuan,
  CASE WHEN btrim(tk_dibayar_disabil_laki) ~ '^[0-9]{1,9}$' THEN btrim(tk_dibayar_disabil_laki)::integer ELSE 0 END AS disabilitas_dibayar_laki_laki,
  CASE WHEN btrim(tk_dibayar_disabil_perempuan) ~ '^[0-9]{1,9}$' THEN btrim(tk_dibayar_disabil_perempuan)::integer ELSE 0 END AS disabilitas_dibayar_perempuan,
  CASE WHEN btrim(tk_not_dibayar_laki) ~ '^[0-9]{1,9}$' THEN btrim(tk_not_dibayar_laki)::integer ELSE 0 END AS tidak_dibayar_laki_laki,
  CASE WHEN btrim(tk_not_dibayar_perempuan) ~ '^[0-9]{1,9}$' THEN btrim(tk_not_dibayar_perempuan)::integer ELSE 0 END AS tidak_dibayar_perempuan,
  CASE WHEN btrim(tk_not_dibayar_disabil_laki) ~ '^[0-9]{1,9}$' THEN btrim(tk_not_dibayar_disabil_laki)::integer ELSE 0 END AS disabilitas_tidak_dibayar_laki_laki,
  CASE WHEN btrim(tk_not_dibayar_disabil_perempua) ~ '^[0-9]{1,9}$' THEN btrim(tk_not_dibayar_disabil_perempua)::integer ELSE 0 END AS disabilitas_tidak_dibayar_perempuan,
  nextval(pg_get_serial_sequence('alamat', 'id')) AS alamat_id
FROM sidt_raw
WHERE btrim(id_data_badan_usaha) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM usaha
    WHERE usaha.sumber_id = btrim(sidt_raw.id_data_badan_usaha)
  );

ANALYZE sidt_new;

INSERT INTO provinsi (nama)
SELECT DISTINCT provinsi FROM sidt_new
ON CONFLICT (nama) DO NOTHING;

INSERT INTO kota (provinsi, nama)
SELECT DISTINCT provinsi.id, sidt_new.kota
FROM sidt_new
JOIN provinsi ON provinsi.nama = sidt_new.provinsi
ON CONFLICT (provinsi, nama) DO NOTHING;

INSERT INTO kecamatan (kota, nama)
SELECT DISTINCT kota.id, sidt_new.kecamatan
FROM sidt_new
JOIN provinsi ON provinsi.nama = sidt_new.provinsi
JOIN kota ON kota.provinsi = provinsi.id AND kota.nama = sidt_new.kota
ON CONFLICT (kota, nama) DO NOTHING;

INSERT INTO kelurahan (kecamatan, nama)
SELECT DISTINCT kecamatan.id, sidt_new.kelurahan
FROM sidt_new
JOIN provinsi ON provinsi.nama = sidt_new.provinsi
JOIN kota ON kota.provinsi = provinsi.id AND kota.nama = sidt_new.kota
JOIN kecamatan ON kecamatan.kota = kota.id AND kecamatan.nama = sidt_new.kecamatan
ON CONFLICT (kecamatan, nama) DO NOTHING;

INSERT INTO klasifikasi_usaha (kode, kategori)
SELECT DISTINCT kode_kbli, kategori_kbli
FROM sidt_new
WHERE kode_kbli IS NOT NULL
ON CONFLICT (kode) DO NOTHING;

INSERT INTO alamat (id, kelurahan, alamat_jalan, rt, rw)
SELECT sidt_new.alamat_id, kelurahan.id, sidt_new.alamat_jalan, sidt_new.rt, sidt_new.rw
FROM sidt_new
JOIN provinsi ON provinsi.nama = sidt_new.provinsi
JOIN kota ON kota.provinsi = provinsi.id AND kota.nama = sidt_new.kota
JOIN kecamatan ON kecamatan.kota = kota.id AND kecamatan.nama = sidt_new.kecamatan
JOIN kelurahan ON kelurahan.kecamatan = kecamatan.id AND kelurahan.nama = sidt_new.kelurahan;

INSERT INTO pelaku_usaha (
  nik, nama_lengkap, jenis_kelamin, penyandang_disabilitas, birth_date, tingkat_pendidikan, telepon
)
SELECT DISTINCT ON (nik)
  nik, nama_pengusaha, jenis_kelamin, penyandang_disabilitas, birth_date, tingkat_pendidikan, telepon
FROM sidt_new
ORDER BY nik, sumber_id
ON CONFLICT (nik) DO NOTHING;

INSERT INTO usaha (
  sumber_id, pelaku_usaha, nib, nama, kegiatan_utama, produk_utama, klasifikasi,
  status_hukum, skala, modal_pendirian, bulan_mulai_operasi, tahun_mulai_operasi,
  omzet_tahunan, total_aset, alamat, latitude, longitude, foto
)
SELECT
  sidt_new.sumber_id,
  pelaku_usaha.id,
  CASE
    WHEN sidt_new.nib IS NOT NULL
      AND row_number() OVER (PARTITION BY sidt_new.nib ORDER BY sidt_new.sumber_id) = 1
      AND NOT EXISTS (SELECT 1 FROM usaha WHERE usaha.nib = sidt_new.nib)
    THEN sidt_new.nib
  END,
  sidt_new.nama_usaha,
  sidt_new.kegiatan_utama,
  sidt_new.produk_utama,
  klasifikasi_usaha.id,
  sidt_new.status_hukum,
  sidt_new.skala,
  sidt_new.modal_pendirian,
  sidt_new.bulan_mulai_operasi,
  sidt_new.tahun_mulai_operasi,
  sidt_new.omzet_tahunan,
  sidt_new.total_aset,
  sidt_new.alamat_id,
  sidt_new.latitude,
  sidt_new.longitude,
  sidt_new.foto
FROM sidt_new
JOIN pelaku_usaha ON pelaku_usaha.nik = sidt_new.nik
LEFT JOIN klasifikasi_usaha ON klasifikasi_usaha.kode = sidt_new.kode_kbli
ON CONFLICT (sumber_id) DO NOTHING;

INSERT INTO statistik_tenaga_kerja (
  usaha, dibayar_laki_laki, dibayar_perempuan, disabilitas_dibayar_laki_laki,
  disabilitas_dibayar_perempuan, tidak_dibayar_laki_laki, tidak_dibayar_perempuan,
  disabilitas_tidak_dibayar_laki_laki, disabilitas_tidak_dibayar_perempuan
)
SELECT
  usaha.id,
  sidt_new.dibayar_laki_laki,
  sidt_new.dibayar_perempuan,
  sidt_new.disabilitas_dibayar_laki_laki,
  sidt_new.disabilitas_dibayar_perempuan,
  sidt_new.tidak_dibayar_laki_laki,
  sidt_new.tidak_dibayar_perempuan,
  sidt_new.disabilitas_tidak_dibayar_laki_laki,
  sidt_new.disabilitas_tidak_dibayar_perempuan
FROM sidt_new
JOIN usaha ON usaha.sumber_id = sidt_new.sumber_id
ON CONFLICT (usaha) DO NOTHING;

COMMIT;
\echo SIDT_BATCH_COMMITTED

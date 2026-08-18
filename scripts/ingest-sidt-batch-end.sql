CREATE TEMP FUNCTION sidt_parse_timestamptz(value TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' OR btrim(value) !~ 'T|[zZ]|[+-][0-9]{2}:[0-9]{2}' THEN
    RETURN NULL;
  END IF;
  RETURN btrim(value)::timestamptz;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE TEMP TABLE sidt_stage ON COMMIT DROP AS
SELECT
  btrim(r.id_data_badan_usaha) AS sumber_id,
  CASE WHEN btrim(r.nik_pengusaha) ~ '^[0-9]{16}$'
       THEN btrim(r.nik_pengusaha)
       ELSE 'S' || substr(md5(btrim(r.id_data_badan_usaha)), 1, 15) END AS nik,
  COALESCE(NULLIF(left(btrim(r.nama_pengusaha), 255), ''), 'Tidak tersedia') AS nama_pengusaha,
  CASE WHEN lower(btrim(r.jenis_kelamin)) IN ('perempuan','wanita','female','f') THEN 'female' ELSE 'male' END AS jenis_kelamin,
  lower(btrim(r.is_disabilitas)) IN ('1','true','ya','yes') AS penyandang_disabilitas,
  CASE WHEN btrim(r.tanggal_lahir) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN btrim(r.tanggal_lahir)::date END AS birth_date,
  CASE
    WHEN lower(r.pendidikan_formal) LIKE '%s3%' OR lower(r.pendidikan_formal) LIKE '%doktor%' THEN 'doctorate'
    WHEN lower(r.pendidikan_formal) LIKE '%s2%' OR lower(r.pendidikan_formal) LIKE '%magister%' THEN 'master'
    WHEN lower(r.pendidikan_formal) LIKE '%s1%' OR lower(r.pendidikan_formal) LIKE '%sarjana%' THEN 'bachelor'
    WHEN lower(r.pendidikan_formal) LIKE '%diploma%' THEN 'diploma'
    WHEN lower(r.pendidikan_formal) LIKE '%sma%' OR lower(r.pendidikan_formal) LIKE '%smk%' OR lower(r.pendidikan_formal) LIKE '%paket c%' OR lower(r.pendidikan_formal) = 'ma' THEN 'senior_high'
    WHEN lower(r.pendidikan_formal) LIKE '%smp%' OR lower(r.pendidikan_formal) LIKE '%mts%' OR lower(r.pendidikan_formal) LIKE '%paket b%' THEN 'junior_high'
    WHEN lower(r.pendidikan_formal) LIKE '%sd%' OR lower(r.pendidikan_formal) = 'mi' THEN 'elementary'
    ELSE 'none'
  END AS tingkat_pendidikan,
  NULLIF(left(btrim(r.kontak_hp), 50), '') AS telepon,
  NULLIF(left(btrim(r.nib), 255), '') AS nib_candidate,
  COALESCE(NULLIF(left(btrim(r.nama_usaha), 255), ''), 'Tidak tersedia') AS nama_usaha,
  NULLIF(btrim(r.kegiatan_utama), '') AS kegiatan_utama,
  NULLIF(btrim(r.produk_utama), '') AS produk_utama,
  NULLIF(left(btrim(r.kode_kbli), 255), '') AS kode_kbli,
  NULLIF(left(btrim(r.kategori_kbli), 255), '') AS kategori_kbli,
  CASE
    WHEN lower(r.status_badan_usaha) LIKE '%perorangan%' OR lower(r.status_badan_usaha) LIKE '%perseorangan%' THEN 'sole_proprietorship'
    WHEN lower(r.status_badan_usaha) LIKE '%cv%' THEN 'cv'
    WHEN lower(r.status_badan_usaha) LIKE '%pt%' THEN 'pt'
    WHEN lower(r.status_badan_usaha) LIKE '%firma%' THEN 'firm'
    WHEN lower(r.status_badan_usaha) LIKE '%koperasi%' THEN 'cooperative'
    WHEN NULLIF(btrim(r.status_badan_usaha), '') IS NOT NULL THEN 'other'
  END AS status_hukum,
  CASE WHEN lower(r.skala_usaha) LIKE '%mikro%' THEN 'micro' WHEN lower(r.skala_usaha) LIKE '%kecil%' THEN 'small' WHEN lower(r.skala_usaha) LIKE '%menengah%' THEN 'medium' END AS skala,
  CASE WHEN btrim(r.modal_pendirian) ~ '^[0-9]{1,18}$' THEN btrim(r.modal_pendirian)::bigint END AS modal_pendirian,
  CASE WHEN btrim(r.bulan_mulai_operasi) ~ '^(1[0-2]|[1-9])$' THEN btrim(r.bulan_mulai_operasi)::smallint END AS bulan_mulai_operasi,
  CASE WHEN btrim(r.tahun_mulai_operasi) ~ '^[0-9]{1,4}$' THEN btrim(r.tahun_mulai_operasi)::smallint END AS tahun_mulai_operasi,
  CASE WHEN btrim(r.omzet_tahunan) ~ '^[0-9]{1,18}$' THEN btrim(r.omzet_tahunan)::bigint END AS omzet_tahunan,
  CASE WHEN btrim(r.asset) ~ '^[0-9]{1,18}$' THEN btrim(r.asset)::bigint END AS total_aset,
  NULLIF(left(btrim(r.prov_usaha),255), '') AS provinsi,
  NULLIF(left(btrim(r.kab_usaha),255), '') AS kota,
  NULLIF(left(btrim(r.kec_usaha),255), '') AS kecamatan,
  NULLIF(left(btrim(r.kel_usaha),255), '') AS kelurahan,
  NULLIF(btrim(r.alamat_usaha), '') AS alamat_jalan,
  NULLIF(left(btrim(r.rt_usaha),10), '') AS rt,
  NULLIF(left(btrim(r.rw_usaha),10), '') AS rw,
  NULLIF(left(btrim(r.foto_usaha),255), '') AS foto,
  CASE WHEN btrim(r.alamat_latitude) ~ '^-?[0-9]+(\.[0-9]+)?$' AND btrim(r.alamat_latitude)::numeric BETWEEN -90 AND 90 THEN btrim(r.alamat_latitude)::numeric END AS latitude,
  CASE WHEN btrim(r.alamat_longitude) ~ '^-?[0-9]+(\.[0-9]+)?$' AND btrim(r.alamat_longitude)::numeric BETWEEN -180 AND 180 THEN btrim(r.alamat_longitude)::numeric END AS longitude,
  CASE WHEN btrim(r.tk_dibayar_laki) ~ '^[0-9]{1,9}$' THEN btrim(r.tk_dibayar_laki)::integer ELSE 0 END AS dibayar_laki_laki,
  CASE WHEN btrim(r.tk_dibayar_perempuan) ~ '^[0-9]{1,9}$' THEN btrim(r.tk_dibayar_perempuan)::integer ELSE 0 END AS dibayar_perempuan,
  CASE WHEN btrim(r.tk_dibayar_disabil_laki) ~ '^[0-9]{1,9}$' THEN btrim(r.tk_dibayar_disabil_laki)::integer ELSE 0 END AS disabilitas_dibayar_laki_laki,
  CASE WHEN btrim(r.tk_dibayar_disabil_perempuan) ~ '^[0-9]{1,9}$' THEN btrim(r.tk_dibayar_disabil_perempuan)::integer ELSE 0 END AS disabilitas_dibayar_perempuan,
  CASE WHEN btrim(r.tk_not_dibayar_laki) ~ '^[0-9]{1,9}$' THEN btrim(r.tk_not_dibayar_laki)::integer ELSE 0 END AS tidak_dibayar_laki_laki,
  CASE WHEN btrim(r.tk_not_dibayar_perempuan) ~ '^[0-9]{1,9}$' THEN btrim(r.tk_not_dibayar_perempuan)::integer ELSE 0 END AS tidak_dibayar_perempuan,
  CASE WHEN btrim(r.tk_not_dibayar_disabil_laki) ~ '^[0-9]{1,9}$' THEN btrim(r.tk_not_dibayar_disabil_laki)::integer ELSE 0 END AS disabilitas_tidak_dibayar_laki_laki,
  CASE WHEN btrim(r.tk_not_dibayar_disabil_perempua) ~ '^[0-9]{1,9}$' THEN btrim(r.tk_not_dibayar_disabil_perempua)::integer ELSE 0 END AS disabilitas_tidak_dibayar_perempuan,
  sidt_parse_timestamptz(r.pulled_at) AS source_pulled_at,
  sidt_parse_timestamptz(r.updated_at) AS source_updated_at,
  encode(digest(convert_to(to_jsonb(r)::text, 'UTF8'), 'sha256'), 'hex') AS source_hash,
  COALESCE((SELECT u.alamat FROM usaha u WHERE u.sumber_id = btrim(r.id_data_badan_usaha)), nextval(pg_get_serial_sequence('alamat','id'))) AS alamat_id
FROM sidt_raw r
WHERE NULLIF(btrim(r.id_data_badan_usaha), '') IS NOT NULL;

ANALYZE sidt_stage;

INSERT INTO provinsi (nama)
SELECT DISTINCT provinsi FROM sidt_stage WHERE provinsi IS NOT NULL
ON CONFLICT (nama) DO NOTHING;
INSERT INTO kota (provinsi, nama)
SELECT DISTINCT p.id, s.kota FROM sidt_stage s JOIN provinsi p ON p.nama=s.provinsi
WHERE s.kota IS NOT NULL ON CONFLICT (provinsi,nama) DO NOTHING;
INSERT INTO kecamatan (kota, nama)
SELECT DISTINCT k.id, s.kecamatan FROM sidt_stage s JOIN provinsi p ON p.nama=s.provinsi JOIN kota k ON k.provinsi=p.id AND k.nama=s.kota
WHERE s.kecamatan IS NOT NULL ON CONFLICT (kota,nama) DO NOTHING;
INSERT INTO kelurahan (kecamatan, nama)
SELECT DISTINCT c.id, s.kelurahan FROM sidt_stage s JOIN provinsi p ON p.nama=s.provinsi JOIN kota k ON k.provinsi=p.id AND k.nama=s.kota JOIN kecamatan c ON c.kota=k.id AND c.nama=s.kecamatan
WHERE s.kelurahan IS NOT NULL ON CONFLICT (kecamatan,nama) DO NOTHING;
INSERT INTO klasifikasi_usaha (kode, kategori)
SELECT DISTINCT kode_kbli, COALESCE(kategori_kbli,'Tidak diketahui') FROM sidt_stage WHERE kode_kbli IS NOT NULL
ON CONFLICT (kode) DO UPDATE SET kategori=EXCLUDED.kategori WHERE klasifikasi_usaha.kategori IS DISTINCT FROM EXCLUDED.kategori;

INSERT INTO alamat (id, kelurahan, alamat_jalan, rt, rw)
SELECT s.alamat_id, l.id, s.alamat_jalan, s.rt, s.rw
FROM sidt_stage s
LEFT JOIN provinsi p ON p.nama=s.provinsi
LEFT JOIN kota k ON k.provinsi=p.id AND k.nama=s.kota
LEFT JOIN kecamatan c ON c.kota=k.id AND c.nama=s.kecamatan
LEFT JOIN kelurahan l ON l.kecamatan=c.id AND l.nama=s.kelurahan
ON CONFLICT (id) DO UPDATE SET kelurahan=EXCLUDED.kelurahan, alamat_jalan=EXCLUDED.alamat_jalan, rt=EXCLUDED.rt, rw=EXCLUDED.rw
WHERE (alamat.kelurahan, alamat.alamat_jalan, alamat.rt, alamat.rw) IS DISTINCT FROM (EXCLUDED.kelurahan, EXCLUDED.alamat_jalan, EXCLUDED.rt, EXCLUDED.rw);

INSERT INTO pelaku_usaha (nik, nama_lengkap, jenis_kelamin, penyandang_disabilitas, birth_date, tingkat_pendidikan, telepon)
SELECT DISTINCT ON (nik) nik, nama_pengusaha, jenis_kelamin, penyandang_disabilitas, birth_date, tingkat_pendidikan, telepon
FROM sidt_stage ORDER BY nik, source_updated_at DESC NULLS LAST, source_pulled_at DESC NULLS LAST, sumber_id
ON CONFLICT (nik) DO UPDATE SET
  nama_lengkap=EXCLUDED.nama_lengkap, jenis_kelamin=EXCLUDED.jenis_kelamin,
  penyandang_disabilitas=EXCLUDED.penyandang_disabilitas, birth_date=EXCLUDED.birth_date,
  tingkat_pendidikan=EXCLUDED.tingkat_pendidikan, telepon=EXCLUDED.telepon,
  date_updated=NOW()
WHERE (pelaku_usaha.nama_lengkap, pelaku_usaha.jenis_kelamin, pelaku_usaha.penyandang_disabilitas, pelaku_usaha.birth_date, pelaku_usaha.tingkat_pendidikan, pelaku_usaha.telepon)
  IS DISTINCT FROM (EXCLUDED.nama_lengkap, EXCLUDED.jenis_kelamin, EXCLUDED.penyandang_disabilitas, EXCLUDED.birth_date, EXCLUDED.tingkat_pendidikan, EXCLUDED.telepon);

WITH eligible AS (
  SELECT s.*,
    CASE WHEN s.nib_candidate IS NOT NULL
      AND COUNT(*) OVER (PARTITION BY s.nib_candidate) = 1
      AND NOT EXISTS (SELECT 1 FROM usaha old WHERE old.nib=s.nib_candidate AND old.sumber_id IS DISTINCT FROM s.sumber_id)
      THEN s.nib_candidate END AS safe_nib
  FROM sidt_stage s
)
INSERT INTO usaha (
  sumber_id, pelaku_usaha, nib, nama, kegiatan_utama, produk_utama, klasifikasi,
  status_hukum, skala, modal_pendirian, bulan_mulai_operasi, tahun_mulai_operasi,
  omzet_tahunan, total_aset, alamat, latitude, longitude, foto, status,
  source_pulled_at, source_updated_at, source_hash
)
SELECT e.sumber_id, owner.id, e.safe_nib, e.nama_usaha, e.kegiatan_utama, e.produk_utama, k.id,
  e.status_hukum, e.skala, e.modal_pendirian, e.bulan_mulai_operasi, e.tahun_mulai_operasi,
  e.omzet_tahunan, e.total_aset, e.alamat_id, e.latitude, e.longitude, e.foto, 'active',
  e.source_pulled_at, e.source_updated_at, e.source_hash
FROM eligible e
JOIN pelaku_usaha owner ON owner.nik=e.nik
LEFT JOIN klasifikasi_usaha k ON k.kode=e.kode_kbli
ON CONFLICT (sumber_id) DO UPDATE SET
  pelaku_usaha=EXCLUDED.pelaku_usaha, nib=EXCLUDED.nib, nama=EXCLUDED.nama,
  kegiatan_utama=EXCLUDED.kegiatan_utama, produk_utama=EXCLUDED.produk_utama,
  klasifikasi=EXCLUDED.klasifikasi, status_hukum=EXCLUDED.status_hukum, skala=EXCLUDED.skala,
  modal_pendirian=EXCLUDED.modal_pendirian, bulan_mulai_operasi=EXCLUDED.bulan_mulai_operasi,
  tahun_mulai_operasi=EXCLUDED.tahun_mulai_operasi, omzet_tahunan=EXCLUDED.omzet_tahunan,
  total_aset=EXCLUDED.total_aset, alamat=EXCLUDED.alamat, latitude=EXCLUDED.latitude,
  longitude=EXCLUDED.longitude, foto=EXCLUDED.foto, source_pulled_at=EXCLUDED.source_pulled_at,
  source_updated_at=EXCLUDED.source_updated_at, source_hash=EXCLUDED.source_hash, date_updated=NOW()
WHERE usaha.source_hash IS DISTINCT FROM EXCLUDED.source_hash
  AND (CASE
    WHEN EXCLUDED.source_updated_at IS NOT NULL THEN usaha.source_updated_at IS NULL OR EXCLUDED.source_updated_at >= usaha.source_updated_at
    WHEN EXCLUDED.source_pulled_at IS NOT NULL THEN usaha.source_updated_at IS NULL AND (usaha.source_pulled_at IS NULL OR EXCLUDED.source_pulled_at >= usaha.source_pulled_at)
    ELSE usaha.source_updated_at IS NULL AND usaha.source_pulled_at IS NULL
  END);

INSERT INTO statistik_tenaga_kerja (usaha, dibayar_laki_laki, dibayar_perempuan, disabilitas_dibayar_laki_laki, disabilitas_dibayar_perempuan, tidak_dibayar_laki_laki, tidak_dibayar_perempuan, disabilitas_tidak_dibayar_laki_laki, disabilitas_tidak_dibayar_perempuan)
SELECT u.id, s.dibayar_laki_laki, s.dibayar_perempuan, s.disabilitas_dibayar_laki_laki, s.disabilitas_dibayar_perempuan, s.tidak_dibayar_laki_laki, s.tidak_dibayar_perempuan, s.disabilitas_tidak_dibayar_laki_laki, s.disabilitas_tidak_dibayar_perempuan
FROM sidt_stage s JOIN usaha u ON u.sumber_id=s.sumber_id
ON CONFLICT (usaha) DO UPDATE SET
  dibayar_laki_laki=EXCLUDED.dibayar_laki_laki, dibayar_perempuan=EXCLUDED.dibayar_perempuan,
  disabilitas_dibayar_laki_laki=EXCLUDED.disabilitas_dibayar_laki_laki,
  disabilitas_dibayar_perempuan=EXCLUDED.disabilitas_dibayar_perempuan,
  tidak_dibayar_laki_laki=EXCLUDED.tidak_dibayar_laki_laki,
  tidak_dibayar_perempuan=EXCLUDED.tidak_dibayar_perempuan,
  disabilitas_tidak_dibayar_laki_laki=EXCLUDED.disabilitas_tidak_dibayar_laki_laki,
  disabilitas_tidak_dibayar_perempuan=EXCLUDED.disabilitas_tidak_dibayar_perempuan,
  date_updated=NOW();

COMMIT;
\echo SIDT_BATCH_COMMITTED

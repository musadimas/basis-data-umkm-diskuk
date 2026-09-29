// R03 (N7-01…N7-03): pendaftaran internal kegiatan, e-pass/presensi/sertifikat,
// dan delapan kartu fasilitasi bantuan. Y07 tetap sumber agenda publik; tabel ini
// hanya menambah pendaftaran internal tanpa mengubah sejarah event eksternal.
const BENTUK_BANTUAN = [
  ["penghargaan", "Pemberian Penghargaan"],
  ["beasiswa", "Pemberian Beasiswa"],
  ["operasional", "Bantuan Operasional"],
  ["sarpras_produksi", "Bantuan Sarpras Produksi"],
  ["sarpras_pemasaran", "Bantuan Sarpras Pemasaran"],
  ["revitalisasi_gedung", "Bantuan Revitalisasi/Pembangunan Gedung"],
  ["permodalan", "Bantuan Permodalan/Pembiayaan"],
  ["lainnya", "Bantuan Pemerintah Lainnya"],
];

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await trx.raw(`
      ALTER TABLE kegiatan
        ADD COLUMN IF NOT EXISTS pendaftaran_internal BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS butuh_pakta_integritas BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS jumlah_sesi SMALLINT NOT NULL DEFAULT 1
          CHECK (jumlah_sesi BETWEEN 1 AND 60),
        ADD COLUMN IF NOT EXISTS butuh_tugas BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS kegiatan_pendaftaran (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kegiatan UUID NOT NULL REFERENCES kegiatan(id) ON DELETE CASCADE,
        usaha UUID NOT NULL REFERENCES usaha(id) ON DELETE CASCADE,
        pendaftar UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'menunggu'
          CHECK (status IN ('menunggu', 'diterima', 'ditolak', 'daftar_tunggu', 'batal')),
        skor_talent NUMERIC(5,2),
        skor_rubrik VARCHAR(32),
        administrasi_lolos BOOLEAN NOT NULL DEFAULT FALSE,
        butuh_disabilitas BOOLEAN NOT NULL DEFAULT FALSE,
        kebutuhan_aksesibilitas VARCHAR(500),
        pakta_integritas BOOLEAN NOT NULL DEFAULT FALSE,
        consent BOOLEAN NOT NULL DEFAULT FALSE,
        alasan TEXT,
        diputuskan_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        diputuskan_pada TIMESTAMPTZ,
        epass_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        tugas_selesai BOOLEAN NOT NULL DEFAULT FALSE,
        tugas_dinilai_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        tugas_dinilai_pada TIMESTAMPTZ,
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT kegiatan_pendaftaran_skor_range
          CHECK (skor_talent IS NULL OR (skor_talent BETWEEN 0 AND 100))
      );
    `);
    await trx.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_kegiatan_pendaftaran_aktif
        ON kegiatan_pendaftaran (kegiatan, usaha)
        WHERE status IN ('menunggu', 'diterima', 'daftar_tunggu');
      CREATE INDEX IF NOT EXISTS idx_kegiatan_pendaftaran_kegiatan
        ON kegiatan_pendaftaran (kegiatan, status, date_created);
      CREATE INDEX IF NOT EXISTS idx_kegiatan_pendaftaran_usaha
        ON kegiatan_pendaftaran (usaha);
    `);
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS kegiatan_presensi (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pendaftaran UUID NOT NULL REFERENCES kegiatan_pendaftaran(id) ON DELETE CASCADE,
        sesi_ke SMALLINT NOT NULL CHECK (sesi_ke BETWEEN 1 AND 60),
        hadir BOOLEAN NOT NULL DEFAULT TRUE,
        dipindai_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        dipindai_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (pendaftaran, sesi_ke)
      );
      CREATE INDEX IF NOT EXISTS idx_kegiatan_presensi_pendaftaran
        ON kegiatan_presensi (pendaftaran);
      CREATE TABLE IF NOT EXISTS kegiatan_keputusan_audit (
        id BIGSERIAL PRIMARY KEY,
        pendaftaran UUID NOT NULL REFERENCES kegiatan_pendaftaran(id) ON DELETE CASCADE,
        status_dari TEXT,
        status_ke TEXT NOT NULL,
        skor_talent NUMERIC(5,2),
        skor_rubrik VARCHAR(32),
        alasan TEXT,
        diputuskan_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        diputuskan_pada TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_kegiatan_keputusan_pendaftaran
        ON kegiatan_keputusan_audit (pendaftaran, diputuskan_pada DESC);
    `);
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS kegiatan_sertifikat (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pendaftaran UUID NOT NULL REFERENCES kegiatan_pendaftaran(id) ON DELETE CASCADE,
        kode VARCHAR(32) NOT NULL UNIQUE,
        payload_hash VARCHAR(128) NOT NULL,
        signature VARCHAR(256) NOT NULL,
        kid VARCHAR(64),
        status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'dicabut')),
        diterbitkan_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        diterbitkan_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        dicabut_pada TIMESTAMPTZ,
        sumber_indikator VARCHAR(64) NOT NULL DEFAULT 'kegiatan_sertifikat',
        versi_indikator INTEGER NOT NULL DEFAULT 1
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ux_kegiatan_sertifikat_aktif
        ON kegiatan_sertifikat (pendaftaran) WHERE status = 'aktif';
      CREATE INDEX IF NOT EXISTS idx_kegiatan_sertifikat_kode
        ON kegiatan_sertifikat (kode);
    `);
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS kegiatan_sertifikat_dampak (
        sertifikat UUID PRIMARY KEY REFERENCES kegiatan_sertifikat(id) ON DELETE CASCADE,
        usaha UUID NOT NULL REFERENCES usaha(id) ON DELETE CASCADE,
        atribut VARCHAR(64) NOT NULL DEFAULT 'bukti_pelatihan_manajemen',
        capaian VARCHAR(64) NOT NULL DEFAULT 'peningkatan_kapasitas_sdm',
        aktif BOOLEAN NOT NULL DEFAULT TRUE,
        sumber VARCHAR(64) NOT NULL DEFAULT 'kegiatan_sertifikat',
        versi INTEGER NOT NULL DEFAULT 1,
        diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_kegiatan_sertifikat_dampak_usaha
        ON kegiatan_sertifikat_dampak (usaha, aktif);
    `);
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS bantuan_fasilitasi (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bentuk TEXT NOT NULL CHECK (bentuk IN
          ('penghargaan','beasiswa','operasional','sarpras_produksi','sarpras_pemasaran',
           'revitalisasi_gedung','permodalan','lainnya')),
        judul VARCHAR(200) NOT NULL,
        ringkasan TEXT,
        bentuk_bantuan TEXT NOT NULL DEFAULT 'jasa'
          CHECK (bentuk_bantuan IN ('uang','barang','jasa')),
        kuota INTEGER CHECK (kuota IS NULL OR kuota >= 0),
        terisi INTEGER NOT NULL DEFAULT 0 CHECK (terisi >= 0),
        pendaftaran_mulai TIMESTAMPTZ,
        pendaftaran_selesai TIMESTAMPTZ,
        petunjuk TEXT,
        kanal_resmi VARCHAR(500),
        status_publikasi TEXT NOT NULL DEFAULT 'draft'
          CHECK (status_publikasi IN ('draft','terbit','arsip')),
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await trx.raw(`
      CREATE INDEX IF NOT EXISTS idx_bantuan_fasilitasi_publik
        ON bantuan_fasilitasi (status_publikasi, bentuk, bentuk_bantuan);
    `);
    for (const pair of BENTUK_BANTUAN) {
      await trx.raw(
        `INSERT INTO bantuan_fasilitasi (bentuk, judul, ringkasan, bentuk_bantuan, petunjuk, status_publikasi)
          SELECT ?, ?, 'Menunggu kurasi dinas.', 'jasa', 'Lihat kanal resmi dinas.', 'draft'
           WHERE NOT EXISTS (SELECT 1 FROM bantuan_fasilitasi WHERE bentuk = ?)`,
        [pair[0], pair[1] + ' - menunggu kurasi', pair[0]]
      );
    }
    await trx.raw(`
      INSERT INTO directus_collections
        (collection, icon, note, display_template, hidden, singleton,
         translations, archive_field, archive_app_filter, archive_value,
         unarchive_value, sort_field, accountability, color,
         item_duplication_fields, sort, "group", collapse, preview_url, versioning)
      VALUES
        ('kegiatan_pendaftaran', 'how_to_reg', 'Pendaftaran internal kegiatan', '{{status}}', FALSE, FALSE,
          NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE),
        ('bantuan_fasilitasi', 'volunteer_activism', 'Fasilitasi bantuan', '{{judul}}', FALSE, FALSE,
          NULL, NULL, TRUE, NULL, NULL, NULL, 'all', NULL, NULL, NULL, NULL, 'open', NULL, FALSE)
      ON CONFLICT (collection) DO NOTHING;
    `);
    await trx.raw(`
      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field,
         one_collection_field, one_allowed_collections, junction_field,
         sort_field, one_deselect_action)
      VALUES
        ('kegiatan_pendaftaran', 'kegiatan', 'kegiatan', NULL, NULL, NULL, NULL, NULL, 'cascade'),
        ('kegiatan_pendaftaran', 'usaha', 'usaha', NULL, NULL, NULL, NULL, NULL, 'cascade')
      ON CONFLICT DO NOTHING;
    `);
  });
};
export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`DELETE FROM directus_relations WHERE many_collection IN ('kegiatan_pendaftaran');`);
    await trx.raw(`DELETE FROM directus_collections WHERE collection IN ('kegiatan_pendaftaran','bantuan_fasilitasi');`);
    await trx.raw(`DROP TABLE IF EXISTS bantuan_fasilitasi;`);
    await trx.raw(`DROP TABLE IF EXISTS kegiatan_sertifikat_dampak;`);
    await trx.raw(`DROP TABLE IF EXISTS kegiatan_sertifikat;`);
    await trx.raw(`DROP TABLE IF EXISTS kegiatan_keputusan_audit;`);
    await trx.raw(`DROP TABLE IF EXISTS kegiatan_presensi;`);
    await trx.raw(`DROP TABLE IF EXISTS kegiatan_pendaftaran;`);
    await trx.raw(`ALTER TABLE kegiatan DROP COLUMN IF EXISTS butuh_tugas;`);
    await trx.raw(`ALTER TABLE kegiatan DROP COLUMN IF EXISTS jumlah_sesi;`);
    await trx.raw(`ALTER TABLE kegiatan DROP COLUMN IF EXISTS butuh_pakta_integritas;`);
    await trx.raw(`ALTER TABLE kegiatan DROP COLUMN IF EXISTS pendaftaran_internal;`);
  });
};

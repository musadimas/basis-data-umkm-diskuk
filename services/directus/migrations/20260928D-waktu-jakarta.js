/**
 * Tanggal bisnis memakai zona Asia/Jakarta, bukan `CURRENT_DATE` yang mengikuti zona sesi
 * (UTC di produksi). Pada 00:00-07:00 WIB, CURRENT_DATE masih kemarin sehingga sertifikat yang
 * kedaluwarsa hari ini masih dianggap terbit, dan Berita Acara bertanggal kemarin (B22).
 *
 * - `produk_usaha_snapshot()` didefinisikan ulang dengan `(now() AT TIME ZONE 'Asia/Jakarta')::date`
 *   (definisi sebelumnya dari 20260926R memakai CURRENT_DATE).
 * - Default `talent_berita_acara.tanggal` diganti ke tanggal Jakarta.
 *
 * Migrasi lama tidak diubah karena mungkin sudah berjalan di environment lain.
 */
const SNAPSHOT_HEAD = `
      CREATE OR REPLACE FUNCTION produk_usaha_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        SELECT u.nama, u.nib, u.skala, u.talent_status, u.pdn_terverifikasi, u.ramah_disabilitas, u.nomor_whatsapp,
               ko.id, ko.nama,
               COALESCE((SELECT ',' || string_agg(DISTINCT l.jenis, ',' ORDER BY l.jenis) || ','
                           FROM usaha_legalitas l
                          WHERE l.usaha = u.id AND l.status = 'terbit'
                            AND (l.berlaku_hingga IS NULL OR l.berlaku_hingga >= {{TANGGAL}})), ''),
               COALESCE((SELECT jsonb_agg(jsonb_build_object('jenis', l.jenis, 'nomor', l.nomor,
                                                            'berlakuHingga', l.berlaku_hingga) ORDER BY l.jenis)
                           FROM usaha_legalitas l
                          WHERE l.usaha = u.id AND l.status = 'terbit'
                            AND (l.berlaku_hingga IS NULL OR l.berlaku_hingga >= {{TANGGAL}})), '[]'::jsonb)
          INTO NEW.usaha_nama, NEW.usaha_nib, NEW.usaha_skala, NEW.usaha_talent_status, NEW.usaha_pdn,
               NEW.usaha_ramah_disabilitas, NEW.usaha_whatsapp, NEW.usaha_kota, NEW.usaha_kota_nama,
               NEW.usaha_sertifikasi, NEW.usaha_legalitas
          FROM usaha u
          LEFT JOIN alamat a     ON a.id = u.alamat
          LEFT JOIN kelurahan kl ON kl.id = a.kelurahan
          LEFT JOIN kecamatan kc ON kc.id = kl.kecamatan
          LEFT JOIN kota ko      ON ko.id = kc.kota
         WHERE u.id = NEW.usaha;
        RETURN NEW;
      END $$;
`;

const JAKARTA = "(now() AT TIME ZONE 'Asia/Jakarta')::date";
const UTC = "CURRENT_DATE";
const snapshotSql = (tanggal) => SNAPSHOT_HEAD.replaceAll("{{TANGGAL}}", tanggal);

export const up = async (knex) => {
  await knex.raw(snapshotSql(JAKARTA));
  await knex.raw(`ALTER TABLE talent_berita_acara ALTER COLUMN tanggal SET DEFAULT ${JAKARTA}`);
};

export const down = async (knex) => {
  await knex.raw(snapshotSql(UTC));
  await knex.raw(`ALTER TABLE talent_berita_acara ALTER COLUMN tanggal SET DEFAULT ${UTC}`);
};

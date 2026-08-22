// Tambah kolom kategori_bps ke klasifikasi_usha: nama kategori resmi BPS dalam
// Bahasa Indonesia (sumber: kategori.md, sesuai KBLI 2020 BPS). Kolom kategori lama
// dari SIDT dibiarkan utuh agar tidak menghapus data historis.

const BPS_CATEGORY_RULE = `
  CASE
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '01' AND '03'
      THEN 'Pertanian, Kehutanan, dan Perikanan'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '05' AND '09'
      THEN 'Pertambangan dan Penggalian'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '10' AND '33'
      THEN 'Industri Pengolahan'
    WHEN SUBSTRING(kode FROM 1 FOR 2) = '35'
      THEN 'Pengadaan Listrik, Gas, Uap/Air Panas, dan Udara Dingin'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '36' AND '39'
      THEN 'Pengelolaan Air, Pengelolaan Air Limbah, Pengelolaan dan Daur Ulang Sampah, serta Aktivitas Remediasi'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '41' AND '43'
      THEN 'Konstruksi'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '45' AND '47'
      THEN 'Perdagangan Besar dan Eceran; Reparasi dan Perawatan Mobil dan Sepeda Motor'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '49' AND '53'
      THEN 'Pengangkutan dan Pergudangan'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '55' AND '56'
      THEN 'Penyediaan Akomodasi dan Penyediaan Makan Minum'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '58' AND '63'
      THEN 'Informasi dan Komunikasi'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '64' AND '66'
      THEN 'Aktivitas Keuangan dan Asuransi'
    WHEN SUBSTRING(kode FROM 1 FOR 2) = '68'
      THEN 'Real Estat'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '69' AND '75'
      THEN 'Aktivitas Profesional, Ilmiah, dan Teknis'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '77' AND '82'
      THEN 'Aktivitas Penyewaan dan Sewa Guna Usaha Tanpa Hak Opsi, Ketenagakerjaan, Agen Perjalanan, dan Penunjang Usaha Lainnya'
    WHEN SUBSTRING(kode FROM 1 FOR 2) = '84'
      THEN 'Administrasi Pemerintahan, Pertahanan, dan Jaminan Sosial Wajib'
    WHEN SUBSTRING(kode FROM 1 FOR 2) = '85'
      THEN 'Pendidikan'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '86' AND '88'
      THEN 'Aktivitas Kesehatan Manusia dan Aktivitas Sosial'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '90' AND '93'
      THEN 'Kesenian, Hiburan, dan Rekreasi'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '94' AND '96'
      THEN 'Aktivitas Jasa Lainnya'
    WHEN SUBSTRING(kode FROM 1 FOR 2) BETWEEN '97' AND '98'
      THEN 'Aktivitas Rumah Tangga sebagai Pemberi Kerja; Aktivitas yang Menghasilkan Barang dan Jasa oleh Rumah Tangga yang Digunakan untuk Memenuhi Kebutuhan Sendiri'
    WHEN SUBSTRING(kode FROM 1 FOR 2) = '99'
      THEN 'Aktivitas Badan Internasional dan Badan Ekstra Internasional Lainnya'
    ELSE NULL
  END`;

export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE klasifikasi_usaha
      ADD COLUMN IF NOT EXISTS kategori_bps VARCHAR(255);
  `);
  const result = await knex.raw(`
    UPDATE klasifikasi_usaha
       SET kategori_bps = ${BPS_CATEGORY_RULE};
    SELECT COUNT(*) AS updated, COUNT(kategori_bps) AS filled, COUNT(*) FILTER (WHERE kategori_bps IS NULL) AS null_value
      FROM klasifikasi_usaha;
  `);
  console.log(
    `kategori-bps: ${result.rows?.[1]?.filled ?? "?"}/${result.rows?.[1]?.updated ?? "?"} rows filled, ${result.rows?.[1]?.null_value ?? "?"} unmapped`,
  );
};

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE klasifikasi_usaha DROP COLUMN IF EXISTS kategori_bps;
  `);
};

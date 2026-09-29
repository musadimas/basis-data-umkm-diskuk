/**
 * B02(c): job ekspor agregat lama yang melebihi budget filter dibatalkan saat deploy.
 *
 * Job kabkota yang dibuat sebelum `5088ac5` menyimpan config **ter-scope**: 8 filter pengguna
 * ditambah `kota_id` dari scope = 9 filter. Worker kini melempar error untuk config seperti itu
 * (B02 (b)), sehingga tanpa migrasi ini job lama hanya akan gagal setelah diklaim dan muncul
 * sebagai kegagalan pengguna. Budget >8 filter tidak pernah sah, jadi baris `queued`/`retry`
 * dibatalkan dengan penanda `error_code='EXPORT_BUDGET'` yang dipakai `down` untuk memulihkan.
 */
const BATAS_FILTER = 8;

export const up = async (knex) => {
  await knex.raw(`
    UPDATE analitik_job
       SET status='cancelled',
           error_code='EXPORT_BUDGET',
           error_message='Dibatalkan saat deploy: filter ter-scope melebihi budget ekspor',
           updated_at=NOW()
     WHERE job_type='export'
       AND status IN ('queued','retry')
       AND jsonb_array_length(COALESCE(request->'config'->'filters','[]'::jsonb)) > ${BATAS_FILTER}
  `);
};

export const down = async (knex) => {
  await knex.raw(`
    UPDATE analitik_job
       SET status='queued', error_code=NULL, error_message=NULL, updated_at=NOW()
     WHERE job_type='export'
       AND status='cancelled'
       AND error_code='EXPORT_BUDGET'
  `);
};

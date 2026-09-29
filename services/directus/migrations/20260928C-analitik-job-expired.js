/**
 * `expired` sudah dipakai kode cleanup (worker `cleanupExpiredExports` dan cleanup Tabular di
 * endpoint), tetapi CHECK constraint `analitik_job.status` belum mengizinkannya sehingga
 * cleanup selalu gagal dengan 23514. Tambahkan nilai itu; `down` memindahkan baris `expired`
 * ke `cancelled` lebih dulu supaya rollback tidak tersangkut data.
 */
export const up = async (knex) => {
  await knex.raw("ALTER TABLE analitik_job DROP CONSTRAINT IF EXISTS analitik_job_status_check");
  await knex.raw(`ALTER TABLE analitik_job ADD CONSTRAINT analitik_job_status_check
    CHECK (status IN ('queued','processing','retry','completed','dead','cancelled','expired'))`);
};

export const down = async (knex) => {
  await knex.raw("UPDATE analitik_job SET status='cancelled' WHERE status='expired'");
  await knex.raw("ALTER TABLE analitik_job DROP CONSTRAINT IF EXISTS analitik_job_status_check");
  await knex.raw(`ALTER TABLE analitik_job ADD CONSTRAINT analitik_job_status_check
    CHECK (status IN ('queued','processing','retry','completed','dead','cancelled'))`);
};

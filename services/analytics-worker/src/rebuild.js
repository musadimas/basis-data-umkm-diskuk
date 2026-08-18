import { withTransaction } from "./db.js";
import { reconcileGeneration } from "./reconcile.js";
import { projectRecord, safeProjection, sourceRow } from "./projector.js";
const SECTORS_SQL = `SELECT code,division_start,division_end FROM analitik_kbli_sector WHERE schema_version=1 ORDER BY code`;
export async function rebuildCurrentModel(pool, { logger, batchSize = 50_000 } = {}) {
  const lock = await pool.query("SELECT pg_try_advisory_lock(hashtext('diskuk.analytics.rebuild')) AS locked"); if (!lock.rows[0]?.locked) return { skipped: "rebuild_locked" };
  let generationId;
  try {
    const sectors = (await pool.query(SECTORS_SQL)).rows;
    const highWater = Number((await pool.query("SELECT COALESCE(MAX(sequence),0)::bigint AS value FROM analitik_job")).rows[0].value);
    const dataAsOf = new Date();
    generationId = (await pool.query(`INSERT INTO analitik_generation(status,schema_version,registry_version,masking_version,source_high_water,outbox_high_water,build_started_at,reconciliation_status) VALUES ('candidate',1,1,1,$1,$1,NOW(),'pending') RETURNING id`, [highWater])).rows[0].id;
    let cursor = null; let total = 0;
    while (true) {
      const result = await pool.query(`SELECT u.id FROM usaha u WHERE u.id > COALESCE($1::uuid,'00000000-0000-0000-0000-000000000000'::uuid) AND (u.status IN ('active','archived')) ORDER BY u.id LIMIT $2`, [cursor, Math.min(batchSize, 50000)]);
      if (!result.rows.length) break;
      const inserted = await withTransaction(pool, async (client) => { let count = 0; for (const item of result.rows) { const row = await sourceRow(client, item.id); if (!row) continue; const safe = safeProjection(row, dataAsOf, sectors); await client.query(`INSERT INTO analitik_usaha_current(generation_id,usaha_id,status,nama,kegiatan_utama,produk_utama,status_hukum,skala,kota_id,kota_kode,kota_nama,kecamatan_id,kecamatan_nama,kelurahan_id,kelurahan_nama,kode_kbli,kategori_kbli,sektor_kbli,omzet_tahunan,total_aset,omzet_quality,aset_quality,masked_nik,masked_phone,owner_name,age_band,business_address,latitude,longitude,extra_fields,source_hash,source_updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32) ON CONFLICT DO NOTHING`, [generationId,safe.usahaId,safe.status || "active",safe.name,safe.kegiatan_utama,safe.produk_utama,row.status_hukum,safe.scale,safe.kota_id,safe.kota_kode,safe.kota_nama,safe.kecamatan_id,safe.kecamatan_nama,safe.kelurahan_id,safe.kelurahan_nama,safe.kbliCode,safe.kbliCategory,safe.sektor_kbli,row.omzet_tahunan,row.total_aset,safe.omzet_quality,safe.aset_quality,safe.owner.maskedNik,safe.owner.maskedPhone,safe.owner.name,safe.owner.ageBand,safe.business_address,safe.latitude,safe.longitude,JSON.stringify(safe.extraFields),row.source_hash,row.source_updated_at]); count += 1; } return count; });
      total += Number(inserted || 0); cursor = result.rows.at(-1).id; if (result.rows.length < Math.min(batchSize, 50000)) break;
    }
    // Tail replay closes the outbox window opened while the candidate was backfilled.
    let tailHighWater = highWater;
    let caughtUp = false;
    for (let pass = 0; pass < 5; pass += 1) {
      const tail = (await pool.query(`SELECT sequence,job_type,entity_id FROM analitik_job WHERE sequence>$1 AND status IN ('queued','processing','retry','completed') ORDER BY sequence ASC LIMIT 1000`, [tailHighWater])).rows;
      if (!tail.length) { caughtUp = true; break; }
      for (const job of tail) {
        if (job.job_type === 'rebuild_current_model') throw Object.assign(new Error('TAIL_REBUILD_REQUIRED'), { code: 'TAIL_REBUILD_REQUIRED' });
        if (job.job_type === 'project_record_change' && job.entity_id) await withTransaction(pool, (client) => projectRecord(client, { ...job, generationId }, dataAsOf, sectors));
        tailHighWater = Math.max(tailHighWater, Number(job.sequence));
      }
      const latest = Number((await pool.query("SELECT COALESCE(MAX(sequence),0)::bigint AS value FROM analitik_job")).rows[0].value);
      if (latest <= tailHighWater) { caughtUp = true; break; }
    }
    if (!caughtUp) throw Object.assign(new Error('TAIL_NOT_CAUGHT_UP'), { code: 'TAIL_NOT_CAUGHT_UP' });
    const finalCount = Number((await pool.query("SELECT COUNT(*)::bigint AS count FROM analitik_usaha_current WHERE generation_id=$1", [generationId])).rows[0].count);
    await pool.query(`UPDATE analitik_generation SET row_count=$2,outbox_high_water=$3,build_finished_at=NOW() WHERE id=$1`, [generationId,finalCount,tailHighWater]);
    const reconciliation = await withTransaction(pool, async (client) => reconcileGeneration(client,generationId));
    if (!reconciliation.passed) throw Object.assign(new Error("Candidate reconciliation failed"), { code: "RECONCILIATION_FAILED", reconciliation });
    await withTransaction(pool, async (client) => { const old = (await client.query(`SELECT active_generation_id FROM analitik_active_generation WHERE id=1 FOR UPDATE`)).rows[0]?.active_generation_id; if (old) await client.query(`UPDATE analitik_generation SET status='previous' WHERE id=$1`, [old]); await client.query(`UPDATE analitik_generation SET status='active',reconciled_at=NOW(),reconciliation_status='passed',data_as_of=$2 WHERE id=$1`, [generationId, dataAsOf]); await client.query(`UPDATE analitik_active_generation SET active_generation_id=$1,previous_generation_id=$2,updated_at=NOW() WHERE id=1`, [generationId, old]); });
    logger?.info("generation_promoted", { generationId, rowCount: finalCount }); return { generationId, rowCount: finalCount, promoted: true };
  } catch (error) { if (generationId) await pool.query(`UPDATE analitik_generation SET status='failed',reconciliation_status='failed',error_code=$2,error_message='Candidate failed; last-good retained' WHERE id=$1`, [generationId, String(error.code || "REBUILD_FAILED").slice(0,80)]).catch(() => {}); logger?.error("generation_failed", { generationId, errorCode: error.code || "REBUILD_FAILED" }); throw error; } finally { await pool.query("SELECT pg_advisory_unlock(hashtext('diskuk.analytics.rebuild'))").catch(() => {}); }
}

export async function cleanupOldGenerations(pool, { retentionHours = 24, limit = 10 } = {}) {
  const result = await pool.query(`WITH eligible AS (
    SELECT g.id FROM analitik_generation g
    LEFT JOIN analitik_active_generation p ON p.active_generation_id=g.id OR p.previous_generation_id=g.id
    WHERE p.id IS NULL AND g.status NOT IN ('active','previous')
      AND g.created_at < NOW() - make_interval(hours => $1)
      AND NOT EXISTS (SELECT 1 FROM analitik_job j WHERE COALESCE(j.request,'{}')::text LIKE '%' || g.id::text || '%' OR COALESCE(j.checkpoint,'{}')::text LIKE '%' || g.id::text || '%')
      AND NOT EXISTS (SELECT 1 FROM analitik_health h WHERE COALESCE(h.check_data,'{}')::text LIKE '%' || g.id::text || '%')
    ORDER BY g.created_at ASC LIMIT $2
  ) DELETE FROM analitik_generation g USING eligible e WHERE g.id=e.id RETURNING g.id`, [retentionHours, limit]);
  return { deleted: result.rowCount || 0 };
}

import { withTransaction } from "./db.js";
import { reconcileGeneration } from "./reconcile.js";
import { projectRecord, safeProjection } from "./projector.js";

const SECTORS_SQL = `SELECT code,division_start,division_end FROM analitik_kbli_sector WHERE schema_version=1 ORDER BY code`;

// Bulk source fetch – same joins as projector.SOURCE_SQL but ranged
const BULK_SOURCE_SQL = `
SELECT u.id,u.status,u.nama,u.kegiatan_utama,u.produk_utama,u.status_hukum,u.skala,u.omzet_tahunan,u.total_aset,u.latitude,u.longitude,u.source_hash,u.source_updated_at,
       a.alamat_jalan AS business_address,
       ko.id AS kota_id,ko.kode AS kota_kode,COALESCE(ko.nama,'Tidak diketahui') AS kota_nama,
       kc.id AS kecamatan_id,COALESCE(kc.nama,'Tidak diketahui') AS kecamatan_nama,
       kl.id AS kelurahan_id,COALESCE(kl.nama,'Tidak diketahui') AS kelurahan_nama,
       kk.kode AS kode_kbli,kk.kategori AS kategori_kbli,
       pu.nik,pu.telepon,pu.birth_date,pu.nama_lengkap AS owner_name
FROM usaha u
LEFT JOIN alamat a ON a.id=u.alamat
LEFT JOIN kelurahan kl ON kl.id=a.kelurahan
LEFT JOIN kecamatan kc ON kc.id=kl.kecamatan
LEFT JOIN kota ko ON ko.id=kc.kota
LEFT JOIN klasifikasi_usaha kk ON kk.id=u.klasifikasi
LEFT JOIN pelaku_usaha pu ON pu.id=u.pelaku_usaha
WHERE u.id > COALESCE($1::uuid,'00000000-0000-0000-0000-000000000000'::uuid)
  AND u.status IN ('active','archived')
  AND (ko.id IS NULL OR EXISTS (SELECT 1 FROM provinsi p WHERE p.id=ko.provinsi AND lower(p.nama)='jawa barat'))
ORDER BY u.id
LIMIT $2
`;

// Full legacy refresh SQL – mirrors scripts/refresh-dashboard-snapshots.sql but parameterized for dataAsOf
// Executed inside the promotion transaction to guarantee single-publication atomicity
async function refreshLegacySnapshots(client, dataAsOf) {
  // TRUNCATE + INSERT usaha_tabular from canonical source (active Jawa Barat)
  await client.query(`TRUNCATE usaha_tabular`);
  await client.query(`
    INSERT INTO usaha_tabular (
      id, nama, skala, produk_utama, kegiatan_utama,
      kode_kbli, kategori_kbli, deskripsi_kbli,
      kota_id, kota_nama, kecamatan_id, kecamatan_nama, kelurahan_id, kelurahan_nama,
      tenaga_kerja_laki_laki, tenaga_kerja_perempuan,
      latitude, longitude
    )
    SELECT
      u.id,
      u.nama,
      u.skala,
      u.produk_utama,
      u.kegiatan_utama,
      kk.kode,
      kk.kategori,
      kk.deskripsi,
      ko.id,
      COALESCE(ko.nama, 'Tidak diketahui'),
      kc.id,
      COALESCE(kc.nama, 'Tidak diketahui'),
      kl.id,
      COALESCE(kl.nama, 'Tidak diketahui'),
      COALESCE(stk.dibayar_laki_laki, 0) +
        COALESCE(stk.tidak_dibayar_laki_laki, 0) +
        COALESCE(stk.disabilitas_dibayar_laki_laki, 0) +
        COALESCE(stk.disabilitas_tidak_dibayar_laki_laki, 0),
      COALESCE(stk.dibayar_perempuan, 0) +
        COALESCE(stk.tidak_dibayar_perempuan, 0) +
        COALESCE(stk.disabilitas_dibayar_perempuan, 0) +
        COALESCE(stk.disabilitas_tidak_dibayar_perempuan, 0),
      u.latitude,
      u.longitude
    FROM usaha u
    LEFT JOIN alamat a ON a.id = u.alamat
    LEFT JOIN kelurahan kl ON kl.id = a.kelurahan
    LEFT JOIN kecamatan kc ON kc.id = kl.kecamatan
    LEFT JOIN kota ko ON ko.id = kc.kota
    LEFT JOIN provinsi p ON p.id = ko.provinsi
    LEFT JOIN klasifikasi_usaha kk ON kk.id = u.klasifikasi
    LEFT JOIN statistik_tenaga_kerja stk ON stk.usaha = u.id
    WHERE u.status = 'active' AND (p.id IS NULL OR LOWER(p.nama) = 'jawa barat')
  `);

  // Build infografis_snapshot payload – exact contract from refresh-dashboard-snapshots.sql
  await client.query(`
    WITH usaha_jawa_barat AS MATERIALIZED (
      SELECT
        t.id,
        NULLIF(BTRIM(u_source.nib), '') AS nib,
        t.skala,
        t.kode_kbli,
        t.kategori_kbli,
        t.deskripsi_kbli,
        t.kota_id,
        COALESCE(t.kota_nama, 'Tidak diketahui') AS kota_nama,
        t.kecamatan_id,
        COALESCE(t.kecamatan_nama, 'Tidak diketahui') AS kecamatan_nama,
        t.tenaga_kerja_laki_laki AS male,
        t.tenaga_kerja_perempuan AS female
      FROM usaha_tabular t
      LEFT JOIN usaha u_source ON u_source.id = t.id
    ),
    scale AS (
      SELECT jsonb_build_object(
        'total', COUNT(*)::integer,
        'mikro', COUNT(*) FILTER (WHERE skala = 'micro')::integer,
        'kecil', COUNT(*) FILTER (WHERE skala = 'small')::integer,
        'menengah', COUNT(*) FILTER (WHERE skala = 'medium')::integer
      ) AS value
      FROM usaha_jawa_barat
    ),
    regions AS (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id', id, 'name', name, 'value', value)
        ORDER BY value DESC, name ASC
      ), '[]'::jsonb) AS value
      FROM (
        SELECT COALESCE(kota_id::text, 'unknown') AS id, kota_nama AS name, COUNT(*)::integer AS value
        FROM usaha_jawa_barat
        GROUP BY kota_id, kota_nama
      ) AS grouped
    ),
    sektor_definisi(kode, nama, divisi_awal, divisi_akhir) AS (
      VALUES
        ('A', 'Pertanian, Kehutanan, dan Perikanan', 1, 3),
        ('B', 'Pertambangan dan Penggalian', 5, 9),
        ('C', 'Industri Pengolahan (Manufaktur/Kerajinan)', 10, 33),
        ('D', 'Pengadaan Listrik, Gas, Uap/Air Panas, dan Udara Dingin', 35, 35),
        ('E', 'Pengelolaan Air, Limbah, Sampah, dan Aktivitas Remediasi', 36, 39),
        ('F', 'Konstruksi', 41, 43),
        ('G', 'Perdagangan Besar dan Eceran; Reparasi Kendaraan', 45, 47),
        ('H', 'Pengangkutan dan Pergudangan', 49, 53),
        ('I', 'Penyediaan Akomodasi dan Makan Minum', 55, 56),
        ('J', 'Informasi dan Komunikasi', 58, 63),
        ('K', 'Aktivitas Keuangan dan Asuransi', 64, 66),
        ('L', 'Real Estat', 68, 68),
        ('M', 'Aktivitas Profesional, Ilmiah, dan Teknis', 69, 75),
        ('N', 'Aktivitas Penyewaan, Ketenagakerjaan, Agen Perjalanan, dan Penunjang Usaha', 77, 82),
        ('O', 'Administrasi Pemerintahan, Pertahanan, dan Jaminan Sosial Wajib', 84, 84),
        ('P', 'Pendidikan', 85, 85),
        ('Q', 'Aktivitas Kesehatan Manusia dan Aktivitas Sosial', 86, 88),
        ('R', 'Kesenian, Hiburan, dan Rekreasi', 90, 93),
        ('S', 'Aktivitas Jasa Lainnya', 94, 96),
        ('T', 'Aktivitas Rumah Tangga sebagai Pemberi Kerja; Aktivitas yang Menghasilkan Barang dan Jasa oleh Rumah Tangga untuk Kebutuhan Sendiri', 97, 98),
        ('U', 'Aktivitas Badan Internasional dan Badan Ekstra Internasional Lainnya', 99, 99)
    ),
    sektor_rows AS (
      SELECT
        sd.kode,
        sd.nama,
        COUNT(u.id)::integer AS total,
        COUNT(*) FILTER (WHERE u.skala = 'micro')::integer AS mikro,
        COUNT(*) FILTER (WHERE u.skala = 'small')::integer AS kecil,
        COUNT(*) FILTER (WHERE u.skala = 'medium')::integer AS menengah
      FROM sektor_definisi sd
      LEFT JOIN usaha_jawa_barat u ON (
        CASE WHEN u.kode_kbli ~ '^[0-9]{2,5}$' THEN LEFT(u.kode_kbli, 2)::integer END
      ) BETWEEN sd.divisi_awal AND sd.divisi_akhir
      GROUP BY sd.kode, sd.nama
    ),
    sector_coverage AS (
      SELECT jsonb_build_object(
        'mapped', COALESCE(SUM(total), 0)::integer,
        'unclassified', ((SELECT COUNT(*) FROM usaha_jawa_barat) - COALESCE(SUM(total), 0))::integer
      ) AS value
      FROM sektor_rows
    ),
    sectors AS (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'code', kode, 'name', nama, 'total', total,
          'mikro', mikro, 'kecil', kecil, 'menengah', menengah,
          'percentage', percentage
        ) ORDER BY total DESC, kode ASC
      ), '[]'::jsonb) AS value
      FROM (
        SELECT
          kode,
          nama,
          total,
          mikro,
          kecil,
          menengah,
          COALESCE(ROUND(total * 100.0 / NULLIF((SELECT COUNT(*) FROM usaha_jawa_barat), 0), 1), 0) AS percentage
        FROM sektor_rows
      ) AS normalized
    ),
    kbli_rows AS (
      SELECT
        kode_kbli AS code,
        kategori_kbli AS name,
        deskripsi_kbli AS description,
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE skala = 'micro')::integer AS mikro,
        COUNT(*) FILTER (WHERE skala = 'small')::integer AS kecil,
        COUNT(*) FILTER (WHERE skala = 'medium')::integer AS menengah
      FROM usaha_jawa_barat
      WHERE kode_kbli IS NOT NULL
      GROUP BY kode_kbli, kategori_kbli, deskripsi_kbli
    ),
    kbli AS (
      SELECT
        COALESCE(jsonb_agg(
          jsonb_build_object(
            'code', code, 'name', name, 'description', description, 'total', total,
            'mikro', mikro, 'kecil', kecil, 'menengah', menengah
          ) ORDER BY total DESC, code ASC
        ), '[]'::jsonb) AS all_rows,
        COALESCE(jsonb_agg(
          jsonb_build_object(
            'code', code, 'name', name, 'description', description, 'total', total,
            'mikro', mikro, 'kecil', kecil, 'menengah', menengah
          ) ORDER BY total DESC, code ASC
        ) FILTER (WHERE rank <= 5), '[]'::jsonb) AS top_rows
      FROM (
        SELECT *, row_number() OVER (ORDER BY total DESC, code ASC) AS rank
        FROM kbli_rows
      ) AS ranked
    ),
    filter_options AS (
      SELECT jsonb_build_object(
        'kota', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', id, 'nama', nama) ORDER BY nama, id)
          FROM (
            SELECT DISTINCT kota_id AS id, kota_nama AS nama
            FROM usaha_jawa_barat
            WHERE kota_id IS NOT NULL
          ) AS options
        ), '[]'::jsonb),
        'kecamatan', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('id', id, 'nama', nama, 'kotaId', kota_id)
            ORDER BY nama, id
          )
          FROM (
            SELECT DISTINCT kecamatan_id AS id, kecamatan_nama AS nama, kota_id
            FROM usaha_jawa_barat
            WHERE kecamatan_id IS NOT NULL AND kota_id IS NOT NULL
          ) AS options
        ), '[]'::jsonb),
        'kategori', COALESCE((
          SELECT jsonb_agg(nama ORDER BY nama)
          FROM (
            SELECT DISTINCT name AS nama
            FROM kbli_rows
            WHERE name IS NOT NULL
          ) AS options
        ), '[]'::jsonb),
        'kbli', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('kode', kode, 'kategori', kategori)
            ORDER BY kode, kategori
          )
          FROM (
            SELECT DISTINCT code AS kode, name AS kategori
            FROM kbli_rows
          ) AS options
        ), '[]'::jsonb)
      ) AS value
    ),
    workforce_numbers AS (
      SELECT COALESCE(SUM(male), 0)::bigint AS male, COALESCE(SUM(female), 0)::bigint AS female
      FROM usaha_jawa_barat
    ),
    workforce AS (
      SELECT jsonb_build_object(
        'male', male,
        'female', female,
        'total', male + female,
        'malePercentage', COALESCE(ROUND(male * 100.0 / NULLIF(male + female, 0), 1), 0),
        'femalePercentage', COALESCE(ROUND(female * 100.0 / NULLIF(male + female, 0), 1), 0)
      ) AS value
      FROM workforce_numbers
    ),
    nib_counts AS (
      SELECT
        COUNT(*) FILTER (WHERE nib IS NOT NULL)::integer AS with_nib,
        COUNT(*) FILTER (WHERE nib IS NULL)::integer AS without_nib
      FROM usaha_jawa_barat
    ),
    nib AS (
      SELECT jsonb_build_object(
        'total', with_nib + without_nib,
        'withNib', with_nib,
        'withoutNib', without_nib,
        'withPercentage', COALESCE(ROUND(with_nib * 100.0 / NULLIF(with_nib + without_nib, 0), 1), 0),
        'withoutPercentage', COALESCE(ROUND(without_nib * 100.0 / NULLIF(with_nib + without_nib, 0), 1), 0)
      ) AS value
      FROM nib_counts
    )
    INSERT INTO infografis_snapshot (id, payload, refreshed_at)
    SELECT 1, jsonb_build_object(
      'scales', scale.value,
      'regions', regions.value,
      'sectors', sectors.value,
      'sectorCoverage', sector_coverage.value,
      'topKbli', kbli.top_rows,
      'kbli', kbli.all_rows,
      'options', filter_options.value,
      'nib', nib.value,
      'workforce', workforce.value
    ), $1
    FROM scale, regions, sectors, sector_coverage, kbli, filter_options, workforce, nib
    ON CONFLICT (id) DO UPDATE
    SET payload = EXCLUDED.payload, refreshed_at = EXCLUDED.refreshed_at
  `, [dataAsOf]);

  // Validate snapshot consistency – same checks as refresh-dashboard-snapshots.sql DO block but without COMMIT
  const validation = await client.query(`
    SELECT
      (payload -> 'scales' ->> 'total')::integer AS infographic_total,
      COALESCE((SELECT SUM((item ->> 'total')::integer) FROM jsonb_array_elements(COALESCE(payload -> 'sectors', '[]'::jsonb)) AS item), 0)::integer AS sector_total,
      COALESCE((payload -> 'sectorCoverage' ->> 'unclassified')::integer, 0) AS unclassified_total,
      jsonb_array_length(COALESCE(payload -> 'sectors', '[]'::jsonb)) AS sector_count,
      (SELECT COUNT(*)::integer FROM usaha_tabular) AS tabular_total
    FROM infografis_snapshot WHERE id = 1
  `);
  const row = validation.rows[0];
  if (row) {
    const tabularTotal = Number(row.tabular_total ?? 0);
    const infTotal = Number(row.infographic_total ?? 0);
    const sectorTotal = Number(row.sector_total ?? 0);
    const unclassified = Number(row.unclassified_total ?? 0);
    const sectorCount = Number(row.sector_count ?? 0);
    if (infTotal !== tabularTotal) {
      throw Object.assign(new Error(`dashboard snapshot total mismatch: infographic ${infTotal}, tabular ${tabularTotal}`), { code: "SNAPSHOT_MISMATCH" });
    }
    if (sectorCount !== 21 || sectorTotal + unclassified !== tabularTotal) {
      throw Object.assign(new Error(`dashboard snapshot sector mismatch: sectors ${sectorCount}, sectorTotal ${sectorTotal}, unclassified ${unclassified}, tabular ${tabularTotal}`), { code: "SNAPSHOT_MISMATCH" });
    }
  }
}

export async function rebuildCurrentModel(pool, { logger, batchSize = 50_000 } = {}) {
  const lock = await pool.query("SELECT pg_try_advisory_lock(hashtext('diskuk.analytics.rebuild')) AS locked"); if (!lock.rows[0]?.locked) return { skipped: "rebuild_locked" };
  let generationId;
  try {
    const sectors = (await pool.query(SECTORS_SQL)).rows;
    const highWater = Number((await pool.query("SELECT COALESCE(MAX(sequence),0)::bigint AS value FROM analitik_job")).rows[0].value);
    const dataAsOf = new Date();
    generationId = (await pool.query(`INSERT INTO analitik_generation(status,schema_version,registry_version,masking_version,source_high_water,outbox_high_water,build_started_at,reconciliation_status) VALUES ('candidate',1,1,1,$1,$1,NOW(),'pending') RETURNING id`, [highWater])).rows[0].id;
    let cursor = null; let total = 0;
    const effectiveBatch = Math.min(batchSize, 50000);
    const INSERT_CHUNK = 1000; // rows per INSERT to stay under PG param limit

    while (true) {
      const batchResult = await pool.query(BULK_SOURCE_SQL, [cursor, effectiveBatch]);
      const sourceRows = batchResult.rows;
      if (!sourceRows.length) break;

      // Project all rows in Node (masking)
      const projected = [];
      for (const row of sourceRows) {
        const safe = safeProjection(row, dataAsOf, sectors);
        if (!safe) continue;
        projected.push({ safe, row });
      }

      // Bulk insert in chunks
      let insertedInBatch = 0;
      for (let i = 0; i < projected.length; i += INSERT_CHUNK) {
        const chunk = projected.slice(i, i + INSERT_CHUNK);
        if (!chunk.length) continue;
        const values = [];
        const params = [];
        let paramIdx = 1;
        for (const { safe, row } of chunk) {
          const cols = [generationId,safe.usahaId,safe.status || "active",safe.name,safe.kegiatan_utama,safe.produk_utama,row.status_hukum,safe.scale,safe.kota_id,safe.kota_kode,safe.kota_nama,safe.kecamatan_id,safe.kecamatan_nama,safe.kelurahan_id,safe.kelurahan_nama,safe.kbliCode,safe.kbliCategory,safe.sektor_kbli,row.omzet_tahunan,row.total_aset,safe.omzet_quality,safe.aset_quality,safe.owner.maskedNik,safe.owner.maskedPhone,safe.owner.name,safe.owner.ageBand,safe.business_address,safe.latitude,safe.longitude,JSON.stringify(safe.extraFields),row.source_hash,row.source_updated_at];
          // 32 columns
          const placeholders = cols.map((_, idx) => `$${paramIdx + idx}`).join(",");
          values.push(`(${placeholders})`);
          params.push(...cols);
          paramIdx += cols.length;
        }
        const insertSql = `INSERT INTO analitik_usaha_current(generation_id,usaha_id,status,nama,kegiatan_utama,produk_utama,status_hukum,skala,kota_id,kota_kode,kota_nama,kecamatan_id,kecamatan_nama,kelurahan_id,kelurahan_nama,kode_kbli,kategori_kbli,sektor_kbli,omzet_tahunan,total_aset,omzet_quality,aset_quality,masked_nik,masked_phone,owner_name,age_band,business_address,latitude,longitude,extra_fields,source_hash,source_updated_at) VALUES ${values.join(",")} ON CONFLICT DO NOTHING`;
        await withTransaction(pool, async (client) => {
          await client.query(insertSql, params);
        });
        insertedInBatch += chunk.length;
      }

      total += insertedInBatch;
      cursor = sourceRows.at(-1).id;
      if (sourceRows.length < effectiveBatch) break;
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
    const activeCount = Number((await pool.query("SELECT COUNT(*)::bigint AS count FROM analitik_usaha_current WHERE generation_id=$1 AND status='active'", [generationId])).rows[0].count);
    const archivedCount = Number((await pool.query("SELECT COUNT(*)::bigint AS count FROM analitik_usaha_current WHERE generation_id=$1 AND status='archived'", [generationId])).rows[0].count);
    // Persist per-status counts (new columns) with fail-open fallback for older schema
    try {
      await pool.query(`UPDATE analitik_generation SET row_count=$2, active_row_count=$3, archived_row_count=$4, outbox_high_water=$5, build_finished_at=NOW() WHERE id=$1`, [generationId,finalCount,activeCount,archivedCount,tailHighWater]);
    } catch {
      await pool.query(`UPDATE analitik_generation SET row_count=$2,outbox_high_water=$3,build_finished_at=NOW() WHERE id=$1`, [generationId,finalCount,tailHighWater]);
    }
    const reconciliation = await withTransaction(pool, async (client) => reconcileGeneration(client,generationId));
    if (!reconciliation.passed) throw Object.assign(new Error("Candidate reconciliation failed"), { code: "RECONCILIATION_FAILED", reconciliation });
    // Bulk inserts leave the candidate's heap pages outside the visibility map.
    // Refresh it before promotion so covering indexes remain index-only within
    // the synchronous analytics API budget. PARALLEL 0 fits the container's
    // deliberately small /dev/shm allocation.
    await pool.query("VACUUM (ANALYZE, PARALLEL 0) analitik_usaha_current");
    // Atomic promotion + legacy snapshot refresh in single transaction
    // This ensures one publish yields same generation/dataAsOf across all four surfaces
    await withTransaction(pool, async (client) => {
      const old = (await client.query(`SELECT active_generation_id FROM analitik_active_generation WHERE id=1 FOR UPDATE`)).rows[0]?.active_generation_id;
      if (old) await client.query(`UPDATE analitik_generation SET status='previous' WHERE id=$1`, [old]);
      await client.query(`UPDATE analitik_generation SET status='active',reconciled_at=NOW(),reconciliation_status='passed',data_as_of=$2 WHERE id=$1`, [generationId, dataAsOf]);
      await client.query(`UPDATE analitik_active_generation SET active_generation_id=$1,previous_generation_id=$2,updated_at=NOW() WHERE id=1`, [generationId, old]);
      // Legacy compatibility snapshot – MUST succeed or promotion rolls back
      await refreshLegacySnapshots(client, dataAsOf);
    });
    logger?.info("generation_promoted", { generationId, rowCount: finalCount, activeCount, archivedCount, statementCount: `batches~${Math.ceil(finalCount/50000)}` });
    return { generationId, rowCount: finalCount, activeCount, archivedCount, promoted: true, dataAsOf };
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

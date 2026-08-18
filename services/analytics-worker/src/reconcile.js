const PII_COLUMNS = ["nik", "telepon", "birth_date", "foto", "alamat_pribadi"]
export async function reconcileGeneration(client, generationId, { expectedSourceCount = null } = {}) {
  const rowCount = Number((await client.query("SELECT COUNT(*)::bigint AS count FROM analitik_usaha_current WHERE generation_id=$1", [generationId])).rows[0].count)
  const source = (await client.query(`SELECT u.status,COUNT(*)::bigint AS count FROM usaha u LEFT JOIN alamat a ON a.id=u.alamat LEFT JOIN kelurahan kl ON kl.id=a.kelurahan LEFT JOIN kecamatan kc ON kc.id=kl.kecamatan LEFT JOIN kota ko ON ko.id=kc.kota LEFT JOIN provinsi p ON p.id=ko.provinsi WHERE u.status IN ('active','archived') AND (p.id IS NULL OR lower(p.nama)='jawa barat') GROUP BY u.status`)).rows
  const sourceBuckets = Object.fromEntries(source.map((item) => [item.status, Number(item.count)]))
  const statusCount = await client.query("SELECT status,COUNT(*)::bigint AS count FROM analitik_usaha_current WHERE generation_id=$1 GROUP BY status", [generationId])
  const quality = await client.query("SELECT COUNT(*) FILTER (WHERE kota_nama='Tidak diketahui' OR kecamatan_nama='Tidak diketahui' OR kelurahan_nama='Tidak diketahui')::bigint AS unknown_geography,COUNT(*) FILTER (WHERE kode_kbli IS NULL OR sektor_kbli IS NULL)::bigint AS unmapped_kbli FROM analitik_usaha_current WHERE generation_id=$1", [generationId])
  const modelBuckets = Object.fromEntries(statusCount.rows.map((item) => [item.status, Number(item.count)]))
  const expected = expectedSourceCount === null ? (sourceBuckets.active || 0) + (sourceBuckets.archived || 0) : Number(expectedSourceCount)
  const diffs = []
  if (rowCount !== expected) diffs.push({ code: "SOURCE_COUNT_MISMATCH", expected, actual: rowCount })
  for (const status of ["active", "archived"]) if ((sourceBuckets[status] || 0) !== (modelBuckets[status] || 0)) diffs.push({ code: "STATUS_COUNT_MISMATCH", status, expected: sourceBuckets[status] || 0, actual: modelBuckets[status] || 0 })
  if (rowCount !== statusCount.rows.reduce((sum, item) => sum + Number(item.count), 0)) diffs.push({ code: "STATUS_BUCKET_MISMATCH" })
  const columns = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='analitik_usaha_current' AND column_name = ANY($1::text[])", [PII_COLUMNS])).rows
  const result = { generationId, rowCount, activeSource: sourceBuckets.active || 0, archivedSource: sourceBuckets.archived || 0, status: modelBuckets, unknownGeography: Number(quality.rows[0]?.unknown_geography || 0), unmappedKbli: Number(quality.rows[0]?.unmapped_kbli || 0), diffs, passed: diffs.length === 0 && columns.length === 0, noRawPiiColumns: columns.length === 0 }
  await client.query("INSERT INTO analitik_health(health_kind,component,status,check_name,check_data,updated_at) VALUES ('reconciliation','analytics-worker',$1,'generation_reconcile',$2::jsonb,NOW())", [result.passed ? "passed" : "failed", JSON.stringify({ generationId, rowCount, activeSource: result.activeSource, archivedSource: result.archivedSource, unknownGeography: result.unknownGeography, unmappedKbli: result.unmappedKbli, diffs: result.diffs, noRawPiiColumns: result.noRawPiiColumns })])
  return result
}
export function reconciliationIncident(result) { return result.passed ? null : { fingerprint: `reconcile:${result.generationId}`, code: "RECONCILIATION_DIFF", detail: "Candidate generation did not reconcile" } }

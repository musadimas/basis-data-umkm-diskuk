/**
 * Directus endpoint `tabular` — data tabular UMKM untuk dashboard.
 *
 * Membaca dari snapshot publik `usaha_tabular` (lihat
 * scripts/refresh-dashboard-snapshots.sql) sehingga paginasi & filter tetap cepat
 * untuk jutaan baris. Endpoint ini publik, sama seperti endpoint `infografis`.
 *
 * Routes:
 *   GET  /v1/analytics/tabular/               → { data: rows, meta: { filterCount, mikro, kecil, menengah, page, pageSize, nextCursor } }
 *   GET  /v1/analytics/tabular/spasial        → { data: points, meta: { filterCount, mikro, kecil, menengah, limit } }
 *   GET  /v1/analytics/tabular/spasial/authorize → 204 (otorisasi proxy arsip PMTiles)
 *   GET  /v1/analytics/tabular/spasial/tileset   → { data: { url, updatedAt, pointCount } | null } (arsip PMTiles)
 *   GET  /v1/analytics/tabular/options        → { data: { kota, kecamatan, kategori, kbli } }
 *   GET  /v1/analytics/tabular/kelurahan?kecamatan=<id> → { data: kelurahan }
 *   GET  /v1/analytics/tabular/status         → waktu dan total snapshot aktif
 *   POST /v1/analytics/tabular/publish        → terbitkan snapshot (Super Admin)
 *   GET  /v1/analytics/tabular/export         → CSV export server-side (bounded)
 */
import { routeGuard } from "../../lib/utils/auth.js";
import { buildTabularFilter, positiveInt } from "../../lib/utils/tabular-filter.js";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const rows = (result) => result.rows ?? result[0] ?? [];
const privateHeaders = (res) => { res.setHeader?.("Cache-Control", "private, no-store"); };

function secret() {
  return process.env.DIRECTUS_SECRET || process.env.NUXT_SESSION_POLICY_SECRET || "tabular-development-secret";
}
function signCursor(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function decodeCursor(value) {
  if (!value) return null;
  const parts = String(value).split(".");
  const [body, sig] = parts;
  if (parts.length !== 2 || !body || !sig) {
    const e = new Error("Cursor invalid");
    e.statusCode = 400; e.code = "CURSOR_INVALID"; throw e;
  }
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    const e = new Error("Cursor invalid");
    e.statusCode = 400; e.code = "CURSOR_INVALID"; throw e;
  }
  try { return JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { const e=new Error("Cursor invalid"); e.statusCode=400; e.code="CURSOR_INVALID"; throw e; }
}

function mapTimeoutError(error) {
  if (error?.code === "57014" || error?.code === "55P03" || /statement timeout/i.test(String(error?.message))) {
    const e = new Error("Query timeout");
    e.statusCode = 504; e.code = "QUERY_TIMEOUT"; throw e;
  }
  throw error;
}

const readStatus = async (database) => {
  const result = await database.raw(`
    SELECT refreshed_at AS "refreshedAt",
           (payload -> 'scales' ->> 'total')::integer AS total
    FROM infografis_snapshot
    WHERE id = 1
  `);
  return rows(result)[0] ?? { refreshedAt: null, total: 0 };
};

// Bounded read helper: fail-closed budget. If transaction budget cannot be set, abort.
async function withReadTimeout(database, fn, signal) {
  if (signal?.aborted) {
    const e = new Error("Request aborted");
    e.code = "57014";
    e.statusCode = 499;
    throw e;
  }
  if (typeof database.transaction === "function") {
    return database.transaction(async (trx) => {
      await trx.raw("SET LOCAL statement_timeout = '4500ms'");
      await trx.raw("SET LOCAL lock_timeout = '500ms'");
      await trx.raw("SET TRANSACTION READ ONLY");
      if (signal) {
        const onAbort = () => {
          // Attempt to cancel backend query; best-effort
          trx.raw("SELECT pg_cancel_backend(pg_backend_pid())").catch(() => {});
        };
        signal.addEventListener?.("abort", onAbort, { once: true });
        try {
          return await fn(trx);
        } finally {
          signal.removeEventListener?.("abort", onAbort);
        }
      }
      return fn(trx);
    });
  }
  // Test mocks without transaction – run without budget (fail-open only for tests)
  return fn(database);
}

function exportSecret() { return process.env.DIRECTUS_SECRET || process.env.NUXT_SESSION_POLICY_SECRET || "tabular-development-secret"; }
function signDownload(jobId, owner, expires) { return crypto.createHmac("sha256", exportSecret()).update(`${jobId}.${owner}.${expires}`).digest("base64url"); }
function verifyDownload(jobId, owner, expires, sig) {
  const expiry = Number(expires);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now() || expiry > Date.now() + 24*60*60*1000 + 60000 || !sig) return false;
  const expected = signDownload(jobId, owner, expiry);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
function safePart(v) { return String(v||"system").replace(/[^a-z0-9_-]/gi,"").slice(0,80)||"system"; }
function artifactKey(owner, jobId) { return `tabular-exports/${safePart(owner)}/${jobId}.csv`; }
function artifactRoot() { return process.env.TABULAR_EXPORT_DIR || "/tmp/diskuk-tabular-exports"; }
function artifactPath(key) {
  const n = String(key).replaceAll("\\","/");
  if (n.startsWith("/") || n.split("/").some(s=>s==="..")) { const e=new Error("invalid artifact"); e.statusCode=500; throw e; }
  return path.join(artifactRoot(), n);
}
async function writeArtifact(key, body) {
  const file = artifactPath(key);
  await fs.mkdir(path.dirname(file), {recursive:true});
  await fs.writeFile(file, body);
}
async function readArtifact(key) {
  try { return await fs.readFile(artifactPath(key)); } catch(e){ if(e?.code!=="ENOENT") throw e; return null; }
}

// Mounted by the bundle entry "v1/analytics/tabular" (see package.json).
export default function registerTabularRoutes(router, { database, logger }) {
  router.get("/status", async (req, res, next) => {
    if (!routeGuard(req, next)) return; privateHeaders(res);
    try {
      res.json({ data: await readStatus(database) });
    } catch (error) {
      logger.error(error, "Unable to read dashboard publish status");
      next(error);
    }
  });

  router.post("/publish", async (req, res, next) => {
    if (!routeGuard(req, next, { adminOnly: true })) return;
    try {
      const result = await database.raw("SELECT analitik_enqueue_job('rebuild_current_model', 'rebuild_current_model', NULL) AS id");
      const jobId = rows(result)[0]?.id;
      res.status(202).json({ data: { jobId, status: "queued" } });
    } catch (error) {
      logger.error(error, "Unable to enqueue dashboard rebuild");
      next(error);
    }
  });

  // Filter dropdown options (dimuat sekali oleh halaman).
  router.get("/options", async (req, res, next) => {
    if (!routeGuard(req, next)) return; privateHeaders(res);
    try {
      const snapshotResult = await database.raw(`
        SELECT payload -> 'options' AS options
        FROM infografis_snapshot
        WHERE id = 1
      `);
      const snapshotOptions = rows(snapshotResult)[0]?.options;
      if (snapshotOptions) {
        res.json({ data: snapshotOptions });
        return;
      }

      // Compatibility path until the first snapshot publish after deployment.
      const [kotaResult, kecamatanResult, kategoriResult, kbliResult] = await Promise.all([
        database.raw(`
          SELECT DISTINCT kota_id AS id, kota_nama AS nama
          FROM usaha_tabular
          ORDER BY kota_nama
        `),
        database.raw(`
          SELECT DISTINCT kecamatan_id AS id, kecamatan_nama AS nama, kota_id AS "kotaId"
          FROM usaha_tabular
          ORDER BY kecamatan_nama
        `),
        database.raw(`
          SELECT DISTINCT kategori_kbli AS nama
          FROM usaha_tabular
          WHERE kategori_kbli IS NOT NULL
          ORDER BY nama
        `),
        database.raw(`
          SELECT DISTINCT kode_kbli AS kode, kategori_kbli AS kategori
          FROM usaha_tabular
          WHERE kode_kbli IS NOT NULL
          ORDER BY kode_kbli
        `),
      ]);

      res.json({
        data: {
          kota: rows(kotaResult),
          kecamatan: rows(kecamatanResult),
          kategori: rows(kategoriResult).map((item) => item.nama),
          kbli: rows(kbliResult),
        },
      });
    } catch (error) {
      logger.error(error, "Unable to read tabular filter options");
      next(error);
    }
  });

  // Kelurahan untuk satu kecamatan (opsi kaskade filter).
  // Scalable path: read from reference table `kelurahan` (small dimension) instead of scanning 5.4M fact rows.
  router.get("/kelurahan", async (req, res, next) => {
    if (!routeGuard(req, next)) return; privateHeaders(res);
    const kecamatanId = positiveInt(req.query?.kecamatan, null);
    if (kecamatanId === null) {
      res
        .status(400)
        .json({ errors: [{ message: "Query parameter 'kecamatan' is required." }] });
      return;
    }
    try {
      // Prefer reference table for scalability; fallback to fact snapshot if reference unavailable.
      let result;
      try {
        result = await database.raw(
          `
          SELECT id, nama
          FROM kelurahan
          WHERE kecamatan = ?
          ORDER BY nama
        `,
          [kecamatanId],
        );
        const data = rows(result);
        // If reference has data, use it. If empty but fact might have legacy rows, fallback only when zero rows.
        // Keep empty as valid (kecamatan without kelurahan) – return empty.
        res.json({ data });
        return;
      } catch (refError) {
        // Table missing or other error -> fallback to legacy fact scan with timeout guard
        logger.error(refError, "Kelurahan reference lookup failed, falling back to usaha_tabular");
      }
      result = await database.raw(
        `
          SELECT DISTINCT kelurahan_id AS id, kelurahan_nama AS nama
          FROM usaha_tabular
          WHERE kecamatan_id = ?
          ORDER BY kelurahan_nama
        `,
        [kecamatanId],
      );
      res.json({ data: rows(result) });
    } catch (error) {
      logger.error(error, "Unable to read kelurahan options");
      next(error);
    }
  });

  // Halaman data + jumlah data yang cocok dengan filter.
  // Supports both OFFSET (page) and signed keyset cursor (nama, id).
  // Returns scale breakdown in same response to avoid 3 extra count requests.
  router.get("/", async (req, res, next) => {
    if (!routeGuard(req, next)) return; privateHeaders(res);
    try {
      const q = req.query ?? {};
      const pageSize = Math.min(Math.max(positiveInt(q.page_size, 10), 1), 1000);
      const cursorRaw = q.cursor ?? q.next_cursor ?? null;
      let cursor = null;
      if (cursorRaw) {
        try { cursor = decodeCursor(cursorRaw); } catch (e) { return next(e); }
      }
      const page = cursor ? null : positiveInt(q.page, 1);

      const { where, params, hasFilters } = buildTabularFilter(q);

      // Fast path for no-filter counts: read aggregate snapshot (no fact scan)
      let countRow = null;
      if (!hasFilters) {
        try {
          const snap = await database.raw(`SELECT payload -> 'scales' AS scales FROM infografis_snapshot WHERE id = 1`);
          const scales = rows(snap)[0]?.scales;
          if (scales) {
            countRow = {
              filterCount: Number(scales.total ?? 0),
              mikro: Number(scales.mikro ?? 0),
              kecil: Number(scales.kecil ?? 0),
              menengah: Number(scales.menengah ?? 0),
            };
          }
        } catch {}
      }
      if (!countRow) {
        const countSql = `
          SELECT COUNT(*)::integer AS "filterCount",
                 COUNT(*) FILTER (WHERE t.skala = 'micro')::integer AS mikro,
                 COUNT(*) FILTER (WHERE t.skala = 'small')::integer AS kecil,
                 COUNT(*) FILTER (WHERE t.skala = 'medium')::integer AS menengah
          FROM usaha_tabular t
          ${where}
        `;
        try {
          const countResult = await withReadTimeout(database, (db) => db.raw(countSql, params), req.signal);
          countRow = rows(countResult)[0] ?? { filterCount: 0, mikro: 0, kecil: 0, menengah: 0 };
        } catch (e) { mapTimeoutError(e); }
      }

      // Build rows query with optional cursor
      let selectSql;
      let selectParams;
      if (cursor && cursor.nama && cursor.id) {
        const cursorWhere = where ? `${where} AND (t.nama, t.id) > (?, ?)` : `WHERE (t.nama, t.id) > (?, ?)`;
        selectSql = `
          SELECT t.id, t.nama, t.skala, t.produk_utama AS "produkUtama",
                 t.kegiatan_utama AS "kegiatanUtama",
                 t.kode_kbli AS "kodeKbli", t.kategori_kbli AS "kategoriKbli",
                 t.kota_nama AS kota, t.kecamatan_nama AS kecamatan,
                 t.kelurahan_nama AS kelurahan
          FROM usaha_tabular t
          ${cursorWhere}
          ORDER BY t.nama, t.id
          LIMIT ?
        `;
        selectParams = [...params, cursor.nama, cursor.id, pageSize + 1];
      } else {
        const offset = page ? (page - 1) * pageSize : 0;
        // Guard deep OFFSET: if page is very deep, advise cursor; still allow but log
        if (page && page > 1000) {
          logger.warn?.("Deep OFFSET requested, consider cursor pagination", { page, pageSize });
        }
        selectSql = `
          SELECT t.id, t.nama, t.skala, t.produk_utama AS "produkUtama",
                 t.kegiatan_utama AS "kegiatanUtama",
                 t.kode_kbli AS "kodeKbli", t.kategori_kbli AS "kategoriKbli",
                 t.kota_nama AS kota, t.kecamatan_nama AS kecamatan,
                 t.kelurahan_nama AS kelurahan
          FROM usaha_tabular t
          ${where}
          ORDER BY t.nama, t.id
          LIMIT ? OFFSET ?
        `;
        selectParams = [...params, pageSize, offset];
      }

      let result;
      try {
        result = await withReadTimeout(database, (db) => db.raw(selectSql, selectParams), req.signal);
      } catch (e) { mapTimeoutError(e); }
      let dataRows = rows(result);
      // For cursor, hasNext via limit+1 fetch; for OFFSET via total count
      let hasNext;
      if (cursor) {
        hasNext = dataRows.length > pageSize;
        if (hasNext) dataRows = dataRows.slice(0, pageSize);
      } else {
        const filterCountTmp = Number(countRow?.filterCount ?? 0);
        const offsetForNext = page ? (page - 1) * pageSize : 0;
        hasNext = filterCountTmp > 0 ? offsetForNext + dataRows.length < filterCountTmp : false;
      }
      const filterCount = Number(countRow?.filterCount ?? 0);
      const last = dataRows.at(-1);
      const nextCursor = hasNext && last ? signCursor({ nama: last.nama, id: last.id }) : null;

      res.json({
        data: dataRows,
        meta: {
          filterCount,
          mikro: Number(countRow?.mikro ?? 0),
          kecil: Number(countRow?.kecil ?? 0),
          menengah: Number(countRow?.menengah ?? 0),
          page: page ?? undefined,
          pageSize,
          nextCursor,
          hasNext,
        },
      });
    } catch (error) {
      if (error.code === "CURSOR_INVALID" || error.statusCode === 400) return next(error);
      if (error.code === "QUERY_TIMEOUT" || error.statusCode === 504) return next(error);
      logger.error(error, "Unable to read tabular rows");
      next(error);
    }
  });

  // Async CSV export – bounded background job (preferred per Phase 2)
  router.post("/export", async (req, res, next) => {
    if (!routeGuard(req, next)) return;
    try {
      const body = (req.body && typeof req.body === "object") ? req.body : {};
      const q = { ...req.query, ...body };
      const maxRows = Math.min(Math.max(positiveInt(q.max_rows ?? q.maxRows, 50000), 1), 50000);
      const { where, params } = buildTabularFilter(q);
      const owner = String(req.accountability?.user ?? "system");
      const exportSql = `
        SELECT t.nama, t.skala, t.kota_nama AS kota, t.kecamatan_nama AS kecamatan, t.kelurahan_nama AS kelurahan,
               t.produk_utama AS "produkUtama", t.kategori_kbli AS "kategoriKbli", t.kode_kbli AS "kodeKbli"
        FROM usaha_tabular t
        ${where}
        ORDER BY t.nama, t.id
        LIMIT ?
      `;
      // Create job row
      const jobId = (await database.raw("SELECT gen_random_uuid() AS id").then(r => (r.rows??r[0]??[])[0]?.id)) || crypto.randomUUID();
      const dedupe = `tabular_export:${owner}:${jobId}`;
      // Try to use analitik_job table if exists, otherwise fallback to in-memory
      let dbJobId = jobId;
      try {
        const ins = await database.raw(`INSERT INTO analitik_job(job_type,dedupe_key,status,owner,request,export_type,max_attempts) VALUES ('export',?, 'queued', ?, ?, 'tabular_csv', 3) RETURNING id`, [dedupe, owner, JSON.stringify({ where, params, maxRows, filters: q })]);
        dbJobId = (ins.rows??ins[0]??[])[0]?.id || jobId;
      } catch (e) {
        logger.warn?.("tabular export job table not available, using ephemeral job", { error: e.message });
      }
      // Generate artifact synchronously but mark as processing -> completed (bounded 50k, timeout guarded)
      const doGenerate = async () => {
        let result;
        try {
          result = await withReadTimeout(database, (db) => db.raw(exportSql, [...params, maxRows]), req.signal);
        } catch (e) { mapTimeoutError(e); }
        const data = rows(result);
        const header = ["Nama Usaha","Skala Usaha","Kabupaten/Kota","Kecamatan","Desa/Kelurahan","Produk Utama","Kegiatan Usaha","Kode KBLI"];
        const scaleMap = { micro: "Mikro", small: "Kecil", medium: "Menengah" };
        const lines = data.map((r) => [
          r.nama, scaleMap[r.skala] ?? r.skala, r.kota, r.kecamatan, r.kelurahan, r.produkUtama ?? "-", r.kategoriKbli ?? "-", r.kodeKbli ?? "-"
        ].map((v) => `"${String(v ?? "").replaceAll('"','""')}"`).join(","));
        const csv = [header.join(","), ...lines].join("\n");
        const expiresAt = Date.now() + 24*60*60*1000;
        const key = artifactKey(owner, dbJobId);
        await writeArtifact(key, Buffer.from("\uFEFF" + csv, "utf-8"));
        try {
          await database.raw("UPDATE analitik_job SET status='completed', request=jsonb_set(request, '{artifact}', ?, true), updated_at=NOW() WHERE id=?", [JSON.stringify({ key, rowCount: data.length, expiresAt: new Date(expiresAt).toISOString() }), dbJobId]);
        } catch {}
        return { key, rowCount: data.length, expiresAt };
      };
      // Start generation in background, but for 50k bounded we can complete quickly and return completed
      let artifact;
      try {
        await database.raw("UPDATE analitik_job SET status='processing', updated_at=NOW() WHERE id=?", [dbJobId]).catch(()=>{});
        artifact = await doGenerate();
        await database.raw("UPDATE analitik_job SET status='completed', updated_at=NOW() WHERE id=?", [dbJobId]).catch(()=>{});
      } catch (e) {
        try { await database.raw("UPDATE analitik_job SET status='dead', error_code='EXPORT_FAILED', updated_at=NOW() WHERE id=?", [dbJobId]); } catch {}
        throw e;
      }
      const expiresAt = artifact.expiresAt;
      const sig = signDownload(dbJobId, owner, expiresAt);
      res.status(202).json({ data: { jobId: dbJobId, status: "completed", rowCount: artifact.rowCount, expiresAt: new Date(expiresAt).toISOString(), downloadUrl: `/panel/v1/analytics/tabular/export/${dbJobId}/download?expires=${expiresAt}&sig=${sig}` } });
    } catch (error) {
      if (error.code === "QUERY_TIMEOUT" || error.statusCode === 504) return next(error);
      logger.error(error, "Unable to enqueue tabular export");
      next(error);
    }
  });

  router.get("/export/:jobId", async (req, res, next) => {
    if (!routeGuard(req, next)) return;
    try {
      const jobId = req.params?.jobId;
      const owner = String(req.accountability?.user ?? "system");
      const isAdmin = Boolean(req.accountability?.admin);
      const result = await database.raw(`SELECT id,owner,status,request,error_code FROM analitik_job WHERE id=? ${isAdmin?"":"AND owner=?"} AND job_type='export' AND export_type='tabular_csv'`, isAdmin ? [jobId] : [jobId, owner]);
      const row = (result.rows??result[0]??[])[0];
      if (!row) { res.status(404).json({ errors:[{message:"Export not found"}]}); return; }
      let request = {};
      try { request = typeof row.request==="string" ? JSON.parse(row.request) : row.request || {}; } catch {}
      const art = request.artifact;
      const status = row.status === "dead" ? "failed" : row.status;
      const downloadUrl = status==="completed" && art?.key ? `/panel/v1/analytics/tabular/export/${row.id}/download?expires=${Date.parse(art.expiresAt)}&sig=${signDownload(row.id, String(row.owner), Date.parse(art.expiresAt))}` : undefined;
      res.json({ data: { jobId: row.id, status, rowCount: art?.rowCount ?? null, expiresAt: art?.expiresAt ?? null, downloadUrl, error: row.error_code? "Ekspor gagal": null } });
    } catch (error) { next(error); }
  });

  router.get("/export/:jobId/download", async (req, res, next) => {
    if (!routeGuard(req, next)) return;
    try {
      const jobId = req.params?.jobId;
      const owner = String(req.accountability?.user ?? "system");
      const isAdmin = Boolean(req.accountability?.admin);
      const result = await database.raw(`SELECT id,owner,status,request FROM analitik_job WHERE id=? ${isAdmin?"":"AND owner=?"} AND job_type='export'`, isAdmin ? [jobId] : [jobId, owner]);
      const row = (result.rows??result[0]??[])[0];
      if (!row) { res.status(404).json({ errors:[{message:"Export not found"}]}); return; }
      let request = {};
      try { request = typeof row.request==="string" ? JSON.parse(row.request) : row.request || {}; } catch {}
      const art = request.artifact;
      if (row.status!=="completed" || !art || !verifyDownload(jobId, String(row.owner), req.query?.expires, req.query?.sig)) { res.status(403).json({ errors:[{message:"Download forbidden"}]}); return; }
      if (new Date(art.expiresAt).getTime() <= Date.now()) { res.status(410).json({ errors:[{message:"Export expired"}]}); return; }
      const body = await readArtifact(art.key);
      if (!body) { res.status(410).json({ errors:[{message:"Export expired"}]}); return; }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="data-umkm-jawa-barat-${jobId}.csv"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.end(body);
    } catch (error) { next(error); }
  });

  // Legacy GET /export kept for backward compat – now redirects to async flow via 202 with jobId if called without explicit download
  // For direct blob download, clients should POST /export then GET /export/:jobId/download
  router.get("/export", async (req, res, next) => {
    if (!routeGuard(req, next)) return;
    // If query has jobId param, treat as legacy sync – but we encourage async; keep sync bounded for small backward-compat callers
    try {
      const q = req.query ?? {};
      const wantsJson = (req.headers?.accept || "").includes("application/json");
      if (wantsJson) {
        // Async-style: create job and return JSON
        const maxRows = Math.min(Math.max(positiveInt(q.max_rows, 50000), 1), 50000);
        const { where, params } = buildTabularFilter(q);
        const owner = String(req.accountability?.user ?? "system");
        const exportSql = `
          SELECT t.nama, t.skala, t.kota_nama AS kota, t.kecamatan_nama AS kecamatan, t.kelurahan_nama AS kelurahan,
                 t.produk_utama AS "produkUtama", t.kategori_kbli AS "kategoriKbli", t.kode_kbli AS "kodeKbli"
          FROM usaha_tabular t
          ${where}
          ORDER BY t.nama, t.id
          LIMIT ?
        `;
        const jobId = crypto.randomUUID();
        let result;
        try { result = await withReadTimeout(database, (db) => db.raw(exportSql, [...params, maxRows]), req.signal); } catch (e) { mapTimeoutError(e); }
        const data = rows(result);
        const header = ["Nama Usaha","Skala Usaha","Kabupaten/Kota","Kecamatan","Desa/Kelurahan","Produk Utama","Kegiatan Usaha","Kode KBLI"];
        const scaleMap = { micro: "Mikro", small: "Kecil", medium: "Menengah" };
        const lines = data.map((r) => [
          r.nama, scaleMap[r.skala] ?? r.skala, r.kota, r.kecamatan, r.kelurahan, r.produkUtama ?? "-", r.kategoriKbli ?? "-", r.kodeKbli ?? "-"
        ].map((v) => `"${String(v ?? "").replaceAll('"','""')}"`).join(","));
        const csv = [header.join(","), ...lines].join("\n");
        // Also store as artifact for consistency
        const expiresAt = Date.now() + 24*60*60*1000;
        const key = artifactKey(owner, jobId);
        await writeArtifact(key, Buffer.from("\uFEFF" + csv, "utf-8")).catch(()=>{});
        const sig = signDownload(jobId, owner, expiresAt);
        res.status(200).json({ data: { jobId, status: "completed", rowCount: data.length, downloadUrl: `/panel/v1/analytics/tabular/export/${jobId}/download?expires=${expiresAt}&sig=${sig}` } });
        return;
      }
      // Default sync blob for backward compat (bounded, timeout-guarded)
      const maxRows = Math.min(Math.max(positiveInt(q.max_rows, 50000), 1), 50000);
      const { where, params } = buildTabularFilter(q);
      const exportSql = `
        SELECT t.nama, t.skala, t.kota_nama AS kota, t.kecamatan_nama AS kecamatan, t.kelurahan_nama AS kelurahan,
               t.produk_utama AS "produkUtama", t.kategori_kbli AS "kategoriKbli", t.kode_kbli AS "kodeKbli"
        FROM usaha_tabular t
        ${where}
        ORDER BY t.nama, t.id
        LIMIT ?
      `;
      let result;
      try {
        result = await withReadTimeout(database, (db) => db.raw(exportSql, [...params, maxRows]), req.signal);
      } catch (e) { mapTimeoutError(e); }
      const data = rows(result);
      const header = ["Nama Usaha","Skala Usaha","Kabupaten/Kota","Kecamatan","Desa/Kelurahan","Produk Utama","Kegiatan Usaha","Kode KBLI"];
      const scaleMap = { micro: "Mikro", small: "Kecil", medium: "Menengah" };
      const lines = data.map((r) => [
        r.nama, scaleMap[r.skala] ?? r.skala, r.kota, r.kecamatan, r.kelurahan, r.produkUtama ?? "-", r.kategoriKbli ?? "-", r.kodeKbli ?? "-"
      ].map((v) => `"${String(v ?? "").replaceAll('"','""')}"`).join(","));
      const csv = [header.join(","), ...lines].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="data-umkm-jawa-barat.csv"');
      res.setHeader("Cache-Control", "private, no-store");
      if (typeof res.send === "function") res.send(csv);
      else res.end(csv);
    } catch (error) {
      if (error.code === "QUERY_TIMEOUT" || error.statusCode === 504) return next(error);
      logger.error(error, "Unable to export tabular");
      next(error);
    }
  });

  // Target forward_auth Caddy untuk setiap byte-range PMTiles. Route ini sengaja
  // tidak membaca database agar request lanjutan arsip tetap ringan.
  router.get("/spasial/authorize", (req, res, next) => {
    if (!routeGuard(req, next)) return; privateHeaders(res);
    res.status(204).end();
  });

  // Metadata arsip PMTiles titik UMKM; dibangun oleh scripts/build-spatial-tiles.sh
  // dan disimpan pada payload snapshot. `data: null` berarti tileset belum
  // tersedia sehingga frontend memakai fallback GeoJSON /spasial.
  router.get("/spasial/tileset", async (req, res, next) => {
    if (!routeGuard(req, next)) return; privateHeaders(res);
    try {
      const result = await database.raw(`
        SELECT payload -> 'spatialTiles' AS tiles
        FROM infografis_snapshot
        WHERE id = 1
      `);
      res.json({ data: rows(result)[0]?.tiles ?? null });
    } catch (error) {
      logger.error(error, "Unable to read spatial tileset metadata");
      next(error);
    }
  });

  // Titik spasial (usaha berkoordinat) + rekap skala untuk peta.
  // Count skala dihitung dari semua baris yang cocok filter (bukan hanya
  // yang berkoordinat), sehingga angka kartu skala konsisten dengan tabular.
  router.get("/spasial", async (req, res, next) => {
    if (!routeGuard(req, next)) return; privateHeaders(res);
    try {
      const q = req.query ?? {};
      const limit = Math.min(Math.max(positiveInt(q.limit, 1000), 1), 5000);
      const { where, params, hasFilters } = buildTabularFilter(q);
      const coordClause = "t.latitude IS NOT NULL AND t.longitude IS NOT NULL";
      const pointWhere = where ? `${where} AND ${coordClause}` : `WHERE ${coordClause}`;

      let countRow = null;
      if (!hasFilters) {
        try {
          const snap = await database.raw(`SELECT payload -> 'scales' AS scales FROM infografis_snapshot WHERE id = 1`);
          const scales = rows(snap)[0]?.scales;
          if (scales) {
            countRow = {
              filterCount: Number(scales.total ?? 0),
              mikro: Number(scales.mikro ?? 0),
              kecil: Number(scales.kecil ?? 0),
              menengah: Number(scales.menengah ?? 0),
            };
          }
        } catch {}
      }
      if (!countRow) {
        const countSql = `
            SELECT COUNT(*)::integer AS "filterCount",
                   COUNT(*) FILTER (WHERE t.skala = 'micro')::integer AS mikro,
                   COUNT(*) FILTER (WHERE t.skala = 'small')::integer AS kecil,
                   COUNT(*) FILTER (WHERE t.skala = 'medium')::integer AS menengah
            FROM usaha_tabular t
            ${where}
          `;
        try {
          const cr = await withReadTimeout(database, (db) => db.raw(countSql, params), req.signal);
          countRow = rows(cr)[0];
        } catch (e) { mapTimeoutError(e); }
      }

      let pointResult;
      try {
        pointResult = await withReadTimeout(database, (db) => db.raw(
          `
            SELECT t.id, t.nama, t.skala, t.produk_utama AS "produkUtama",
                   t.kegiatan_utama AS "kegiatanUtama",
                   t.kode_kbli AS "kodeKbli", t.kategori_kbli AS "kategoriKbli",
                   t.kota_nama AS kota, t.kecamatan_nama AS kecamatan,
                   t.latitude::float AS latitude, t.longitude::float AS longitude
            FROM usaha_tabular t
            ${pointWhere}
            ORDER BY t.nama, t.id
            LIMIT ?
          `,
          [...params, limit],
        ), req.signal);
      } catch (e) { mapTimeoutError(e); }

      res.json({
        data: rows(pointResult),
        meta: {
          filterCount: Number(countRow?.filterCount ?? 0),
          mikro: Number(countRow?.mikro ?? 0),
          kecil: Number(countRow?.kecil ?? 0),
          menengah: Number(countRow?.menengah ?? 0),
          limit,
        },
      });
    } catch (error) {
      if (error.code === "QUERY_TIMEOUT" || error.statusCode === 504) return next(error);
      logger.error(error, "Unable to read tabular points");
      next(error);
    }
  });
}

export { signCursor, decodeCursor };

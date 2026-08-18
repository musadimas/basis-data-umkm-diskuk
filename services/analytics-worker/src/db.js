import pg from "pg";
const { Pool } = pg;
// Backfills process millions of source rows and must not inherit the short
// interactive-query budget. API endpoints enforce their own bounded timeout;
// cancelling worker statements after five seconds leaves no active generation
// and makes every analytics request return 503.
export function createPool(connectionString) { return new Pool({ connectionString, max: 8, application_name: "diskuk-analytics-worker" }); }
export async function withTransaction(pool, callback) { const client = await pool.connect(); try { await client.query("BEGIN"); const result = await callback(client); await client.query("COMMIT"); return result; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }

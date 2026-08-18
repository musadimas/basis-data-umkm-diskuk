import pg from "pg";
const { Pool } = pg;
export function createPool(connectionString) { return new Pool({ connectionString, max: 8, statement_timeout: 5000, application_name: "diskuk-analytics-worker" }); }
export async function withTransaction(pool, callback) { const client = await pool.connect(); try { await client.query("BEGIN"); const result = await callback(client); await client.query("COMMIT"); return result; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }

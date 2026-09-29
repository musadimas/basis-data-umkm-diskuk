export const applicationRole = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";
export const sourceFixture = { id: "11111111-1111-4111-8111-111111111111", status: "active", nama: "Toko Uji", kode_kbli: "47112", skala: "micro", owner_name: "Pemilik Uji", nik: "3273010101011234", telepon: "081234567890", birth_date: "1990-01-01", source_hash: "a".repeat(64) };
export function fakePool() { const calls=[]; return { calls, async query(sql, params=[]) { calls.push({sql,params}); return { rows: [], rowCount: 0 }; }, async connect() { return { query: async (sql,params=[]) => { calls.push({sql,params}); return {rows:[],rowCount:0}; }, release(){} }; } }; }

// Registry `analitik_field` aktif untuk semua dimensi + metrik shared; fake client
// tidak perlu menjawab query registry satu per satu (03 langkah 3h).
import sharedCompiler from "../../directus/analytics-shared/query-compiler.cjs";
import { queryAggregate } from "../src/exporter.js";
export const PROVINSI = { role: "provinsi", kotaId: null };
export const REGISTRY_ROWS = [
  ...new Set([...Object.keys(sharedCompiler.DIMENSIONS), ...Object.keys(sharedCompiler.METRICS)]),
].map((key) => ({ id: key, semantic_id: key, lifecycle_status: "active" }));
export function withRegistry(client) {
  return {
    async query(sql, params) {
      if (String(sql).includes("FROM analitik_field")) return { rows: REGISTRY_ROWS };
      return client.query(sql, params);
    },
  };
}
export function queryAgg(client, config, generationId, { operator = PROVINSI } = {}) {
  return queryAggregate(withRegistry(client), config, generationId, { operator });
}

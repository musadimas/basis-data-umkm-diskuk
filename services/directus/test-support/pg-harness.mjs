import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIRECTUS_ROOT = path.resolve(HERE, "..");
const MIGRATIONS_DIR = path.join(DIRECTUS_ROOT, "migrations");
const PNPM_DIR = path.join(DIRECTUS_ROOT, "node_modules", ".pnpm");
const TEMPLATE_DB = process.env.DISKUK_TEST_TEMPLATE_DB || "diskuk_test_template";
const DB_PREFIX = "diskuk_t_";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
let sequence = 0;

/** Isi folder migrations (nama terurut, byte digabung); harus sama dengan COMMENT template. */
export function migrationHash() {
  const hash = createHash("sha256");
  const names = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".js")).sort();
  for (const name of names) {
    const file = path.join(MIGRATIONS_DIR, name);
    if (statSync(file).isFile()) hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

export function pgUrl() {
  return (process.env.DISKUK_TEST_PG_URL || "").trim() || null;
}

/** Alasan skip untuk `test("…", { skip: pgSkipReason() }, …)`; false berarti tes boleh jalan. */
export function pgSkipReason() {
  return pgUrl()
    ? false
    : "DISKUK_TEST_PG_URL tidak diset; jalankan scripts/test-db-template.sh lalu ekspor variabelnya";
}

function pnpmRequire(name) {
  const entries = readdirSync(PNPM_DIR).filter((entry) => entry.startsWith(`${name}@`));
  if (!entries.length) throw new Error(`${name} tidak ada di ${PNPM_DIR}; jalankan pnpm install di services/directus`);
  const [dir] = entries.sort().reverse();
  return createRequire(path.join(DIRECTUS_ROOT, "package.json"))(path.join(PNPM_DIR, dir, "node_modules", name));
}

function knexInstance(connection) {
  const knex = pnpmRequire("knex");
  return knex({ client: "pg", connection, pool: { min: 0, max: 10 } });
}

/** Pool `pg` asli untuk kode yang memakai API Pool (klaim job worker dan sejenisnya). */
export function createPgPool(url = pgUrl(), options = {}) {
  if (!url) throw new Error("DISKUK_TEST_PG_URL tidak diset");
  const { Pool } = pnpmRequire("pg");
  return new Pool({ connectionString: url, max: 4, ...options });
}

function guardUrl(url) {
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DISKUK_TEST_PG_URL harus berupa postgres://");
  }
  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    throw new Error("DISKUK_TEST_PG_URL harus menunjuk 127.0.0.1 atau localhost (guard keamanan)");
  }
  return parsed;
}

/**
 * Kloning satu database dari template ter-migrasi (satu per file tes) dan kembalikan handle-nya.
 * Database di-drop lewat `drop()`; pakai `withDatabase(t)` bila ingin otomatis lewat `t.after`.
 */
export async function createTestDatabase() {
  const url = pgUrl();
  if (!url) throw new Error("DISKUK_TEST_PG_URL tidak diset");
  guardUrl(url);
  const admin = knexInstance(url);
  try {
    const meta = await admin.raw(
      "SELECT datistemplate, shobj_description(oid, 'pg_database') AS hash FROM pg_database WHERE datname = ?",
      [TEMPLATE_DB],
    );
    const row = meta.rows[0];
    if (!row) throw new Error(`template ${TEMPLATE_DB} belum ada; jalankan scripts/test-db-template.sh`);
    if (!row.datistemplate) {
      throw new Error(`database ${TEMPLATE_DB} ada tetapi bukan template; jalankan scripts/test-db-template.sh`);
    }
    const expected = migrationHash();
    if (String(row.hash || "") !== expected) {
      throw new Error(
        `template ${TEMPLATE_DB} basi (hash ${row.hash || "-"} != ${expected}); jalankan scripts/test-db-template.sh`,
      );
    }
    const name = `${DB_PREFIX}${process.pid}_${++sequence}`;
    await admin.raw("CREATE DATABASE ?? TEMPLATE ??", [name, TEMPLATE_DB]);
    const target = new URL(url);
    target.pathname = `/${name}`;
    const db = knexInstance(target.toString());
    return {
      db,
      name,
      url: target.toString(),
      async drop() {
        await db.destroy();
        await admin.raw("DROP DATABASE IF EXISTS ?? WITH (FORCE)", [name]);
        await admin.destroy();
      },
    };
  } catch (error) {
    await admin.destroy().catch(() => {});
    throw error;
  }
}

/** Varian untuk `test("…", async (t) => …)`: database di-drop otomatis oleh `t.after`. */
export async function withDatabase(context) {
  const created = await createTestDatabase();
  if (typeof context?.after === "function") context.after(() => created.drop());
  return created;
}

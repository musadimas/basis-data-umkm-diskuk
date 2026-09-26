// ADR-006 acceptance evidence: every migration grant to the Directus Public policy is a read with
// an explicit field allowlist, and collections holding personal or analytics data are never public.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const NEVER_PUBLIC = [
  "usaha", "pelaku_usaha", "alamat", "usaha_tabular", "usaha_legalitas", "directus_users",
  "talent_pengajuan", "talent_berita_acara", "program_peserta", "kpi_laporan", "kpi_laporan_bukti", "produk_loi",
];

async function publicGrants() {
  const grants = [];
  for (const name of (await readdir(MIGRATIONS)).filter((file) => file.endsWith(".js")).sort()) {
    const module = await import(new URL(name, MIGRATIONS));
    const statements = [];
    const recorder = {
      raw: async (sql, bindings = []) => {
        statements.push({ sql, bindings });
        return { rows: [] };
      },
      transaction: async (fn) => fn(recorder),
    };
    await module.up(recorder);
    for (const { sql, bindings } of statements) {
      if (!/INSERT INTO directus_permissions/i.test(sql) || !/role IS NULL AND a\."user" IS NULL/i.test(sql)) continue;
      grants.push({ migration: name, sql, bindings });
    }
  }
  return grants;
}

test("public grants are read-only allowlists and never touch private collections", async () => {
  const grants = await publicGrants();
  assert.ok(grants.length > 0, "expected the katalog public grants");
  for (const grant of grants) {
    const [collection, , fields] = grant.bindings;
    assert.match(grant.sql, /'read'/, `${grant.migration}: public grants must be read-only`);
    assert.equal(typeof fields, "string", `${grant.migration}: fields must be bound`);
    assert.ok(!fields.split(",").includes("*"), `${grant.migration}: ${collection} must not grant "*"`);
    assert.ok(!NEVER_PUBLIC.includes(collection), `${grant.migration}: ${collection} must never be public`);
    for (const forbidden of ["nik", "telepon", "email", "usaha", "uploaded_by", "filename_disk"]) {
      assert.ok(!fields.split(",").includes(forbidden), `${grant.migration}: ${collection}.${forbidden} must not be public`);
    }
  }
});

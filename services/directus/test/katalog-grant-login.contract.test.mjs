// BUG-021 acceptance evidence: signed-in users read the catalogue through their own policy, so the
// Public read rows are copied into the app and investor policies. The Public contract stays
// meaningful because these statements use the `pub` alias and never match its `a."user"` pattern.
import assert from "node:assert/strict";
import test from "node:test";

import { down, up } from "../migrations/20261001C-katalog-baca-pengguna-login.js";

const APP_POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";
const INVESTOR_POLICY_ID = "89167fa4-30ad-4aec-9d97-d5256d5518df";
const TARGETS = [APP_POLICY_ID, INVESTOR_POLICY_ID];
const KOLEKSI = ["produk", "produk_foto", "kota", "faq", "directus_files"];
const FILE_KATALOG = '{"folder":{"_eq":"6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10"}}';
// Same allowlist as public-grants.contract.test.mjs: these collections are never shared.
const NEVER_PUBLIC = [
  "usaha", "pelaku_usaha", "alamat", "usaha_tabular", "usaha_legalitas", "directus_users",
  "talent_pengajuan", "talent_berita_acara", "program_peserta", "kpi_laporan", "kpi_laporan_bukti", "produk_loi",
  "talent_passport", "konsultasi_tiket", "konsultasi_tiket_lampiran",
];

async function rekam(aksi) {
  const statements = [];
  const recorder = {
    raw: async (sql, bindings = []) => {
      statements.push({ sql, bindings });
      return { rows: [] };
    },
    transaction: async (fn) => fn(recorder),
  };
  await aksi(recorder);
  return statements;
}

test("grant baca katalog disalin dari Public ke policy aplikasi dan investor, idempoten", async () => {
  const statements = await rekam(up);
  assert.equal(statements.length, TARGETS.length * KOLEKSI.length);
  const disalin = new Set();
  for (const { sql, bindings } of statements) {
    assert.match(sql, /INSERT INTO directus_permissions/i);
    assert.match(sql, /'read'/);
    // Idempoten: baris yang sama pada (policy, collection, action, permissions) tidak digandakan.
    assert.match(sql, /NOT EXISTS \(/);
    assert.match(sql, /FROM directus_permissions p/);
    assert.match(sql, /pub\.role IS NULL AND pub\."user" IS NULL/);
    // Sumbernya baris Public, bukan grant Public itu sendiri: alias `pub` menjaga kontrak ADR-006.
    assert.doesNotMatch(sql, /role IS NULL AND a\."user" IS NULL/i);
    const [policy, collection, fileKatalog] = bindings;
    assert.ok(TARGETS.includes(policy), `${policy} bukan policy sasaran`);
    assert.ok(KOLEKSI.includes(collection), `${collection} di luar koleksi katalog`);
    assert.ok(!NEVER_PUBLIC.includes(collection), `${collection} tidak boleh pernah dibaca pengguna login`);
    assert.equal(fileKatalog, FILE_KATALOG, `${collection}: hanya folder katalog yang disalin untuk berkas`);
    disalin.add(`${policy}|${collection}`);
  }
  // 2 policy x 5 koleksi, tanpa pasangan yang terlewat atau berlebih.
  assert.deepEqual(
    [...disalin].sort(),
    TARGETS.flatMap((policy) => KOLEKSI.map((collection) => `${policy}|${collection}`)).sort(),
  );
});

test("down menghapus persis baris yang disalin dan tidak menyentuh baris uploaded_by", async () => {
  const statements = await rekam(down);
  assert.equal(statements.length, 2);
  for (const { sql, bindings } of statements) {
    assert.match(sql, /DELETE FROM directus_permissions/);
    for (const policy of TARGETS) assert.ok(bindings.includes(policy), `${policy} harus disebut`);
  }
  const [koleksi, berkas] = statements;
  for (const collection of ["produk", "produk_foto", "kota", "faq"]) assert.match(koleksi.sql, new RegExp(`'${collection}'`));
  assert.doesNotMatch(koleksi.sql, /directus_files/);
  assert.match(berkas.sql, /collection = 'directus_files'/);
  assert.equal(berkas.bindings.at(-1), FILE_KATALOG);
});

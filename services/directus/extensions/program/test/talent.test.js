import assert from "node:assert/strict";
import test from "node:test";
import registerTalent from "../src/endpoints/talent/index.js";
import { mountEndpoint } from "./helpers.js";

const ID = "5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11";

test("every talent route rejects anonymous and wrong-role callers before database access", async () => {
  const { call, routes, queries } = mountEndpoint(registerTalent);
  assert.equal(routes.length, 8);
  for (const { method, path } of routes) {
    const url = path.replace(/:\w+/g, ID);
    const anonymous = await call(method, url, { accountability: null });
    assert.equal(anonymous.nextError?.statusCode, 401, `${method} ${path}`);
    const wrongRole = await call(method, url, { accountability: { user: "u1", role: "other" } });
    assert.equal(wrongRole.nextError?.statusCode, 403, `${method} ${path}`);
  }
  assert.equal(queries.length, 0);
});

test("submission payloads are validated before any query", async () => {
  const { call, queries } = mountEndpoint(registerTalent);
  const cases = [
    { usaha: "not-a-uuid" },
    { usaha: ID, kesiapanLegalitas: { halal: "maybe" } },
    { usaha: ID, kesiapanLegalitas: { nib: "terbit" } },
    { usaha: ID, kapasitasProduksi: -1 },
    { usaha: ID, literasiQris: "yes" },
    { usaha: ID, suratKomitmen: "file.pdf" },
    { usaha: ID, satuan: "x".repeat(33) },
  ];
  for (const body of cases) {
    const { res } = await call("POST", "/pengajuan", { body });
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }
  const { res } = await call("POST", "/pengajuan", { body: [] });
  assert.equal(res.statusCode, 400);
  assert.equal(queries.length, 0);
});

test("a Berita Acara needs 1–200 valid submission ids", async () => {
  const { call, queries } = mountEndpoint(registerTalent);
  for (const pengajuan of [undefined, [], ["x"], Array.from({ length: 201 }, () => ID)]) {
    const { res } = await call("POST", "/berita-acara", { body: { pengajuan } });
    assert.equal(res.statusCode, 400);
  }
  assert.equal(queries.length, 0);
});

test("id arrays are bound as one JSON value, never expanded by knex", async () => {
  const other = "6b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a12";
  const queries = [];
  const db = {
    raw: async (sql, bindings) => {
      queries.push({ sql, bindings });
      if (sql.includes("FOR UPDATE")) return { rows: [{ id: ID, usaha: ID, status: "dinilai" }, { id: other, usaha: other, status: "dinilai" }] };
      if (sql.includes("INSERT INTO talent_berita_acara")) return { rows: [{ id: "ba", nomor: "BA-TS/2026/0001" }] };
      return { rows: [] };
    },
    transaction: async (fn) => fn(db),
  };
  const { call } = mountEndpoint(registerTalent, { database: db });
  const { res } = await call("POST", "/berita-acara", { body: { pengajuan: [ID, other, ID] } });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.jumlahPengajuan, 2);
  const lock = queries.find((q) => q.sql.includes("FOR UPDATE"));
  assert.deepEqual(lock.bindings, [JSON.stringify([ID, other])]);
  assert.ok(queries.every((q) => !q.sql.includes("ANY(")));
});

test("a missing referenced file is a 400, not a 500", async () => {
  const db = {
    raw: async (sql) => {
      if (sql.includes("FROM usaha u")) return { rows: [{ id: ID, nama: "x", nik: "3201234567890123" }] };
      if (sql.includes("INSERT INTO talent_pengajuan")) throw Object.assign(new Error("fk"), { code: "23503" });
      return { rows: [] };
    },
    transaction: async (fn) => fn(db),
  };
  const { call } = mountEndpoint(registerTalent, { database: db });
  const { res } = await call("POST", "/pengajuan", { body: { usaha: ID, suratKomitmen: ID } });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.errors[0].extensions.code, "INVALID_REFERENCE");
});

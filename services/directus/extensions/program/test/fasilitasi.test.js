import assert from "node:assert/strict";
import test from "node:test";
import register from "../src/endpoints/fasilitasi/index.js";
import { sisaKuota, statusPendaftaran } from "../src/endpoints/fasilitasi/service.js";
import { mountEndpoint } from "./helpers.js";
test("eight bentuk fixed; uang/barang/jasa filter", () => {
  assert.equal(sisaKuota({ kuota: 100, terisi: 37 }), 63);
  assert.equal(sisaKuota({ kuota: null, terisi: 0 }), null);
  assert.equal(sisaKuota({ kuota: 0, terisi: 0 }), 0);
  const now = new Date("2026-09-28T00:00:00Z");
  assert.equal(statusPendaftaran({ pendaftaran_mulai: null, pendaftaran_selesai: null }, now), "dibuka");
  assert.equal(statusPendaftaran({ pendaftaran_selesai: new Date("2026-09-27T00:00:00Z") }, now), "ditutup");
  assert.equal(statusPendaftaran({ pendaftaran_mulai: new Date("2026-09-29T00:00:00Z") }, now), "segera");
  assert.equal(statusPendaftaran({ kuota: 20, terisi: 20 }, now), "penuh");
  assert.equal(statusPendaftaran({ kuota: 20, terisi: 19 }, now), "dibuka");
  assert.equal(statusPendaftaran({ kuota: null, terisi: 5 }, now), "dibuka");
});
test("list: all eight cards, server countdown, official CTA only", async () => {
  const now = new Date();
  const cards = ["penghargaan", "beasiswa", "operasional", "sarpras_produksi", "sarpras_pemasaran", "revitalisasi_gedung", "permodalan", "lainnya"].map((bentuk, i) => ({ id: `id-${i}`, bentuk, judul: `Judul ${bentuk}`, ringkasan: null, bentuk_bantuan: i % 3 === 0 ? "uang" : i % 3 === 1 ? "barang" : "jasa", kuota: 100, terisi: 37, pendaftaran_mulai: null, pendaftaran_selesai: new Date(now.getTime() + 86400000).toISOString(), petunjuk: "Lihat kanal resmi.", kanal_resmi: "https://diskuk.example.invalid/bantuan" }));
  const db = { raw: async () => ({ rows: cards }), transaction: async (fn) => fn(db) };
  const { call } = mountEndpoint(register, { database: db });
  const res = await call("GET", "/", { accountability: null });
  assert.equal(res.res.statusCode, 200);
  assert.equal(res.res.body.data.items.length, 8);
  assert.equal(new Set(res.res.body.data.items.map((c) => c.bentuk)).size, 8);
  for (const card of res.res.body.data.items) {
    assert.equal(card.sisaKuota, 63);
    assert.ok(card.serverNow);
    assert.ok(card.petunjuk || card.kanalResmi);
  }
  const bad = await call("GET", "/", { accountability: null, query: { jenis: "emas" } });
  assert.equal(bad.res.body.errors[0].extensions.code, "INVALID_PAYLOAD");
});
test("zero quota and past deadline surface honestly", async () => {
  const db = { raw: async () => ({ rows: [{ id: "x", bentuk: "permodalan", judul: "Modal", ringkasan: null, bentuk_bantuan: "uang", kuota: 0, terisi: 0, pendaftaran_mulai: null, pendaftaran_selesai: new Date(Date.now() - 1000).toISOString(), petunjuk: "Habis.", kanal_resmi: null }] }), transaction: async (fn) => fn(db) };
  const { call } = mountEndpoint(register, { database: db });
  const res = await call("GET", "/", { accountability: null });
  assert.equal(res.res.body.data.items[0].sisaKuota, 0);
  assert.equal(res.res.body.data.items[0].statusPendaftaran, "ditutup");
});
test("kurasi terisi: staf provinsi saja, bulat, tidak melebihi kuota", async () => {
  const queries = [];
  const ID_BANTUAN = "5d0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c01";
  const row = { id: ID_BANTUAN, terisi: 40, kuota: 100 };
  const db = {
    raw: async (sql, bindings) => {
      queries.push({ sql, bindings });
      if (sql.includes("FROM directus_users")) return { rows: [{ id: "staf-provinsi", app_role: "provinsi", usaha: null, kota_scope: null }] };
      if (sql.includes("SELECT id, kuota FROM bantuan_fasilitasi")) return { rows: [{ id: ID_BANTUAN, kuota: 100 }] };
      if (sql.includes("UPDATE bantuan_fasilitasi SET terisi")) return { rows: [row] };
      return { rows: [] };
    },
    transaction: async (fn) => fn(db),
  };
  const { call, routes } = mountEndpoint(register, { database: db });
  const ada = routes.some((r) => r.method === "PATCH" && r.path === "/:id/terisi");
  assert.equal(ada, true);
  const res = await call("PATCH", `/${ID_BANTUAN}/terisi`, { body: { terisi: 40 } });
  assert.equal(res.res.statusCode, 200);
  assert.deepEqual(res.res.body.data, { id: ID_BANTUAN, terisi: 40, kuota: 100, sisaKuota: 60 });
  const lewat = await call("PATCH", `/${ID_BANTUAN}/terisi`, { body: { terisi: 101 } });
  assert.equal(lewat.res.body.errors[0].extensions.code, "TERISI_MELEBIHI_KUOTA");
  const pecahan = await call("PATCH", `/${ID_BANTUAN}/terisi`, { body: { terisi: 1.5 } });
  assert.equal(pecahan.res.body.errors[0].extensions.code, "INVALID_PAYLOAD");
});

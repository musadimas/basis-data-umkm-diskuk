import assert from "node:assert/strict";
import test from "node:test";
import registerKlinik from "../src/endpoints/klinik/index.js";
import { nomorTiket, sniffType, tanggalTidakValid } from "../src/endpoints/klinik/rules.js";
import { readRef, signRef } from "../src/endpoints/klinik/service.js";
import { mountEndpoint } from "./helpers.js";

const env = { SECRET: "unit-test-secret" };
const ID = "5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11";

test("bookable dates are weekdays from tomorrow to 30 days ahead, in Jakarta time", () => {
  const now = new Date("2026-09-25T18:00:00Z"); // Saturday 26 Sep 01:00 WIB
  assert.equal(tanggalTidakValid("2026-09-26", now), "TANGGAL_DI_LUAR_RENTANG");
  assert.equal(tanggalTidakValid("2026-09-27", now), "TANGGAL_AKHIR_PEKAN");
  assert.equal(tanggalTidakValid("2026-09-28", now), null);
  assert.equal(tanggalTidakValid("2026-10-26", now), null);
  assert.equal(tanggalTidakValid("2026-10-27", now), "TANGGAL_DI_LUAR_RENTANG");
  assert.equal(tanggalTidakValid("2026-02-30", now), "TANGGAL_TIDAK_VALID");
  assert.equal(tanggalTidakValid("besok", now), "TANGGAL_TIDAK_VALID");
});

test("ticket numbers use the Jakarta month and never truncate the counter", () => {
  assert.equal(nomorTiket(7, new Date("2026-09-30T18:00:00Z")), "KLN-2026-10-0007");
  assert.equal(nomorTiket(123456, new Date("2026-09-01T00:00:00Z")), "KLN-2026-09-123456");
});

test("attachments are recognised by content, not by name", () => {
  assert.equal(sniffType(Buffer.from("%PDF-1.7")), "application/pdf");
  assert.equal(sniffType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(sniffType(Buffer.from("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
  assert.equal(sniffType(Buffer.from("<html><script>")), null);
});

test("business references are signed, expire and cannot be forged", () => {
  const ref = signRef(env, ID, 1_000);
  assert.equal(readRef(env, ref, 2_000), ID);
  assert.equal(readRef(env, ref, 1_000 + 31 * 60_000), null);
  assert.equal(readRef({ SECRET: "other" }, ref, 2_000), null);
  const [id, exp, mac] = Buffer.from(ref, "base64url").toString().split(".");
  assert.equal(readRef(env, Buffer.from(`${"6" + id.slice(1)}.${exp}.${mac}`).toString("base64url"), 2_000), null);
  assert.equal(readRef(env, "garbage", 2_000), null);
});

test("only the kanban routes require a session", async () => {
  const { call, routes } = mountEndpoint(registerKlinik, { env });
  const guarded = routes.filter((route) => route.path.startsWith("/tiket") && !(route.method === "POST" && route.path === "/tiket"));
  assert.equal(guarded.length, 2);
  for (const { method, path } of guarded) {
    const { nextError } = await call(method, path.replace(/:\w+/g, ID), { accountability: null });
    assert.equal(nextError?.statusCode, 401, `${method} ${path}`);
  }
});

test("public inputs are validated before the captcha or any query", async () => {
  const { call, queries } = mountEndpoint(registerKlinik, { env });
  let { res } = await call("POST", "/lookup", { accountability: null, body: { jenis: "nib", nomor: "12" } });
  assert.equal(res.body.errors[0].extensions.code, "NOMOR_TIDAK_VALID");
  ({ res } = await call("POST", "/lookup", { accountability: null, body: { jenis: "email", nomor: "x" } }));
  assert.equal(res.statusCode, 400);
  ({ res } = await call("GET", "/slot", { accountability: null, query: { poli: "1", tanggal: "kemarin" } }));
  assert.equal(res.body.errors[0].extensions.code, "TANGGAL_TIDAK_VALID");
  ({ res } = await call("POST", "/tiket", { accountability: null, headers: { "content-type": "application/json" } }));
  assert.equal(res.statusCode, 400);
  assert.equal(queries.length, 0);
});

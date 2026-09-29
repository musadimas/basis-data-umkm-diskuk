import assert from "node:assert/strict";
import test from "node:test";
import registerKegiatan from "../src/endpoints/kegiatan/index.js";
import registerKlinik from "../src/endpoints/klinik/index.js";
import { samaRahasia, sendError } from "../src/lib/utils/http.js";
import { mountEndpoint } from "./helpers.js";

test("samaRahasia membandingkan rahasia secara timing-safe (B31)", () => {
  assert.equal(samaRahasia("rahasia-sama", "rahasia-sama"), true);
  assert.equal(samaRahasia("rahasia-benar", "rahasia-salah"), false);
  // Panjang berbeda tidak boleh melempar — rute job menjawab 403, bukan 500.
  assert.equal(samaRahasia("pendek", "jauh-lebih-panjang-dari-pendek"), false);
  assert.equal(samaRahasia("", ""), false);
  assert.equal(samaRahasia(null, "rahasia"), false);
  assert.equal(samaRahasia("rahasia", undefined), false);
});

test("rahasia job yang salah — termasuk beda panjang — dijawab 403, bukan 500 (B31)", async () => {
  const { call } = mountEndpoint(registerKegiatan, { env: { SECRET: "s", OPERASIONAL_INTERNAL_SECRET: "rahasia-internal" } });
  for (const secret of ["salah", "rahasia-internal-salah-lebih-panjang"]) {
    const { res } = await call("POST", "/pengingat/proses", {
      accountability: null,
      headers: { "x-operasional-internal-secret": secret },
    });
    assert.equal(res.statusCode, 403, secret);
    assert.equal(res.body.errors[0].extensions.code, "FORBIDDEN");
  }
});

test("callback resi klinik menolak rahasia beda panjang dengan 401 (B31)", async () => {
  const { call } = mountEndpoint(registerKlinik, { env: { OPERASIONAL_INTERNAL_SECRET: "receipt-secret" } });
  const { res } = await call("POST", "/notifikasi/receipt", {
    headers: { "x-diskuk-secret": "salah-lebih-panjang-dari-receipt-secret" },
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.errors[0].extensions.code, "FORBIDDEN");
});

test("sendError menghormati error DirectusError dari cakupan (01 langkah 2)", () => {
  const kirim = [];
  const res = { status(kode) { kirim.push(kode); return this; }, json(bodi) { kirim.push(bodi); }, setHeader() {} };
  const galat = Object.assign(new Error("di luar wilayah"), {
    name: "DirectusError",
    status: 404,
    statusCode: 404,
    code: "NOT_FOUND",
    extensions: { code: "NOT_FOUND", status: 404 },
  });
  sendError(res, { error() {} }, galat);
  assert.equal(kirim[0], 404);
  assert.equal(kirim[1].errors[0].extensions.code, "NOT_FOUND");
});

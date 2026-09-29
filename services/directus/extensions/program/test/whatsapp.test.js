import assert from "node:assert/strict";
import test from "node:test";
import { receiptStatus, sendWhatsApp, whatsappConfigured } from "../src/lib/whatsapp.js";

const GATEWAY = { WHATSAPP_GATEWAY_URL: "https://wa.example.test/send", WHATSAPP_GATEWAY_TOKEN: "token" };

const jawabFetch = (body, { ok = true, status = 200 } = {}) => async () => ({
  ok,
  status,
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});

test("a gateway is only configured when it has a URL", () => {
  assert.equal(whatsappConfigured({}), false);
  assert.equal(whatsappConfigured({ WHATSAPP_GATEWAY_URL: "  " }), false);
  assert.equal(whatsappConfigured(GATEWAY), true);
});

test("a 2xx response does not mean delivered while the provider needs a callback", async () => {
  const hasil = await sendWhatsApp({ ...GATEWAY, SECRET: "s" }, {
    tujuan: "6281234567890",
    template: "klinik_tiket_dibuat",
    text: "halo",
    fetchImpl: jawabFetch({ messageId: "msg-1", status: "delivered" }),
  });
  assert.deepEqual(hasil, { ok: true, provider: "http", messageId: "msg-1", status: "terkirim", providerStatus: "delivered", receipt: { messageId: "msg-1", status: "delivered" } });

  const bolehDariRespon = await sendWhatsApp({ ...GATEWAY, WHATSAPP_REQUIRE_CALLBACK: "false" }, {
    tujuan: "6281234567890",
    template: "klinik_tiket_dibuat",
    text: "halo",
    fetchImpl: jawabFetch({ id: 12, status: "read" }),
  });
  assert.equal(bolehDariRespon.status, "diterima");
  assert.equal(bolehDariRespon.messageId, "12");
});

test("provider failures and network errors are reported, never swallowed as sent", async () => {
  const tanpaGateway = await sendWhatsApp({}, { tujuan: "628", template: "t", text: "x" });
  assert.deepEqual(tanpaGateway, { ok: false, provider: null, error: "provider_not_configured" });

  const ditolak = await sendWhatsApp(GATEWAY, { tujuan: "628", template: "t", text: "x", fetchImpl: jawabFetch("nope", { ok: false, status: 500 }) });
  assert.equal(ditolak.ok, false);
  assert.equal(ditolak.error, "http_500");

  const putus = await sendWhatsApp(GATEWAY, { tujuan: "628", template: "t", text: "x", fetchImpl: async () => { throw new Error("boom"); } });
  assert.deepEqual({ ok: putus.ok, error: putus.error }, { ok: false, error: "network_error" });
});

test("receipt statuses map only to delivered or failed", () => {
  assert.equal(receiptStatus("delivered"), "diterima");
  assert.equal(receiptStatus("READ"), "diterima");
  assert.equal(receiptStatus("failed"), "gagal");
  assert.equal(receiptStatus("queued"), null);
  assert.equal(receiptStatus(undefined), null);
});

/**
 * WhatsApp gateway adapter for the public programme forms (klinik tickets).
 *
 * The brief asks for a WhatsApp notification when a consultation ticket is created, but the
 * provider name, sender number, templates and credentials are not available yet. The gateway is
 * therefore configured entirely through environment variables and reports itself as unconfigured
 * until they exist: the outbox then keeps the message as `pending` and the API says
 * "not provider-proven" instead of pretending a message was sent.
 *
 * Configuration:
 *   WHATSAPP_GATEWAY_URL          HTTP endpoint that accepts a JSON send request.
 *   WHATSAPP_GATEWAY_TOKEN        Bearer token for that endpoint.
 *   WHATSAPP_GATEWAY_PROVIDER     Short provider label stored with each outbox row (default "http").
 *   WHATSAPP_SENDER               Sender number/id the provider expects, when it needs one.
 *   WHATSAPP_REQUIRE_CALLBACK     "true" (default): a 2xx response only means the provider accepted
 *                                 the message; delivery is only marked after POST /notifikasi/receipt.
 *   WHATSAPP_RECEIPT_SECRET       Shared secret of that receipt callback (falls back to
 *                                 OPERASIONAL_INTERNAL_SECRET).
 *   WHATSAPP_TIMEOUT_MS           Request timeout (default 10000).
 */

const DEFAULT_TIMEOUT_MS = 10_000;
const DELIVERED = ["delivered", "read", "diterima", "terkirim"];
const REJECTED = ["failed", "undelivered", "rejected", "error", "gagal"];

export function whatsappConfig(env) {
  const url = String(env?.WHATSAPP_GATEWAY_URL ?? "").trim();
  return {
    url,
    token: String(env?.WHATSAPP_GATEWAY_TOKEN ?? "").trim(),
    provider: String(env?.WHATSAPP_GATEWAY_PROVIDER ?? "http").trim() || "http",
    sender: String(env?.WHATSAPP_SENDER ?? "").trim() || null,
    requireCallback: String(env?.WHATSAPP_REQUIRE_CALLBACK ?? "true").trim() !== "false",
    timeoutMs: Number(env?.WHATSAPP_TIMEOUT_MS) > 0 ? Number(env.WHATSAPP_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS,
  };
}

export function whatsappConfigured(env) {
  return whatsappConfig(env).url !== "";
}

export function receiptSecret(env) {
  const explicit = String(env?.WHATSAPP_RECEIPT_SECRET ?? "").trim();
  return explicit || String(env?.OPERASIONAL_INTERNAL_SECRET ?? "").trim();
}

/**
 * Sends one message and normalises the provider's answer.
 * Returns `{ ok, provider, messageId, status, error }`; `status` is an outbox status, never
 * "diterima" from a bare 2xx while `requireCallback` is on.
 */
export async function sendWhatsApp(env, { tujuan, template, text, payload = {}, fetchImpl = globalThis.fetch } = {}) {
  const config = whatsappConfig(env);
  if (!config.url) return { ok: false, provider: null, error: "provider_not_configured" };
  if (typeof fetchImpl !== "function") return { ok: false, provider: null, error: "fetch_unavailable" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const headers = { "content-type": "application/json" };
    if (config.token) headers.authorization = `Bearer ${config.token}`;
    const pesan = { to: tujuan, template, text };
    if (config.sender) pesan.sender = config.sender;
    pesan.params = payload;
    const response = await fetchImpl(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(pesan),
      signal: controller.signal,
    });
    const raw = await response.text().catch(() => "");
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }
    if (!response.ok) {
      return { ok: false, provider: config.provider, error: `http_${response.status}`, receipt: body };
    }
    const messageId = String(body?.messageId ?? body?.message_id ?? body?.id ?? "").slice(0, 160) || null;
    const reported = String(body?.status ?? "").toLowerCase();
    const status = DELIVERED.includes(reported) && !config.requireCallback ? "diterima" : "terkirim";
    return { ok: true, provider: config.provider, messageId, status, providerStatus: reported.slice(0, 64) || "accepted", receipt: body };
  } catch (error) {
    return { ok: false, provider: config.provider, error: error?.name === "AbortError" ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

/** Maps a provider receipt status to an outbox status: `diterima`, `gagal`, or null when unknown. */
export function receiptStatus(status) {
  const value = String(status ?? "").toLowerCase();
  if (DELIVERED.includes(value)) return "diterima";
  if (REJECTED.includes(value)) return "gagal";
  return null;
}

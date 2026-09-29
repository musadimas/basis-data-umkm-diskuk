import { createError, defineEventHandler, getRequestHeader, readBody } from "h3";

/**
 * Presensi QR e-pass (R03/N7-02). The scan endpoint is guarded by the shared
 * internal secret which must never reach the browser, so this server route keeps
 * it server-side and additionally requires a signed-in staff session: the cookie
 * is forwarded to /users/me and the app_role must be provinsi or kabkota.
 */
export default defineEventHandler(async (event) => {
  const panelUrl = (process.env.PANEL_URL ?? "").replace(/\/$/, "");
  const secret = process.env.OPERASIONAL_INTERNAL_SECRET;
  if (!panelUrl || !secret) throw createError({ statusCode: 503, statusMessage: "Pemindai presensi belum dikonfigurasi." });

  const cookie = getRequestHeader(event, "cookie");
  const meResponse = await fetch(`${panelUrl}/users/me`, { headers: cookie ? { cookie } : {} });
  if (!meResponse.ok) throw createError({ statusCode: 401, statusMessage: "Sesi tidak valid." });
  // SAFETY: bentuk balasan /users/me dari Directus; hanya `app_role` yang dibaca dan divalidasi lewat daftar peran di bawah.
  const me = (await meResponse.json()) as { data?: { app_role?: string | null } | null };
  if (!["provinsi", "kabkota"].includes(me.data?.app_role ?? "")) {
    throw createError({ statusCode: 403, statusMessage: "Pemindai hanya untuk staf." });
  }

  const body = await readBody(event);
  const scanResponse = await fetch(`${panelUrl}/v1/program/registrasi/pindai`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-operasional-internal-secret": secret },
    body: JSON.stringify({ qr: body?.qr, sesiKe: body?.sesiKe, petugas: me.data?.app_role === "kabkota" ? "panitia-kabkota" : "panitia-provinsi" }),
  });
  const payload = await scanResponse.text();
  return new Response(payload, {
    status: scanResponse.status,
    headers: { "content-type": scanResponse.headers.get("content-type") ?? "application/json", "cache-control": "private, no-store" },
  });
});

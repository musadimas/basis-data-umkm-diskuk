import {
  appendResponseHeader,
  createError,
  getRequestHeader,
  type H3Event,
} from "h3";
import { getSetCookies } from "./directus-proxy";
import { setPolicyCookies } from "./session-policy";

const UPSTREAM_TIMEOUT_MS = 15_000;

/**
 * Target Directus untuk sesi server-side.
 * - Strip mode (default): `prefix` kosong, `/panel` dipetakan ke root Directus.
 * - Passthrough mode (`NUXT_DIRECTUS_PROXY_TARGET` terisi): Directus dilayani
 *   di belakang `/panel`, sehingga prefix `/panel` dipertahankan.
 */
export function directusTarget() {
  const prefix = process.env.NUXT_DIRECTUS_PROXY_TARGET ? "/panel" : "";
  const base = (
    process.env.NUXT_DIRECTUS_PROXY_TARGET ||
    process.env.NUXT_DIRECTUS_INTERNAL_URL ||
    "http://directus:8055"
  ).replace(/\/$/, "");
  return { base, prefix };
}

/**
 * Login sesi Directus (mode "session") atas nama email/password yang sudah
 * diverifikasi pemanggil; cookie upstream diteruskan ke browser dan cookie
 * policy diset bila target tidak memakai prefix /panel.
 * Mengembalikan false bila kredensial ditolak (400/401).
 */
export async function loginDirectusSession(
  event: H3Event,
  email: string,
  password: string,
): Promise<boolean> {
  const { base, prefix } = directusTarget();
  const headers = new Headers({ "content-type": "application/json" });
  const forwardedFor = getRequestHeader(event, "x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  const userAgent = getRequestHeader(event, "user-agent");
  if (userAgent) headers.set("user-agent", userAgent);

  let response: Response;
  try {
    response = await fetch(`${base}${prefix}/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password, mode: "session" }),
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: "UPSTREAM_UNAVAILABLE" });
  }

  if (response.status === 400 || response.status === 401) return false;
  if (!response.ok)
    throw createError({ statusCode: 502, statusMessage: "UPSTREAM_UNAVAILABLE" });

  for (const cookie of getSetCookies(response.headers)) {
    if (cookie) appendResponseHeader(event, "set-cookie", cookie);
  }
  if (prefix === "") setPolicyCookies(event);
  return true;
}

/**
 * Panggilan server-to-server ke endpoint internal ekstensi operasional.
 * Body selalu kamus string → string (kontrak endpoint internal saat ini,
 * mis. `{ nib }`). Tidak pernah melempar error untuk status 4xx/5xx —
 * pemanggil memetakan statusnya sendiri. Kegagalan jaringan melempar 502.
 */
export async function callOperasionalInternal(
  event: H3Event,
  path: string,
  body: Record<string, string>,
): Promise<{ status: number; data?: unknown }> {
  const secret = process.env.OPERASIONAL_INTERNAL_SECRET;
  if (!secret || secret.length < 16)
    throw createError({
      statusCode: 503,
      statusMessage: "INTERNAL_SECRET_UNAVAILABLE",
    });

  const { base, prefix } = directusTarget();
  let response: Response;
  try {
    response = await fetch(`${base}${prefix}/operasional/internal/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-operasional-internal-secret": secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    throw createError({ statusCode: 502, statusMessage: "UPSTREAM_UNAVAILABLE" });
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = undefined;
  }
  return { status: response.status, data };
}

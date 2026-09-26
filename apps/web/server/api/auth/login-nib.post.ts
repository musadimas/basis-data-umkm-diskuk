import {
  createError,
  readBody,
  setResponseHeader,
  type H3Event,
} from "h3";
import { sameOriginMutation } from "../../utils/directus-proxy";
import {
  callOperasionalInternal,
  loginDirectusSession,
} from "../../utils/directus-session-login";

/**
 * Tulis respons error berbentuk Directus `{ errors: [...] }` langsung ke
 * response (pola setJsonError directus-proxy) agar bentuk body konsisten.
 */
function respondDirectusError(
  event: H3Event,
  statusCode: number,
  message: string,
  code: string,
) {
  event.node.res.statusCode = statusCode;
  setResponseHeader(event, "content-type", "application/json; charset=utf-8");
  setResponseHeader(event, "cache-control", "private, no-store");
  event.node.res.end(
    JSON.stringify({
      errors: [{ message, extensions: { code, status: statusCode } }],
    }),
  );
}

export default defineEventHandler(async (event: H3Event) => {
  if (!sameOriginMutation(event)) {
    respondDirectusError(
      event,
      403,
      "Permintaan tidak dapat diproses.",
      "ORIGIN_MISMATCH",
    );
    return;
  }

  // Normalisasi di batas I/O: apa pun yang dikirim klien dipaksa ke string,
  // lalu format NIB dan panjang sandi menjadi validator yang sesungguhnya.
  const body = await readBody<{ nib?: unknown; password?: unknown }>(event).catch(() => null);
  const nib = String(body?.nib ?? "").trim();
  const password = String(body?.password ?? "");
  if (
    !/^\d{13}$/.test(nib) ||
    password.length < 1 ||
    password.length > 256
  ) {
    respondDirectusError(
      event,
      400,
      "Permintaan tidak dapat diproses.",
      "VALIDATION_FAILED",
    );
    return;
  }

  // Pesan selalu generik: jangan bocorkan apakah NIB atau sandi yang salah.
  const invalidCredentials = () =>
    respondDirectusError(
      event,
      401,
      "NIB atau kata sandi tidak sesuai.",
      "INVALID_CREDENTIALS",
    );

  // Kegagalan jaringan / secret hilang melempar createError (502/503) yang
  // diteruskan apa adanya oleh Nitro.
  const resolved = await callOperasionalInternal(event, "resolve-nib", { nib });

  type ResolvePayload = { data?: { email?: unknown } };
  // SAFETY: kontrak resolve-nib adalah { data: { email } }; body non-JSON diubah
  // menjadi undefined oleh callOperasionalInternal, jadi assertion hanya memulihkan bentuk.
  const payload = resolved.data as ResolvePayload | undefined;
  const email = String(payload?.data?.email ?? "");

  if (resolved.status === 404) return invalidCredentials();
  if (
    resolved.status === 400 ||
    resolved.status === 403 ||
    resolved.status === 503
  ) {
    respondDirectusError(
      event,
      resolved.status,
      "Permintaan tidak dapat diproses.",
      "UPSTREAM_REJECTED",
    );
    return;
  }
  if (resolved.status < 200 || resolved.status >= 300 || !email.includes("@")) {
    throw createError({ statusCode: 502, statusMessage: "UPSTREAM_UNAVAILABLE" });
  }

  const loggedIn = await loginDirectusSession(event, email, password);
  if (!loggedIn) return invalidCredentials();

  setResponseHeader(event, "cache-control", "private, no-store");
  return { data: { ok: true } };
});

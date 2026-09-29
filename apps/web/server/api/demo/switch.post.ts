import { pbkdf2, solveChallenge } from "altcha/lib";
import { createError, defineEventHandler, getHeader, readBody, appendResponseHeader } from "h3";

const DEMO_EMAIL = {
  provinsi: "dummy_admin@diskuk.jabarprov.go.id",
  kabkota: "dummy_admin.subang@jabarprov.go.id",
  pendamping: "dummy_coach.pendamping@jabarprov.go.id",
  umkm: "dummy_wawan.leathercraft@gmail.com",
} as const;

type DemoRole = keyof typeof DEMO_EMAIL;
const DEMO_EMAIL_BY_ROLE: ReadonlyMap<string, string> = new Map(Object.entries(DEMO_EMAIL));

/** Disposable, loopback-only session switch. Password and session token never enter the bundle. */
export default defineEventHandler(async (event) => {
  const hostHeader = getHeader(event, "host") ?? "";
  const host = hostHeader.split(":")[0] ?? "";
  const origin = getHeader(event, "origin") ?? "";
  let originUrl: URL;
  try { originUrl = new URL(origin); } catch { throw createError({ statusCode: 403 }); }
  if (
    process.env.DEMO_MODE !== "true" || process.env.DEMO_DISPOSABLE !== "true" ||
    !["localhost", "127.0.0.1"].includes(host) || originUrl.host !== hostHeader ||
    !["http:", "https:"].includes(originUrl.protocol) ||
    !process.env.DEMO_ACCOUNT_PASSWORD || process.env.DEMO_ACCOUNT_PASSWORD.length < 12 ||
    !getHeader(event, "content-type")?.startsWith("application/json")
  ) throw createError({ statusCode: 403, statusMessage: "Mode demo tidak tersedia" });

  const body = await readBody<{ role?: DemoRole }>(event);
  const role = body?.role;
  const email = role ? DEMO_EMAIL_BY_ROLE.get(role) : undefined;
  if (!role || !email) throw createError({ statusCode: 400, statusMessage: "Peran demo tidak valid" });

  const panelUrl = process.env.PANEL_URL;
  if (!panelUrl) throw createError({ statusCode: 503, statusMessage: "Sesi demo belum tersedia" });
  let panel: URL;
  try { panel = new URL(panelUrl); } catch { throw createError({ statusCode: 503, statusMessage: "Sesi demo belum tersedia" }); }
  if (!["http:", "https:"].includes(panel.protocol) || panel.pathname !== "/" || panel.search || panel.hash) {
    throw createError({ statusCode: 503, statusMessage: "Sesi demo belum tersedia" });
  }

  const challengeResponse = await fetch(new URL("/v1/auth/captcha/challenge", panel), { headers: { accept: "application/json" } });
  if (!challengeResponse.ok) throw createError({ statusCode: 503, statusMessage: "Sesi demo belum tersedia" });
  // SAFETY: the response comes from the configured Directus CAPTCHA challenge endpoint;
  // solveChallenge validates its protocol fields and returns null for an unsolvable challenge.
  const challenge = await challengeResponse.json() as Parameters<typeof solveChallenge>[0]["challenge"];
  const solution = await solveChallenge({ challenge, deriveKey: pbkdf2.deriveKey, timeout: 30_000 });
  if (!solution) throw createError({ statusCode: 503, statusMessage: "Sesi demo belum tersedia" });
  const captcha = Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");

  const loginResponse = await fetch(new URL("/auth/login", panel), {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email, password: process.env.DEMO_ACCOUNT_PASSWORD, captcha, mode: "session" }),
  });
  if (!loginResponse.ok) throw createError({ statusCode: 503, statusMessage: "Sesi demo belum tersedia" });
  const cookies = loginResponse.headers.getSetCookie();
  if (!cookies.some((cookie) => cookie.startsWith(`${process.env.DIRECTUS_SESSION_COOKIE_NAME || "diskuk_session"}=`))) {
    throw createError({ statusCode: 503, statusMessage: "Sesi demo belum tersedia" });
  }
  for (const cookie of cookies) appendResponseHeader(event, "set-cookie", cookie);
  appendResponseHeader(event, "cache-control", "private, no-store");
  return { data: { role } };
});

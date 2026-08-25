import { createHmac, timingSafeEqual } from "node:crypto";
import { deleteCookie, getCookie, setCookie, type H3Event } from "h3";

export const SESSION_STARTED_COOKIE = "diskuk_session_started";
export const SESSION_ACTIVITY_COOKIE = "diskuk_session_last_activity";
export const SESSION_ABSOLUTE_MAX_MS = 8 * 60 * 60 * 1000;
export const SESSION_IDLE_MAX_MS = 30 * 60 * 1000;
export const DEFAULT_RETURN_TO = "/dashboard";

const base64Url = (value: Buffer) => value.toString("base64url");
const fromBase64Url = (value: string) => Buffer.from(value, "base64url");

function secretValue(secret = process.env.NUXT_SESSION_POLICY_SECRET) {
  if (!secret || secret.length < 16)
    throw new Error("Session policy secret is not configured");
  return secret;
}

export function signPolicyValue(
  cookieName: string,
  issuedAt: number,
  secret?: string,
) {
  const payload = `${cookieName}.${issuedAt}`;
  return `${issuedAt}.${base64Url(createHmac("sha256", secretValue(secret)).update(payload).digest())}`;
}

export function verifyPolicyValue(
  cookieName: string,
  value: string | undefined,
  secret?: string,
) {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const timestamp = parts[0]!;
  const signature = parts[1]!;
  if (!/^\d+$/.test(timestamp) || !/^[A-Za-z0-9_-]{40,}$/.test(signature))
    return null;
  const issuedAt = Number(timestamp);
  if (!Number.isSafeInteger(issuedAt) || issuedAt <= 0) return null;
  try {
    const signed = signPolicyValue(cookieName, issuedAt, secret);
    const expected = fromBase64Url(signed.slice(signed.indexOf(".") + 1));
    const actual = fromBase64Url(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return null;
    return issuedAt;
  } catch {
    return null;
  }
}

export function createPolicyCookies(now = Date.now(), secret?: string) {
  const issuedAt = Math.floor(now / 1000);
  return {
    started: signPolicyValue(SESSION_STARTED_COOKIE, issuedAt, secret),
    activity: signPolicyValue(SESSION_ACTIVITY_COOKIE, issuedAt, secret),
  };
}

export type SessionPolicyResult =
  | { valid: true; startedAt: number; lastActivityAt: number }
  | { valid: false; reason: "missing" | "tampered" | "idle" | "absolute" };

export function evaluateSessionPolicy(
  cookies: { started?: string; activity?: string },
  now = Date.now(),
  secret?: string,
): SessionPolicyResult {
  const started = verifyPolicyValue(
    SESSION_STARTED_COOKIE,
    cookies.started,
    secret,
  );
  const activity = verifyPolicyValue(
    SESSION_ACTIVITY_COOKIE,
    cookies.activity,
    secret,
  );
  if (started === null || activity === null)
    return {
      valid: false,
      reason: cookies.started || cookies.activity ? "tampered" : "missing",
    };
  const nowSeconds = Math.floor(now / 1000);
  if (nowSeconds - started >= SESSION_ABSOLUTE_MAX_MS / 1000)
    return { valid: false, reason: "absolute" };
  if (nowSeconds - activity >= SESSION_IDLE_MAX_MS / 1000)
    return { valid: false, reason: "idle" };
  if (activity < started) return { valid: false, reason: "tampered" };
  return { valid: true, startedAt: started, lastActivityAt: activity };
}

export function setPolicyCookies(event: H3Event, now = Date.now()) {
  const cookies = createPolicyCookies(now);
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.SESSION_COOKIE_SECURE !== "false",
    path: "/",
    maxAge: SESSION_ABSOLUTE_MAX_MS / 1000,
  };
  setCookie(event, SESSION_STARTED_COOKIE, cookies.started, options);
  setCookie(event, SESSION_ACTIVITY_COOKIE, cookies.activity, options);
}

export function refreshActivityCookie(event: H3Event, now = Date.now()) {
  const cookie = signPolicyValue(
    SESSION_ACTIVITY_COOKIE,
    Math.floor(now / 1000),
  );
  setCookie(event, SESSION_ACTIVITY_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.SESSION_COOKIE_SECURE !== "false",
    path: "/",
    maxAge: SESSION_ABSOLUTE_MAX_MS / 1000,
  });
}

export function clearPolicyCookies(event: H3Event) {
  for (const name of [SESSION_STARTED_COOKIE, SESSION_ACTIVITY_COOKIE]) {
    deleteCookie(event, name, { path: "/" });
  }
}

export function readPolicyFromEvent(event: H3Event) {
  return evaluateSessionPolicy({
    started: getCookie(event, SESSION_STARTED_COOKIE),
    activity: getCookie(event, SESSION_ACTIVITY_COOKIE),
  });
}

export function safeReturnTo(value: string): string {
  if (
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return DEFAULT_RETURN_TO;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes("\\") || decoded.startsWith("//"))
      return DEFAULT_RETURN_TO;
    const parsed = new URL(decoded, "https://dashboard.invalid");
    if (
      !(
        parsed.pathname === "/dashboard" ||
        parsed.pathname.startsWith("/dashboard/")
      )
    )
      return DEFAULT_RETURN_TO;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}

export function isPrivatePanelPath(pathname: string) {
  return pathname === "/panel" || pathname.startsWith("/panel/");
}

export function isLoginPath(pathname: string) {
  return pathname === "/panel/auth/login";
}

export function isRefreshPath(pathname: string) {
  return pathname === "/panel/auth/refresh";
}

export function isLogoutPath(pathname: string) {
  return pathname === "/panel/auth/logout";
}

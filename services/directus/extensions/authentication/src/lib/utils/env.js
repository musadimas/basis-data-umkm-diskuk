import { CAPTCHA_DEFAULT_COST, DEFAULT_LOGIN_STALL_MS } from "../constants.js";

/** Reads a boolean-ish env value ("false", "0", "off", "no" are false). */
export function envFlag(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return !["false", "0", "off", "no"].includes(String(value).toLowerCase());
}

export function captchaEnforced(env) {
  return envFlag(env?.AUTH_CAPTCHA_ENFORCE, true);
}

function originOf(value) {
  try {
    const origin = new URL(String(value)).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

/**
 * Parses a comma list of origins. Unset/empty falls back to the origin of PUBLIC_URL;
 * "none" means no origins at all.
 */
function originList(configured, env) {
  if (configured === undefined || configured === null || configured === "") {
    const publicOrigin = originOf(env?.PUBLIC_URL);
    return publicOrigin ? [publicOrigin] : [];
  }
  if (String(configured).trim().toLowerCase() === "none") return [];
  return String(configured)
    .split(",")
    .map((value) => originOf(value.trim()))
    .filter(Boolean);
}

function originIn(list, origin) {
  const requestOrigin = origin ? originOf(origin) : null;
  return Boolean(requestOrigin) && list.includes(requestOrigin);
}

/**
 * Origins allowed to log in / request a password reset without a captcha, e.g. the Directus
 * Data Studio, which has no captcha widget. AUTH_CAPTCHA_EXEMPT_ORIGINS is a comma list;
 * unset defaults to the origin of PUBLIC_URL, and "none" disables the exemption.
 *
 * The Origin header is forgeable by non-browser clients, so this trades captcha protection
 * for those origins; Directus' own login-attempt lockout still applies.
 */
export function captchaExemptOrigins(env) {
  return originList(env?.AUTH_CAPTCHA_EXEMPT_ORIGINS, env);
}

export function isCaptchaExemptOrigin(env, origin) {
  return originIn(captchaExemptOrigins(env), origin);
}

/**
 * Origins whose pages may change data with the session cookie (CSRF protection, ADR-001 #9):
 * the web app and the Data Studio. AUTH_ALLOWED_ORIGINS is a comma list; unset defaults to
 * the origin of PUBLIC_URL. Browsers set the Origin header themselves, so another site cannot
 * pass this check through a user's browser.
 */
export function allowedRequestOrigins(env) {
  return originList(env?.AUTH_ALLOWED_ORIGINS, env);
}

export function isAllowedRequestOrigin(env, origin) {
  return originIn(allowedRequestOrigins(env), origin);
}

export function captchaCost(env) {
  const cost = Number(env?.AUTH_CAPTCHA_COST);
  return Number.isSafeInteger(cost) && cost >= 1 && cost <= 1_000_000 ? cost : CAPTCHA_DEFAULT_COST;
}

export function loginStallMs(env) {
  const value = Number(env?.LOGIN_STALL_TIME);
  return Number.isFinite(value) && value >= 0 && value <= 5000 ? value : DEFAULT_LOGIN_STALL_MS;
}

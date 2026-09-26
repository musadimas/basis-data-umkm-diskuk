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

export function captchaCost(env) {
  const cost = Number(env?.AUTH_CAPTCHA_COST);
  return Number.isSafeInteger(cost) && cost >= 1 && cost <= 1_000_000 ? cost : CAPTCHA_DEFAULT_COST;
}

export function loginStallMs(env) {
  const value = Number(env?.LOGIN_STALL_TIME);
  return Number.isFinite(value) && value >= 0 && value <= 5000 ? value : DEFAULT_LOGIN_STALL_MS;
}

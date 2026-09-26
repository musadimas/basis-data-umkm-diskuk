// ── Captcha (ALTCHA) ─────────────────────────────────────────────────────────
export const CAPTCHA_ALGORITHM = "PBKDF2/SHA-256";
export const CAPTCHA_TTL_SECONDS = 300;
export const CAPTCHA_DEFAULT_COST = 5000;
export const CAPTCHA_MAX_PAYLOAD_LENGTH = 4096;
/** Label used to derive the captcha HMAC key from the Directus SECRET. */
export const CAPTCHA_SECRET_LABEL = "diskuk-auth-captcha-v1";

// ── Identity & passwords ────────────────────────────────────────────────────
export const NIB_RE = /^\d{13}$/;
export const PASSWORD_MIN = 10;
export const DEFAULT_LOGIN_STALL_MS = 500;

// ── Activity log & audit ────────────────────────────────────────────────────
export const ACTIVITY_PAGE_DEFAULT = 20;
export const ACTIVITY_PAGE_MAX = 50;
export const AUDIT_RETENTION = "1 year";

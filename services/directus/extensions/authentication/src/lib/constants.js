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

// ── Session policy (ADR-001: idle timeout + absolute lifetime) ─────────────
export const SESSION_IDLE_DEFAULT = "30m";
export const SESSION_MAX_AGE_DEFAULT = "8h";
/** Write date_updated at most this often per session to keep request overhead low. */
export const SESSION_TOUCH_INTERVAL_MS = 60_000;
export const DURATION_UNITS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

// ── Activity log & audit ────────────────────────────────────────────────────
export const ACTIVITY_PAGE_DEFAULT = 20;
export const ACTIVITY_PAGE_MAX = 50;
export const AUDIT_RETENTION = "1 year";

import { describe, expect, it, beforeEach } from "vitest";
import { createPolicyCookies, evaluateSessionPolicy, safeReturnTo, signPolicyValue } from "../../server/utils/session-policy";
const secret = "unit-test-session-policy-secret";
beforeEach(() => { process.env.NUXT_SESSION_POLICY_SECRET = secret; });
describe("session policy", () => {
  it("accepts a fresh signed pair and rejects tampering", () => {
    const now = Date.parse("2026-08-16T00:00:00Z"); const cookies = createPolicyCookies(now, secret);
    expect(evaluateSessionPolicy(cookies, now + 29 * 60 * 1000, secret).valid).toBe(true);
    expect(evaluateSessionPolicy({ ...cookies, activity: `${cookies.activity}x` }, now, secret).valid).toBe(false);
  });
  it("denies exact idle and absolute boundaries", () => {
    const now = Date.parse("2026-08-16T00:00:00Z"); const cookies = createPolicyCookies(now, secret);
    expect(evaluateSessionPolicy(cookies, now + 30 * 60 * 1000, secret)).toMatchObject({ valid: false, reason: "idle" });
    const recent = signPolicyValue("diskuk_session_last_activity", Math.floor((now + (7 * 60 * 60 + 59 * 60 + 59) * 1000) / 1000), secret);
    expect(evaluateSessionPolicy({ started: cookies.started, activity: recent }, now + 8 * 60 * 60 * 1000, secret)).toMatchObject({ valid: false, reason: "absolute" });
  });
  it("accepts only local dashboard return paths", () => {
    expect(safeReturnTo("/dashboard/analitik?visual=bar#table")).toBe("/dashboard/analitik?visual=bar#table");
    for (const value of ["//evil.example", "https://evil.example", "/dashboardevil", "/dashboard/%5C%5Cevil"]) expect(safeReturnTo(value)).toBe("/dashboard");
  });
});

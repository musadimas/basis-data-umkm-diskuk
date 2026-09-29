import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import activity from "../src/endpoints/activity/index.js";
import captcha from "../src/endpoints/captcha/index.js";
import { APPLICATION_ROLE_ID, TEST_ENV, call, mountEndpoints, silentLogger } from "./helpers.js";

const { tandaCakupan, ALL_ROLES } = createRequire(import.meta.url)("../../../analytics-shared/cakupan.cjs");

function setup({ activityRows = [], appRole = "umkm" } = {}) {
  const database = {
    raw: async (sql, bindings = []) => {
      if (sql.includes("FROM directus_users WHERE id")) {
        return { rows: [{ id: bindings[0], app_role: appRole, usaha: null, kota_scope: null }] };
      }
      if (sql.includes("FROM auth_login_audit")) {
        const [, , limit, offset] = bindings;
        return { rows: activityRows.slice(offset, offset + limit) };
      }
      return { rows: [] };
    },
  };
  return mountEndpoints(
    { "v1/auth/captcha": captcha, "v1/auth/activity": activity },
    { database, env: TEST_ENV, logger: silentLogger },
  );
}

const signedIn = { accountability: { user: "user-1", role: APPLICATION_ROLE_ID, ip: "10.0.0.7" } };

test("captcha challenge is signed, expiring, and not cacheable", async () => {
  const routes = setup();
  const { res } = await call(routes, "GET /v1/auth/captcha/challenge");
  assert.equal(res.headers["cache-control"], "private, no-store");
  assert.equal(res.body.parameters.algorithm, "PBKDF2/SHA-256");
  assert.ok(res.body.parameters.expiresAt > Date.now() / 1000);
  assert.match(res.body.signature, /^[0-9a-f]{64}$/);
});

test("activity log requires authentication and paginates", async () => {
  const activityRows = Array.from({ length: 3 }, (_, index) => ({ kind: "session", action: "login", timestamp: `2026-09-2${index}` }));
  const routes = setup({ activityRows });
  const anonymous = await call(routes, "GET /v1/auth/activity");
  assert.equal(anonymous.nextError.statusCode, 401);

  const first = await call(routes, "GET /v1/auth/activity", { ...signedIn, query: { limit: "2", page: "1" } });
  assert.equal(first.res.body.data.items.length, 2);
  assert.deepEqual(first.res.body.data.meta, { page: 1, limit: 2, hasMore: true });
  const second = await call(routes, "GET /v1/auth/activity", { ...signedIn, query: { limit: "2", page: "2" } });
  assert.deepEqual(second.res.body.data.meta, { page: 2, limit: 2, hasMore: false });
});

test("routes are marked by the Cakupan adapters (captcha publik, activity terjaga untuk semua peran)", () => {
  const routes = setup();
  assert.equal(tandaCakupan(routes["GET /v1/auth/captcha/challenge"])?.jenis, "publik");
  assert.deepEqual(tandaCakupan(routes["GET /v1/auth/activity"]), { jenis: "terjaga", peran: ALL_ROLES });
});

test("activity log rejects an account without app_role (fail-closed, no default role)", async () => {
  const routes = setup({ appRole: null });
  const { res, nextError } = await call(routes, "GET /v1/auth/activity", signedIn);
  assert.equal(nextError.statusCode, 403);
  assert.equal(res.body, undefined);
});

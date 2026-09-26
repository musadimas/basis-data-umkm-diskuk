import assert from "node:assert/strict";
import test from "node:test";
import registerSessionGuard from "../src/hooks/session-guard.js";
import { TEST_ENV, fakeResponse, silentLogger } from "./helpers.js";

const MINUTE = 60_000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();

/** In-memory stand-in for directus_sessions with the date_created / date_updated columns. */
function fakeDatabase() {
  const sessions = new Map();
  return {
    sessions,
    raw: async (sql, bindings = []) => {
      if (sql.startsWith("SELECT date_created, date_updated FROM directus_sessions")) {
        const row = sessions.get(bindings[0]);
        return { rows: row ? [row] : [] };
      }
      if (sql.includes("SET date_created = previous.date_created")) {
        const current = sessions.get(bindings[0]);
        const previous = [...sessions.values()].find((row) => row.next_token === bindings[0]);
        if (current && previous) current.date_created = previous.date_created;
        return { rows: [] };
      }
      if (sql.startsWith("UPDATE directus_sessions SET date_updated")) {
        sessions.get(bindings[0]).date_updated = new Date().toISOString();
        return { rows: [] };
      }
      if (sql.startsWith("DELETE FROM directus_sessions")) {
        sessions.delete(bindings[0]);
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

function setup(env = TEST_ENV) {
  const database = fakeDatabase();
  const handlers = {};
  let middleware;
  registerSessionGuard(
    {
      init: (event, handler) => event === "routes.before" && handler({ app: { use: (fn) => (middleware = fn) } }),
      filter: (event, handler) => (handlers[event] = handler),
    },
    { database, env: { ...env, SESSION_COOKIE_NAME: "diskuk_session" }, logger: silentLogger },
  );
  const run = async (path, token, { method = "GET", origin } = {}) => {
    const res = fakeResponse();
    res.clearCookie = (name) => (res.cleared = name);
    let passed = false;
    const req = {
      path,
      method,
      headers: origin ? { origin } : {},
      accountability: token ? { user: "user-1", session: token } : { user: null },
    };
    await middleware(req, res, () => {
      passed = true;
    });
    return { res, passed };
  };
  return { database, filter: handlers["auth.jwt"], run };
}

test("refresh carries the original start time to the rotated session row", async () => {
  const { database, filter } = setup();
  const started = ago(3 * 60 * MINUTE);
  database.sessions.set("token-a", { date_created: started, date_updated: ago(MINUTE), next_token: "token-b" });
  database.sessions.set("token-b", { date_created: ago(0), date_updated: ago(0) });
  const payload = { id: "user-1", session: "token-b" };
  assert.equal(await filter(payload, { type: "refresh", user: "user-1" }, {}), payload);
  assert.equal(database.sessions.get("token-b").date_created, started);
});

test("login needs no filter work: date_created defaults to the insert time", async () => {
  const { database, filter } = setup();
  const payload = { id: "user-1", session: "token-a" };
  assert.equal(await filter(payload, { type: "login", user: "user-1" }, {}), payload);
  assert.equal(database.sessions.size, 0);
});

test("an active session passes and its last activity is refreshed", async () => {
  const { database, run } = setup();
  database.sessions.set("token-a", { date_created: ago(60 * MINUTE), date_updated: ago(5 * MINUTE) });
  const { passed } = await run("/v1/analytics/infographic/", "token-a");
  assert.equal(passed, true);
  assert.ok(Date.now() - new Date(database.sessions.get("token-a").date_updated).getTime() < MINUTE);
});

test("a session idle for 30 minutes is revoked with 401 TOKEN_EXPIRED", async () => {
  const { database, run } = setup();
  database.sessions.set("token-a", { date_created: ago(60 * MINUTE), date_updated: ago(31 * MINUTE) });
  const { res, passed } = await run("/users/me", "token-a");
  assert.equal(passed, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.errors[0].extensions.code, "TOKEN_EXPIRED");
  assert.equal(res.body.errors[0].extensions.reason, "idle");
  assert.equal(res.cleared, "diskuk_session");
  assert.equal(database.sessions.has("token-a"), false);
});

test("a session older than 8 hours is revoked even while active", async () => {
  const { run, database } = setup();
  database.sessions.set("token-a", { date_created: ago(8 * 60 * MINUTE + MINUTE), date_updated: ago(MINUTE) });
  const { res } = await run("/users/me", "token-a");
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.errors[0].extensions.reason, "expired");
});

test("refresh is checked, but sign-in/sign-out/reset routes are not", async () => {
  const { database, run } = setup();
  database.sessions.set("token-a", { date_created: ago(60 * MINUTE), date_updated: ago(45 * MINUTE) });
  for (const path of ["/auth/login", "/auth/logout", "/auth/password/request"]) {
    assert.equal((await run(path, "token-a")).passed, true, path);
  }
  assert.equal((await run("/auth/refresh", "token-a")).res.statusCode, 401);
});

test("requests without a session, or with no session row, pass through", async () => {
  const { run } = setup();
  assert.equal((await run("/users/me", null)).passed, true);
  assert.equal((await run("/users/me", "unknown-token")).passed, true);
});

test("limits follow AUTH_SESSION_IDLE_TIMEOUT and AUTH_SESSION_MAX_AGE", async () => {
  const { database, run } = setup({ ...TEST_ENV, AUTH_SESSION_IDLE_TIMEOUT: "2h", AUTH_SESSION_MAX_AGE: "12h" });
  database.sessions.set("token-a", { date_created: ago(10 * 60 * MINUTE), date_updated: ago(90 * MINUTE) });
  assert.equal((await run("/users/me", "token-a")).passed, true);
});

test("session-cookie mutations must come from an allowed origin (CSRF)", async () => {
  const env = { ...TEST_ENV, AUTH_ALLOWED_ORIGINS: "http://localhost:3000, http://localhost:8055" };
  const { database, run } = setup(env);
  database.sessions.set("token-a", { date_created: ago(MINUTE), date_updated: ago(0) });

  const forged = await run("/items/usaha/1", "token-a", { method: "PATCH", origin: "https://evil.example" });
  assert.equal(forged.passed, false);
  assert.equal(forged.res.statusCode, 403);
  assert.equal(forged.res.body.errors[0].extensions.code, "ORIGIN_NOT_ALLOWED");

  for (const origin of [undefined, "null"]) {
    assert.equal((await run("/users/me", "token-a", { method: "PATCH", origin })).res.statusCode, 403, String(origin));
  }
  assert.equal((await run("/users/me", "token-a", { method: "PATCH", origin: "http://localhost:3000" })).passed, true);
  assert.equal((await run("/items/analitik_view", "token-a", { method: "POST", origin: "http://localhost:8055" })).passed, true);
});

test("the origin check skips reads, requests without a session, and sign-in routes", async () => {
  const { database, run } = setup({ ...TEST_ENV, PUBLIC_URL: "https://diskuk.example" });
  database.sessions.set("token-a", { date_created: ago(MINUTE), date_updated: ago(0) });
  assert.equal((await run("/users/me", "token-a", { method: "GET", origin: "https://evil.example" })).passed, true);
  assert.equal((await run("/items/usaha", null, { method: "POST", origin: "https://evil.example" })).passed, true);
  assert.equal((await run("/auth/login", "token-a", { method: "POST", origin: "https://evil.example" })).passed, true);
  // Unset AUTH_ALLOWED_ORIGINS falls back to PUBLIC_URL's origin.
  assert.equal((await run("/users/me", "token-a", { method: "PATCH", origin: "https://diskuk.example" })).passed, true);
  assert.equal((await run("/auth/refresh", "token-a", { method: "POST", origin: "https://evil.example" })).res.statusCode, 403);
});

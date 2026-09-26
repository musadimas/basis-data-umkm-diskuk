import { solveChallenge, pbkdf2 } from "altcha/lib";
import { issueChallenge } from "../src/lib/utils/captcha.js";

export const APPLICATION_ROLE_ID = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";

/** Directus env for tests: low captcha cost and no login stall keep the suite fast. */
export const TEST_ENV = {
  SECRET: "unit-test-directus-secret",
  AUTH_CAPTCHA_COST: 10,
  LOGIN_STALL_TIME: 0,
  AUTH_PASSWORD_RESET_URL: "https://umkm.test/reset-kata-sandi",
};

export const silentLogger = { error: () => {}, warn: () => {} };

/** Solves a freshly issued challenge the way the browser widget does and encodes the payload. */
export async function solvedCaptcha(env = TEST_ENV) {
  const challenge = await issueChallenge(env);
  const solution = await solveChallenge({ challenge, deriveKey: pbkdf2.deriveKey });
  return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
}

/**
 * Fake database for the captcha store (single use), NIB lookups, and the login audit.
 * `nibEmails` maps a NIB to the email of the account linked to it.
 */
export function fakeDatabase({ nibEmails = {} } = {}) {
  const used = new Set();
  const audit = [];
  return {
    audit,
    raw: async (sql, bindings = []) => {
      if (sql.includes("INSERT INTO auth_captcha_used")) {
        if (used.has(bindings[0])) return { rows: [] };
        used.add(bindings[0]);
        return { rows: [{ signature: bindings[0] }] };
      }
      if (sql.includes("FROM directus_users u")) {
        const email = nibEmails[bindings[0]];
        return { rows: email ? [{ email }] : [] };
      }
      if (sql.includes("INSERT INTO auth_login_audit")) {
        const [user_id, status, reason, ip, user_agent, origin] = bindings;
        audit.push({ user_id, status, reason, ip, user_agent, origin });
      }
      return { rows: [] };
    },
  };
}

/**
 * Runs a hook register function against recording doubles. Returns the filter/action handlers
 * and the Express middlewares it adds in `routes.before`, keyed like "POST /auth/login".
 */
export function registerHook(register, context) {
  const handlers = {};
  const middlewares = {};
  const app = { post: (path, handler) => (middlewares[`POST ${path}`] = handler) };
  register(
    {
      init: (event, handler) => event === "routes.before" && handler({ app }),
      filter: (event, handler) => (handlers[`filter:${event}`] = handler),
      action: (event, handler) => (handlers[`action:${event}`] = handler),
      schedule: () => {},
    },
    { logger: silentLogger, env: TEST_ENV, getSchema: async () => ({}), ...context },
  );
  return { handlers, middlewares };
}

/** Runs an Express middleware and resolves with the error passed to next(), if any. */
export function runMiddleware(middleware, req) {
  return new Promise((resolve) => middleware(req, {}, (error) => resolve(error)));
}

/** Express response double that records status, headers, body, and cookies. */
export function fakeResponse() {
  const res = { statusCode: 200, headers: {}, cookies: [] };
  res.setHeader = (name, value) => (res.headers[name.toLowerCase()] = value);
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => (res.body = body);
  res.end = () => (res.ended = true);
  res.cookie = (name, value, options) => res.cookies.push({ name, value, options });
  return res;
}

/**
 * Registers endpoint modules the way Directus does (one scoped router per entry name) and
 * returns handlers keyed by full route, e.g. "GET /v1/auth/captcha/challenge".
 */
export function mountEndpoints(modules, context) {
  const routes = {};
  for (const [entryName, register] of Object.entries(modules)) {
    const scoped = (method) => (path, ...handlers) => {
      const suffix = path === "/" ? "" : path;
      routes[`${method} /${entryName}${suffix}`] = handlers.at(-1);
    };
    register({ get: scoped("GET"), post: scoped("POST") }, context);
  }
  return routes;
}

export async function call(routes, key, request = {}) {
  const res = fakeResponse();
  let nextError;
  await routes[key](
    { accountability: { user: null, role: null, ip: "10.0.0.7" }, schema: {}, body: {}, query: {}, ...request },
    res,
    (error) => (nextError = error),
  );
  return { res, nextError };
}

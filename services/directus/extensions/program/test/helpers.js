import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { APPLICATION_ROLE_ID } = require("../../../analytics-shared/cakupan.cjs");

export const APP_USER = { user: "00000000-0000-4000-8000-000000000001", role: APPLICATION_ROLE_ID };

/**
 * Registers an endpoint module against a recording router. `call(method, path, req)` runs the
 * handler whose route pattern matches, like Express would, and resolves with the response.
 */
export function mountEndpoint(register, { database, env = {}, context = {} } = {}) {
  const routes = [];
  const add = (method) => (path, handler) => routes.push({ method, path, handler });
  const logs = [];
  const queries = [];
  const db = database ?? {
    raw: async (sql, bindings) => {
      queries.push({ sql, bindings });
      return { rows: [] };
    },
    transaction: async (fn) => fn(db),
  };
  register(
    { get: add("GET"), post: add("POST"), patch: add("PATCH"), put: add("PUT"), delete: add("DELETE") },
    { database: db, env, logger: { error: (...args) => logs.push(args), warn() {}, info() {} }, ...context },
  );
  async function call(method, url, req = {}) {
    for (const route of routes) {
      if (route.method !== method) continue;
      const names = [];
      const pattern = new RegExp(`^${route.path.replace(/:(\w+)/g, (_m, name) => (names.push(name), "([^/]+)"))}$`);
      const match = url.match(pattern);
      if (!match) continue;
      const res = { statusCode: 200, headers: {} };
      res.setHeader = (key, value) => (res.headers[key] = value);
      // Enough of a writable stream for handlers that pipe asset bytes straight through.
      res.write = () => true;
      res.end = (value) => {
        if (value !== undefined) res.body = value;
      };
      res.on = () => res;
      res.once = () => res;
      res.emit = () => false;
      res.status = (code) => ((res.statusCode = code), res);
      res.json = (value) => (res.body = value);
      res.send = (value) => (res.body = value);
      let nextError;
      await route.handler(
        { accountability: APP_USER, query: {}, headers: {}, ...req, params: Object.fromEntries(names.map((n, i) => [n, match[i + 1]])) },
        res,
        (error) => (nextError = error),
      );
      return { res, nextError };
    }
    throw new Error(`No route for ${method} ${url}`);
  }
  return { call, routes, logs, queries };
}

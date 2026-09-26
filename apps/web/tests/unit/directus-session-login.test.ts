import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { createApp, eventHandler, toNodeListener } from "h3";
import {
  SESSION_ACTIVITY_COOKIE,
  SESSION_STARTED_COOKIE,
} from "../../server/utils/session-policy";
import {
  callOperasionalInternal,
  directusTarget,
  loginDirectusSession,
} from "../../server/utils/directus-session-login";

const secret = "unit-test-session-policy-secret";
const OPERASIONAL_SECRET = "unit-test-operasional-internal-secret";

function startUpstream() {
  const state = { lastLoginPath: "", lastXff: "", lastInternalPath: "", lastSecretHeader: "" };
  const server: Server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://u").pathname;
    if (path === "/auth/login" || path === "/panel/auth/login") {
      state.lastLoginPath = path;
      state.lastXff = String(req.headers["x-forwarded-for"] || "");
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
        res.setHeader("content-type", "application/json");
        if (body.email === "ok@example.invalid") {
          res.setHeader("set-cookie", [
            "directus_session=upstream-session; Path=/; HttpOnly",
            "directus_refresh=upstream-refresh; Path=/; HttpOnly",
          ]);
          res.end(JSON.stringify({ data: { expires: 0 } }));
        } else {
          res.statusCode = 401;
          res.end(JSON.stringify({ errors: [{ message: "Invalid user credentials." }] }));
        }
      });
      return;
    }
    if (path === "/operasional/internal/resolve-nib" || path === "/panel/operasional/internal/resolve-nib") {
      state.lastInternalPath = path;
      state.lastSecretHeader = String(req.headers["x-operasional-internal-secret"] || "");
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
        res.setHeader("content-type", "application/json");
        if (state.lastSecretHeader !== OPERASIONAL_SECRET) {
          res.statusCode = 403;
          res.end(JSON.stringify({ errors: [{ message: "forbidden" }] }));
          return;
        }
        if (body.nib === "9900000000001") {
          res.end(JSON.stringify({ data: { email: "ok@example.invalid" } }));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ errors: [{ message: "not found" }] }));
        }
      });
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ errors: [{ message: "not found" }] }));
  });
  return new Promise<{ server: Server; url: string; state: typeof state }>((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}`, state }),
    ),
  );
}

let upstream: Awaited<ReturnType<typeof startUpstream>>;
let app: Server;
let appUrl: string;
let previousEnv: Record<string, string | undefined>;

function snapshotEnv() {
  return {
    proxyTarget: process.env.NUXT_DIRECTUS_PROXY_TARGET,
    internalUrl: process.env.NUXT_DIRECTUS_INTERNAL_URL,
    policySecret: process.env.NUXT_SESSION_POLICY_SECRET,
    operasionalSecret: process.env.OPERASIONAL_INTERNAL_SECRET,
  };
}

function restoreEnv(previous: ReturnType<typeof snapshotEnv>) {
  if (previous.proxyTarget === undefined) delete process.env.NUXT_DIRECTUS_PROXY_TARGET;
  else process.env.NUXT_DIRECTUS_PROXY_TARGET = previous.proxyTarget;
  if (previous.internalUrl === undefined) delete process.env.NUXT_DIRECTUS_INTERNAL_URL;
  else process.env.NUXT_DIRECTUS_INTERNAL_URL = previous.internalUrl;
  if (previous.policySecret === undefined) delete process.env.NUXT_SESSION_POLICY_SECRET;
  else process.env.NUXT_SESSION_POLICY_SECRET = previous.policySecret;
  if (previous.operasionalSecret === undefined) delete process.env.OPERASIONAL_INTERNAL_SECRET;
  else process.env.OPERASIONAL_INTERNAL_SECRET = previous.operasionalSecret;
}

beforeEach(async () => {
  previousEnv = snapshotEnv();
  upstream = await startUpstream();
  process.env.NUXT_DIRECTUS_INTERNAL_URL = upstream.url;
  process.env.NUXT_SESSION_POLICY_SECRET = secret;
  process.env.OPERASIONAL_INTERNAL_SECRET = OPERASIONAL_SECRET;
  delete process.env.NUXT_DIRECTUS_PROXY_TARGET;

  const h3App = createApp();
  // Catatan: jangan mengembalikan `false` langsung dari handler — h3 memperlakukannya
  // sebagai "tanpa konten", bukan JSON. Bungkus hasilnya dalam objek.
  h3App.use(
    "/login-ok",
    eventHandler(async (event) => ({
      ok: await loginDirectusSession(event, "ok@example.invalid", "secret-123456"),
    })),
  );
  h3App.use(
    "/login-bad",
    eventHandler(async (event) => ({
      ok: await loginDirectusSession(event, "wrong@example.invalid", "secret-123456"),
    })),
  );
  h3App.use(
    "/resolve-ok",
    eventHandler((event) => callOperasionalInternal(event, "resolve-nib", { nib: "9900000000001" })),
  );
  h3App.use(
    "/resolve-404",
    eventHandler((event) => callOperasionalInternal(event, "resolve-nib", { nib: "0000000000000" })),
  );
  app = createServer(toNodeListener(h3App));
  await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
  // SAFETY: listen() sudah selesai, alamat yang terikat berbentuk objek { port }.
  appUrl = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => app.close(() => resolve()));
  await new Promise<void>((resolve) => upstream.server.close(() => resolve()));
  restoreEnv(previousEnv);
});

function setCookieNames(response: { headers: { getSetCookie: () => string[] } }) {
  return response.headers.getSetCookie().map((cookie) => cookie.split("=")[0]);
}

describe("directusTarget", () => {
  it("memakai mode strip (prefix kosong) tanpa NUXT_DIRECTUS_PROXY_TARGET", () => {
    expect(directusTarget()).toEqual({ base: upstream.url, prefix: "" });
  });

  it("memakai mode passthrough (prefix /panel) dengan NUXT_DIRECTUS_PROXY_TARGET", () => {
    process.env.NUXT_DIRECTUS_PROXY_TARGET = `${upstream.url}/`;
    const target = directusTarget();
    expect(target).toEqual({ base: upstream.url, prefix: "/panel" });
  });
});

describe("loginDirectusSession", () => {
  it("meneruskan set-cookie upstream dan menyetel dua cookie policy (mode strip)", async () => {
    const response = await fetch(`${appUrl}/login-ok`);
    expect(response.status).toBe(200);
    await response.json();
    const names = setCookieNames(response);
    expect(names).toContain("directus_session");
    expect(names).toContain("directus_refresh");
    expect(names).toContain(SESSION_STARTED_COOKIE);
    expect(names).toContain(SESSION_ACTIVITY_COOKIE);
    expect(upstream.state.lastLoginPath).toBe("/auth/login");
  });

  it("kredensial ditolak upstream → false tanpa cookie policy", async () => {
    const response = await fetch(`${appUrl}/login-bad`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(setCookieNames(response)).not.toContain(SESSION_STARTED_COOKIE);
    expect(setCookieNames(response)).not.toContain(SESSION_ACTIVITY_COOKIE);
  });

  it("mode passthrough menargetkan /panel/auth/login tanpa cookie policy", async () => {
    process.env.NUXT_DIRECTUS_PROXY_TARGET = upstream.url;
    const h3App = createApp();
    h3App.use(
      "/login-ok",
      eventHandler((event) => loginDirectusSession(event, "ok@example.invalid", "secret-123456")),
    );
    const passthroughApp = createServer(toNodeListener(h3App));
    await new Promise<void>((resolve) => passthroughApp.listen(0, "127.0.0.1", resolve));
    try {
      // SAFETY: listen() sudah selesai, alamat yang terikat berbentuk objek { port }.
      const url = `http://127.0.0.1:${(passthroughApp.address() as { port: number }).port}`;
      const response = await fetch(`${url}/login-ok`);
      expect(response.status).toBe(200);
      await response.json();
      expect(upstream.state.lastLoginPath).toBe("/panel/auth/login");
      const names = setCookieNames(response);
      expect(names).toContain("directus_session");
      expect(names).not.toContain(SESSION_STARTED_COOKIE);
      expect(names).not.toContain(SESSION_ACTIVITY_COOKIE);
    } finally {
      await new Promise<void>((resolve) => passthroughApp.close(() => resolve()));
    }
  });
});

describe("callOperasionalInternal", () => {
  it("mengembalikan status 200 dan payload ter-parse saat NIB terdaftar", async () => {
    const response = await fetch(`${appUrl}/resolve-ok`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe(200);
    expect(body.data).toEqual({ data: { email: "ok@example.invalid" } });
    expect(upstream.state.lastSecretHeader).toBe(OPERASIONAL_SECRET);
  });

  it("tidak pernah melempar untuk 4xx: status 404 diteruskan ke pemanggil", async () => {
    const response = await fetch(`${appUrl}/resolve-404`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe(404);
  });

  it("secret hilang/pendek melempar 503 INTERNAL_SECRET_UNAVAILABLE", async () => {
    delete process.env.OPERASIONAL_INTERNAL_SECRET;
    const h3App = createApp();
    h3App.use(
      "/internal",
      eventHandler((event) => callOperasionalInternal(event, "resolve-nib", { nib: "9900000000001" })),
    );
    const probeApp = createServer(toNodeListener(h3App));
    await new Promise<void>((resolve) => probeApp.listen(0, "127.0.0.1", resolve));
    try {
      // SAFETY: listen() sudah selesai, alamat yang terikat berbentuk objek { port }.
      const url = `http://127.0.0.1:${(probeApp.address() as { port: number }).port}`;
      const response = await fetch(`${url}/internal`);
      expect(response.status).toBe(503);
    } finally {
      await new Promise<void>((resolve) => probeApp.close(() => resolve()));
    }
  });
});

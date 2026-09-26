import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { createApp, eventHandler, toNodeListener } from "h3";
import { createPolicyCookies } from "../../server/utils/session-policy";
import { proxyToDirectus } from "../../server/utils/directus-proxy";

const secret = "unit-test-session-policy-secret";
const CHUNK = 256 * 1024;
const CHUNKS = 10;
const DRIP_MS = 60;

let upstreamRequestCount = 0;

function startUpstream() {
  const server: Server = createServer((req, res) => {
    upstreamRequestCount += 1;
    const mode = new URL(req.url ?? "/", "http://u").pathname;
    if (mode === "/echo-sha") {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
      req.on("end", () => {
        const body = Buffer.concat(chunks);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          sha: createHash("sha256").update(body).digest("hex"),
          bytes: body.length,
        }));
      });
      return;
    }
    if (mode === "/torn") {
      res.writeHead(200, { "content-type": "application/octet-stream" });
      res.write(Buffer.alloc(CHUNK, 0x61));
      res.write(Buffer.alloc(CHUNK, 0x62));
      setTimeout(() => res.destroy(), 20);
      return;
    }
    if (mode !== "/drip") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ errors: [{ message: "not found" }] }));
      return;
    }
    res.writeHead(200, { "content-type": "application/octet-stream" });
    let sent = 0;
    const timer = setInterval(() => {
      if (sent >= CHUNKS) {
        clearInterval(timer);
        res.end();
        return;
      }
      res.write(Buffer.alloc(CHUNK, 0x61));
      sent += 1;
    }, DRIP_MS);
    req.on("close", () => clearInterval(timer));
  });
  return new Promise<{ server: Server; url: string }>((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` }),
    ),
  );
}

let upstream: { server: Server; url: string };
let proxy: Server;
let proxyUrl: string;
let previousEnv: ReturnType<typeof snapshotEnv>;

function snapshotEnv() {
  return {
    internal: process.env.NUXT_DIRECTUS_INTERNAL_URL,
    secret: process.env.NUXT_SESSION_POLICY_SECRET,
  };
}

beforeEach(async () => {
  previousEnv = snapshotEnv();
  upstreamRequestCount = 0;
  upstream = await startUpstream();
  process.env.NUXT_DIRECTUS_INTERNAL_URL = upstream.url;
  process.env.NUXT_SESSION_POLICY_SECRET = secret;
  const app = createApp();
  app.use("/", eventHandler((event) => proxyToDirectus(event)));
  proxy = createServer(toNodeListener(app));
  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  // SAFETY: listen() has settled above, so the bound address is the object form.
  proxyUrl = `http://127.0.0.1:${(proxy.address() as { port: number }).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => proxy.close(() => resolve()));
  await new Promise<void>((resolve) => upstream.server.close(() => resolve()));
  if (previousEnv.internal === undefined) delete process.env.NUXT_DIRECTUS_INTERNAL_URL;
  else process.env.NUXT_DIRECTUS_INTERNAL_URL = previousEnv.internal;
  if (previousEnv.secret === undefined) delete process.env.NUXT_SESSION_POLICY_SECRET;
  else process.env.NUXT_SESSION_POLICY_SECRET = previousEnv.secret;
});

function sessionCookie() {
  const cookies = createPolicyCookies(Date.now(), secret);
  return `diskuk_session_started=${cookies.started}; diskuk_session_last_activity=${cookies.activity}`;
}

async function readBody(response: Response, onFirstChunk?: (elapsedMs: number) => void) {
  if (!response.body) throw new Error("response must carry a streaming body");
  const started = performance.now();
  const reader = response.body.getReader();
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return { bytes, firstChunkMs: 0 };
    if (onFirstChunk) {
      onFirstChunk(performance.now() - started);
      onFirstChunk = undefined;
    }
    bytes += value.byteLength;
  }
}

describe("directus proxy streaming", () => {
  it("rejects anonymous panel requests before touching the upstream", async () => {
    const response = await fetch(`${proxyUrl}/panel/status`);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.errors[0].extensions.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("blocks browser access to internal operasional extension paths with 404", async () => {
    const response = await fetch(`${proxyUrl}/panel/operasional/internal/resolve-nib`, {
      method: "POST",
      headers: { cookie: sessionCookie(), origin: proxyUrl, "content-type": "application/json" },
      body: JSON.stringify({ nib: "9900000000001" }),
    });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.errors[0].extensions.code).toBe("NOT_FOUND");
    expect(upstreamRequestCount).toBe(0);
  });

  it("always forwards the real client IP in x-forwarded-for", async () => {
    let seenForwardedFor: string | null = null;
    const probe = createServer((_req, res) => {
      seenForwardedFor = String(_req.headers["x-forwarded-for"] || "");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: {} }));
    });
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const previousInternal = process.env.NUXT_DIRECTUS_INTERNAL_URL;
    // SAFETY: listen() has settled above, so the bound address is the object form.
    process.env.NUXT_DIRECTUS_INTERNAL_URL = `http://127.0.0.1:${(probe.address() as { port: number }).port}`;
    try {
      // Spoofed header from the client must be overridden with the socket address.
      const response = await fetch(`${proxyUrl}/panel/spoofed-forward`, {
        headers: { cookie: sessionCookie(), "x-forwarded-for": "203.0.113.99" },
      });
      expect(response.status).toBe(200);
      expect(seenForwardedFor).toBe("127.0.0.1");
    } finally {
      process.env.NUXT_DIRECTUS_INTERNAL_URL = previousInternal;
      await new Promise<void>((resolve) => probe.close(() => resolve()));
    }
  });

  it("delivers the first body byte while the upstream is still sending", async () => {
    const response = await fetch(`${proxyUrl}/panel/drip`, {
      headers: { cookie: sessionCookie() },
    });
    expect(response.status).toBe(200);
    let firstChunkMs = Number.POSITIVE_INFINITY;
    const { bytes } = await readBody(response, (elapsed) => {
      firstChunkMs = elapsed;
    });
    expect(bytes).toBe(CHUNK * CHUNKS);
    const upstreamFloorMs = (CHUNKS - 1) * DRIP_MS;
    expect(firstChunkMs).toBeLessThan(upstreamFloorMs);
  });

  it("keeps status and forwarded headers intact while streaming", async () => {
    const response = await fetch(`${proxyUrl}/panel/missing-upstream-route`, {
      headers: { cookie: sessionCookie() },
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("meneruskan body biner identik byte-per-byte (unggah berkas)", async () => {
    const payload = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
    const expected = createHash("sha256").update(payload).digest("hex");
    const response = await fetch(`${proxyUrl}/panel/echo-sha`, {
      method: "POST",
      headers: { cookie: sessionCookie(), origin: proxyUrl, "content-type": "application/octet-stream" },
      body: payload,
    });
    expect(response.status).toBe(200);
    // SAFETY: upstream /echo-sha selalu menjawab JSON { sha, bytes }; assertion hanya memulihkan bentuknya.
    const json = await response.json() as { sha: string; bytes: number };
    expect(json.bytes).toBe(256);
    expect(json.sha).toBe(expected);
  });

  it("surfacing upstream failure mid-body never looks like a complete transfer", async () => {
    const response = await fetch(`${proxyUrl}/panel/torn`, {
      headers: { cookie: sessionCookie() },
    });
    expect(response.status).toBe(200);
    if (!response.body) throw new Error("response must carry a streaming body");
    const reader = response.body.getReader();
    let bytes = 0;
    let torn = false;
    for (;;) {
      try {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
      } catch {
        torn = true;
        break;
      }
    }
    expect(torn || bytes < CHUNK * CHUNKS).toBe(true);
    expect(bytes).toBeLessThan(CHUNK * CHUNKS);
  });
});

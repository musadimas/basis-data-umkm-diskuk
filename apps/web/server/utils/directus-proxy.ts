import { randomUUID } from "node:crypto";
import { getRequestHeader, getRequestURL, readRawBody, setResponseHeader, type H3Event } from "h3";
import {
  clearPolicyCookies,
  isLoginPath,
  isLogoutPath,
  isPrivatePanelPath,
  isRefreshPath,
  readPolicyFromEvent,
  refreshActivityCookie,
  setPolicyCookies,
} from "./session-policy";

const HOP_BY_HOP = new Set(["connection", "proxy-connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length"]);
const FORWARDABLE = new Set(["accept", "accept-language", "content-type", "cookie", "origin", "user-agent", "x-forwarded-for", "x-forwarded-proto", "x-request-id"]);

export function requestOrigin(event: H3Event) {
  const url = getRequestURL(event);
  const forwardedProto = getRequestHeader(event, "x-forwarded-proto")?.split(",")[0]?.trim();
  return `${forwardedProto || url.protocol.replace(":", "")}://${url.host}`;
}

export function sameOriginMutation(event: H3Event) {
  const method = event.node.req.method?.toUpperCase() || "GET";
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return true;
  const origin = getRequestHeader(event, "origin");
  return Boolean(origin && origin !== "null" && origin === requestOrigin(event));
}

export function forwardHeaders(event: H3Event, correlationId: string) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(event.node.req.headers)) {
    const normalized = key.toLowerCase();
    if (HOP_BY_HOP.has(normalized) || !FORWARDABLE.has(normalized)) continue;
    if (Array.isArray(value)) headers.set(normalized, value.join(", "));
    else if (value !== undefined) headers.set(normalized, value);
  }
  headers.set("x-request-id", correlationId);
  return headers;
}

function appendSetCookie(event: H3Event, value: string) {
  const res = event.node.res;
  const current = res.getHeader("set-cookie");
  const list = Array.isArray(current) ? current.map(String) : current ? [String(current)] : [];
  list.push(value);
  res.setHeader("set-cookie", list);
}

function clearCookiesWithoutH3(event: H3Event) {
  clearPolicyCookies(event);
}

function setJsonError(event: H3Event, statusCode: number, code: string, requestId: string) {
  const body = JSON.stringify({ errors: [{ message: "Permintaan tidak dapat diproses.", extensions: { code, requestId } }] });
  event.node.res.statusCode = statusCode;
  setResponseHeader(event, "content-type", "application/json; charset=utf-8");
  setResponseHeader(event, "cache-control", "private, no-store");
  event.node.res.end(body);
}

function isStringBody(value: string | null | undefined): value is string {
  return typeof value === "string"
}

function getSetCookies(headers: Headers): string[] {
  // SAFETY: older runtimes lack Headers.prototype.getSetCookie; probe the accessor before calling it.
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (getSetCookie) return getSetCookie.call(headers);
  return (headers.get("set-cookie") || "").split(/,(?=[^;,=]+=[^;,]+)/g).filter(Boolean)
}

export async function proxyToDirectus(event: H3Event) {
  const requestId = getRequestHeader(event, "x-request-id") || randomUUID();
  setResponseHeader(event, "x-request-id", requestId);
  setResponseHeader(event, "cache-control", "private, no-store");
  const url = getRequestURL(event);
  const pathname = url.pathname;

  if (!sameOriginMutation(event)) {
    setJsonError(event, 403, "ORIGIN_MISMATCH", requestId);
    return;
  }

  // Passthrough mode (dev:direct): the target serves Directus itself under /panel, so the prefix is
  // preserved and the target's own proxy enforces session policy. Strip mode (default): /panel maps
  // to the Directus root, as in the container stack.
  const passthrough = Boolean(process.env.NUXT_DIRECTUS_PROXY_TARGET);
  const base = passthrough
    ? process.env.NUXT_DIRECTUS_PROXY_TARGET!.replace(/\/$/, "")
    : (process.env.NUXT_DIRECTUS_INTERNAL_URL || "http://directus:8055").replace(/\/$/, "");

  const login = isLoginPath(pathname);
  const logout = isLogoutPath(pathname);
  const refresh = isRefreshPath(pathname);
  if (!passthrough && isPrivatePanelPath(pathname) && !login && !logout) {
    const policy = readPolicyFromEvent(event);
    if (!policy.valid) {
      clearCookiesWithoutH3(event);
      setJsonError(event, 401, "AUTHENTICATION_REQUIRED", requestId);
      return;
    }
  }

  const target = passthrough ? `${base}${pathname}${url.search}` : `${base}${pathname.slice("/panel".length) || "/"}${url.search}`;
  const body = ["GET", "HEAD"].includes(event.node.req.method?.toUpperCase() || "GET") ? undefined : await readRawBody(event);
  const headers = forwardHeaders(event, requestId);
  if (passthrough && ["POST", "PUT", "PATCH", "DELETE"].includes(event.node.req.method?.toUpperCase() || "")) {
    // The target rejects mutations whose Origin does not match its own origin; forward its origin
    // instead of the local dev origin.
    headers.set("origin", new URL(base).origin);
  }
  if (body !== undefined && body !== null) {
    const length = isStringBody(body) ? Buffer.byteLength(body) : Buffer.byteLength(Buffer.from(body));
    headers.set("content-length", String(length));
  }

  let response: Response;
  try {
    // SAFETY: the raw body originates from readRawBody (a validated string proxy payload), which is a valid BodyInit.
    response = await fetch(target, {
      method: event.node.req.method,
      headers,
      body: body === undefined || body === null ? undefined : (body as BodyInit),
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    setJsonError(event, 502, "UPSTREAM_UNAVAILABLE", requestId);
    return;
  }

  const res = event.node.res;
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (["set-cookie", "content-length", "connection", "transfer-encoding", "cache-control"].includes(key.toLowerCase())) return;
    res.setHeader(key, value);
  });
  const setCookies = getSetCookies(response.headers);
  for (const cookie of setCookies) if (cookie) appendSetCookie(event, cookie);

  if (!passthrough) {
    if (response.status === 401 || logout) clearCookiesWithoutH3(event);
    else if (login && response.ok) setPolicyCookies(event);
    else if (!refresh && !login && response.ok) refreshActivityCookie(event);
  }

  if (event.node.req.method?.toUpperCase() === "HEAD") {
    res.end();
    return;
  }
  const data = Buffer.from(await response.arrayBuffer());
  res.end(data);
}

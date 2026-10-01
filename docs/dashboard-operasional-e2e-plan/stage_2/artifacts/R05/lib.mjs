// R05 re-run of the Y04/Y09 runtime probes against the R04/R05 clone (Directus 127.0.0.1:8156, DB r04_clone).
// Same probes as stage_1/artifacts/Y04-Y09; only the environment constants below differ.
import { execFileSync } from "node:child_process";
export const BASE = process.env.R05_BASE ?? "http://127.0.0.1:8156";
export const PASS = "R04-uji-Pass#2026";
export const USERS = {
  provinsi: "dummy_admin@diskuk.jabarprov.go.id",
  kabSubang: "dummy_admin.subang@jabarprov.go.id",
  kabSumedang: "r04_kab.sumedang@example.com",
  pendamping: "dummy_coach.pendamping@jabarprov.go.id",
  pendamping2: "r04_pendamping2@example.com",
  umkm1: "dummy_wawan.leathercraft@gmail.com",
  umkm2: "r05_umkm2@example.com",
  umkm6: "r05_umkm6@example.com",
};
export const USAHA = (n) => `d0000000-0000-4000-8000-00000000000${n}`;
export async function login(key) {
  const r = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: USERS[key], password: PASS }) });
  const j = await r.json();
  if (!j.data?.access_token) throw new Error(`login ${key} ${r.status} ${JSON.stringify(j)}`);
  return j.data.access_token;
}
export async function api(token, method, path, body, extra = {}) {
  const headers = { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined && !(body instanceof FormData) ? { "content-type": "application/json" } : {}), ...extra };
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  const buf = Buffer.from(await r.arrayBuffer());
  let json = null;
  try { json = JSON.parse(buf.toString("utf8")); } catch {}
  return { status: r.status, json, buf, headers: r.headers, text: buf.toString("utf8") };
}
export function sql(q) {
  return execFileSync("docker", ["exec", "-i", "diskuk-operasional-e2e-postgis-1", "psql", "-U", "diskuk_app", "-d", "r04_clone", "-Atc", q], { encoding: "utf8" }).trim();
}
export const rows = [];
export function rec(probe, expected, actual, ok) {
  rows.push({ probe, expected, actual, ok });
  console.log(`${ok ? "PASS" : "FAIL"} | ${probe} | expect ${expected} | got ${actual}`);
}
export const eq = (probe, expected, actual) => rec(probe, String(expected), String(actual), String(expected) === String(actual));

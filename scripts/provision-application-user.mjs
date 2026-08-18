#!/usr/bin/env node
import process from "node:process";

const role = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";
const base = (process.env.DIRECTUS_BASE_URL || "http://127.0.0.1:8055").replace(/\/$/, "");
const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL;
const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD;
const email = process.env.APPLICATION_USER_EMAIL;
const password = process.env.APPLICATION_USER_PASSWORD;
if (![adminEmail, adminPassword, email, password].every((value) => value && !value.includes("change-me"))) {
  throw new Error("DIRECTUS_ADMIN_* and APPLICATION_USER_* must be supplied through the environment");
}

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { accept: "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`Directus request failed (${response.status})`);
    error.status = response.status;
    // Never retain or print upstream bodies: they can contain user data.
    throw error;
  }
  return body;
}

const admin = await request("/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: adminEmail, password: adminPassword, mode: "json" }) });
const token = admin?.data?.access_token;
if (!token) throw new Error("Directus admin login did not return a token");
const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
const existing = await request(`/users?filter[email][_eq]=${encodeURIComponent(email)}&limit=1`, { headers });
if (existing?.data?.[0]?.id) {
  await request(`/users/${existing.data[0].id}`, { method: "PATCH", headers, body: JSON.stringify({ email, password, role, status: "active" }) });
} else {
  await request("/users", { method: "POST", headers, body: JSON.stringify({ email, password, role, status: "active" }) });
}
const login = await request("/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, mode: "json" }) });
if (!login?.data?.access_token) throw new Error("Application User verification login failed");
await request("/users/me", { headers: { authorization: `Bearer ${login.data.access_token}` } });
console.log("Application User provisioning and verification succeeded");

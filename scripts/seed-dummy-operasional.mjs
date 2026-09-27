#!/usr/bin/env node
// Seed/cleanup akun dummy dashboard operasional (fase Y01). HANYA untuk stack disposable.
// Pemakaian: node scripts/seed-dummy-operasional.mjs seed|cleanup
import process from "node:process";

// Seluruh akun operasional memakai satu role Directus (role aplikasi, dibuat migrasi
// 20260819A); identitas peran sebenarnya ada di kolom directus_users.app_role.
const APPLICATION_ROLE = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";

const ACCOUNTS = [
  { email: "dummy_admin@diskuk.jabarprov.go.id", first_name: "Admin", last_name: "DISKUK Provinsi", app_role: "provinsi" },
  { email: "dummy_admin.subang@jabarprov.go.id", first_name: "Admin", last_name: "Dinas KUK Subang", app_role: "kabkota" },
  { email: "dummy_coach.pendamping@jabarprov.go.id", first_name: "Rina", last_name: "Pendamping Wilayah", app_role: "pendamping" },
  { email: "dummy_wawan.leathercraft@gmail.com", first_name: "Wawan", last_name: "Setiawan", app_role: "umkm" },
];

const action = process.argv[2];
const base = (process.env.DIRECTUS_BASE_URL || "http://127.0.0.1:8055").replace(/\/$/, "");
const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL;
const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD;
const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD;

const host = new URL(base).hostname;
if (!["127.0.0.1", "localhost"].includes(host) && process.env.ALLOW_REMOTE_DUMMY_SEED !== "yes") {
  console.error("DIRECTUS_BASE_URL harus lokal (127.0.0.1/localhost) atau set ALLOW_REMOTE_DUMMY_SEED=yes");
  process.exit(1);
}
if (!["seed", "cleanup"].includes(action)) {
  console.error("Pemakaian: node scripts/seed-dummy-operasional.mjs seed|cleanup");
  process.exit(1);
}
if (!adminEmail || !adminPassword || adminEmail.includes("change-me") || adminPassword.includes("change-me")) {
  console.error("DIRECTUS_ADMIN_EMAIL/PASSWORD wajib diisi lewat environment (bukan placeholder)");
  process.exit(1);
}
if (action === "seed" && (!demoPassword || demoPassword.length < 12 || demoPassword.includes("change-me"))) {
  console.error("DEMO_ACCOUNT_PASSWORD wajib: minimal 12 karakter dan bukan placeholder change-me");
  process.exit(1);
}

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { accept: "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`Directus request failed (${response.status})`);
    error.status = response.status;
    // Jangan simpan/cetak body upstream: bisa memuat data pengguna.
    throw error;
  }
  return body;
}

const admin = await request("/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: adminEmail, password: adminPassword, mode: "json" }),
});
const token = admin?.data?.access_token;
if (!token) throw new Error("Login admin Directus tidak mengembalikan token");
const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

if (action === "cleanup") {
  const files = await request(`/files?filter[filename_download][_starts_with]=dummy_&limit=-1&fields=id,filename_download`, { headers });
  for (const file of files?.data ?? []) {
    await request(`/files/${file.id}`, { method: "DELETE", headers });
    console.log(`hapus berkas ${file.filename_download}`);
  }
  const list = await request(`/users?filter[email][_starts_with]=dummy_&limit=-1&fields=id,email`, { headers });
  for (const user of list?.data ?? []) {
    await request(`/users/${user.id}`, { method: "DELETE", headers });
    console.log(`hapus akun ${user.email}`);
  }
  console.log("cleanup akun dummy selesai");
  process.exit(0);
}

for (const account of ACCOUNTS) {
  const existing = await request(`/users?filter[email][_eq]=${encodeURIComponent(account.email)}&limit=1`, { headers });
  const payload = { ...account, role: APPLICATION_ROLE, password: demoPassword, status: "active" };
  if (existing?.data?.[0]?.id) {
    await request(`/users/${existing.data[0].id}`, { method: "PATCH", headers, body: JSON.stringify(payload) });
  } else {
    await request("/users", { method: "POST", headers, body: JSON.stringify(payload) });
  }
  const verify = await request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: account.email, password: demoPassword, mode: "json" }),
  });
  const verifyToken = verify?.data?.access_token;
  if (!verifyToken) throw new Error(`Verifikasi login gagal untuk ${account.email}`);
  await request("/users/me", { headers: { authorization: `Bearer ${verifyToken}` } });
  console.log(`akun siap: ${account.email}`);
}

console.log("seed akun dummy selesai");

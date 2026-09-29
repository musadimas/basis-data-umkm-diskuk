#!/usr/bin/env node
// Tanda tangani passport (TPDMY…) dan sertifikat kegiatan (SKDUMMY…) dummy yang dibuat
// scripts/seed-dummy-program.sql, supaya halaman verifikasi publik menyatakan sah.
// Harus berjalan dengan kunci yang sama dengan Directus, jadi jalankan DI container directus:
//   docker compose exec -T directus node --input-type=module - < scripts/sign-dummy-program.mjs
// Hash dan pesan tanda tangan meniru services/directus/extensions/program/src/endpoints/passport/signing.js
// (canonicalJson → SHA-256 hex; Ed25519 atas "<kode>.<hash>", base64url) dan payload sertifikat
// meniru sertifikatPayload() di endpoints/registrasi/service.js. Hasilnya dibuktikan lewat endpoint
// verifikasi publik, bukan dipercaya begitu saja.
import crypto from "node:crypto";
import fs from "node:fs";
import process from "node:process";

async function loadPg() {
  try {
    return (await import("pg")).default;
  } catch {
    // Image Directus memakai pnpm: pg tidak ada di node_modules teratas.
    const dir = fs.readdirSync("/directus/node_modules/.pnpm").find((name) => name.startsWith("pg@"));
    return (await import(`/directus/node_modules/.pnpm/${dir}/node_modules/pg/lib/index.js`)).default;
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const hashPayload = (payload) => crypto.createHash("sha256").update(canonicalJson(payload)).digest("hex");

const pem = Buffer.from(String(process.env.PASSPORT_SIGNING_PRIVATE_KEY_B64 ?? ""), "base64").toString("utf8");
let privateKey;
try {
  privateKey = crypto.createPrivateKey(pem);
} catch {
  privateKey = null;
}
if (privateKey?.asymmetricKeyType !== "ed25519") {
  console.error("PASSPORT_SIGNING_PRIVATE_KEY_B64 tidak berisi kunci Ed25519 yang valid");
  process.exit(1);
}
const kid =
  process.env.PASSPORT_SIGNING_KID ||
  crypto.createHash("sha256").update(crypto.createPublicKey(privateKey).export({ format: "der", type: "spki" })).digest("hex").slice(0, 16);
const sign = (kode, hash) => crypto.sign(null, Buffer.from(`${kode}.${hash}`), privateKey).toString("base64url");

const { Client } = await loadPg();
const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
await client.connect();
try {
  await client.query("BEGIN");
  const passports = await client.query(
    `SELECT p.id, p.kode, p.payload FROM talent_passport p JOIN usaha u ON u.id = p.usaha
      WHERE u.sumber_id LIKE 'dummy\\_prog\\_%' AND p.kode LIKE 'TPDMY%'`,
  );
  for (const row of passports.rows) {
    const hash = hashPayload(row.payload);
    await client.query(`UPDATE talent_passport SET payload_hash = $1, signature = $2, kid = $3 WHERE id = $4`, [hash, sign(row.kode, hash), kid, row.id]);
  }
  const sertifikat = await client.query(
    `SELECT s.id, s.kode, p.id AS pendaftaran, p.kegiatan, p.usaha FROM kegiatan_sertifikat s
       JOIN kegiatan_pendaftaran p ON p.id = s.pendaftaran JOIN kegiatan k ON k.id = p.kegiatan
      WHERE k.judul LIKE 'dummy\\_%' AND s.kode LIKE 'SKDUMMY%'`,
  );
  for (const row of sertifikat.rows) {
    const payload = {
      versi: 1, kode: row.kode, kegiatan: row.kegiatan, pendaftaran: row.pendaftaran, usaha: row.usaha,
      atribut: "bukti_pelatihan_manajemen", capaian: "peningkatan_kapasitas_sdm",
    };
    const hash = hashPayload(payload);
    await client.query(`UPDATE kegiatan_sertifikat SET payload_hash = $1, signature = $2, kid = $3 WHERE id = $4`, [hash, sign(row.kode, hash), kid, row.id]);
  }
  await client.query("COMMIT");
  console.log(`ditandatangani: ${passports.rowCount} passport, ${sertifikat.rowCount} sertifikat (kid ${kid})`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

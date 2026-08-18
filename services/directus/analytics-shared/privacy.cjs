"use strict";
const { MASKING_VERSION } = require("./contracts.cjs");
function digits(value) { return typeof value === "string" ? value.replace(/\D/g, "") : ""; }
function maskNik(value) { const raw = digits(value); return /^\d{16}$/.test(raw) ? `************${raw.slice(-4)}` : (value ? "Tersimpan — disembunyikan" : "Belum tersedia"); }
function normalizePhone(value) { const raw = digits(value); if (!raw) return null; if (raw.startsWith("62")) return `0${raw.slice(2)}`; if (raw.startsWith("8")) return `0${raw}`; return raw; }
function maskPhone(value) { const raw = normalizePhone(value); return raw && /^08\d{8,13}$/.test(raw) ? `${raw.slice(0,2)}******${raw.slice(-4)}` : (value ? "Tersimpan — disembunyikan" : "Belum tersedia"); }
function ageBand(birthDate, asOf = new Date()) {
  if (!birthDate) return "Belum tersedia";
  const birth = String(birthDate).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!birth) return "Perlu verifikasi";
  const asOfDate = new Date(asOf); if (Number.isNaN(asOfDate.getTime())) return "Perlu verifikasi";
  const end = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(asOfDate);
  const parts = Object.fromEntries(end.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  if (![parts.year, parts.month, parts.day].every(Number.isFinite)) return "Perlu verifikasi";
  const birthYear = Number(birth[1]); const birthMonth = Number(birth[2]); const birthDay = Number(birth[3]); const birthCheck = new Date(Date.UTC(birthYear, birthMonth - 1, birthDay));
  if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31 || birthCheck.getUTCFullYear() !== birthYear || birthCheck.getUTCMonth() !== birthMonth - 1 || birthCheck.getUTCDate() !== birthDay || `${birthYear}-${String(birthMonth).padStart(2,"0")}-${String(birthDay).padStart(2,"0")}` > `${parts.year}-${String(parts.month).padStart(2,"0")}-${String(parts.day).padStart(2,"0")}`) return "Perlu verifikasi";
  let age = parts.year - birthYear; if (parts.month < birthMonth || (parts.month === birthMonth && parts.day < birthDay)) age -= 1;
  if (age < 18) return "Perlu verifikasi"; if (age <= 24) return "18–24"; if (age <= 34) return "25–34"; if (age <= 44) return "35–44"; if (age <= 54) return "45–54"; if (age <= 64) return "55–64"; return "65+";
}
function quality(value, { valid = true, reported = value !== null && value !== undefined } = {}) { return !valid ? "needs_verification" : reported ? "reported" : "missing"; }
function safeScalar(value, type = "text") {
  if (value === null || value === undefined || value === "") return null;
  if (["html", "file", "geometry", "json"].includes(type)) return null;
  if (type === "number") return Number.isFinite(Number(value)) ? Number(value) : null;
  return String(value).slice(0, 2000);
}
function sanitizeExtraFields(extra) {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return {};
  const out = {}; for (const [key, value] of Object.entries(extra)) { if (/(nik|phone|birth|address|foto|file|html|token|secret)/i.test(key)) continue; const safe = safeScalar(value, typeof value === "number" ? "number" : "text"); if (safe !== null) out[key] = safe; } return out;
}
function projectOwner(owner, dataAsOf) { return { name: owner?.nama_lengkap || null, maskedNik: maskNik(owner?.nik), maskedPhone: maskPhone(owner?.telepon), ageBand: ageBand(owner?.birth_date, dataAsOf), maskingVersion: MASKING_VERSION }; }
function projectSafeSource(source, dataAsOf = new Date()) { return { usahaId: source.id, name: safeScalar(source.nama), scale: source.skala || "unknown", kbliCode: safeScalar(source.kode_kbli), kbliCategory: safeScalar(source.kategori_kbli), owner: projectOwner(source.owner, dataAsOf), extraFields: sanitizeExtraFields(source.extra_fields), latitude: Number.isFinite(Number(source.latitude)) ? Number(source.latitude) : null, longitude: Number.isFinite(Number(source.longitude)) ? Number(source.longitude) : null, photo: undefined }; }
module.exports = { MASKING_VERSION, maskNik, normalizePhone, maskPhone, ageBand, quality, safeScalar, sanitizeExtraFields, projectOwner, projectSafeSource };

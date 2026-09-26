"use strict";

// Y03 — minggu program + aturan Jumat WIB.
// Kontrak Stage 1 (Brief Fitur): pelaporan baru dibuat pada hari Jumat
// Asia/Jakarta. Laporan offline yang dibuat pada Jumat membawa waktu
// penciptaan (client) + idempotency key; server memverifikasi saat sinkron
// setelah Jumat dan mencatat provenance. Server mencegah timestamp palsu
// secara proporsional (batas wajar replay, bukan jam terpercaya penuh).

function tanggalJakarta(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function jakartaWeekday(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
  }).format(date);
}

function isJumatJakarta(date = new Date()) {
  return jakartaWeekday(date) === "Friday";
}

function parseTanggalMulai(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return null;
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

// mingguKe(tanggalMulai "YYYY-MM-DD", now) → selisih hari kalender WIB.
// negatif → 0; selain itu floor(hari/7)+1.
function mingguKe(tanggalMulai, now = new Date()) {
  const start = parseTanggalMulai(tanggalMulai);
  if (!start) return 0;
  const todayYmd = tanggalJakarta(now);
  const today = parseTanggalMulai(todayYmd);
  const diffMs = today.getTime() - start.getTime();
  const hari = Math.floor(diffMs / 86_400_000);
  if (hari < 0) return 0;
  return Math.floor(hari / 7) + 1;
}

function targetMingguan(omzetTahunan, faktorTarget = 1.2, override = null) {
  if (override !== null && override !== undefined) return override;
  if (omzetTahunan === null || omzetTahunan === undefined) return null;
  const omzet = Number(omzetTahunan);
  const faktor = Number(faktorTarget);
  if (!Number.isFinite(omzet) || !Number.isFinite(faktor)) return null;
  return Math.round((omzet / 52) * faktor);
}

// Klasifikasi waktu kirim untuk kontrak Jumat.
// serverNow: waktu penerimaan server; clientCreatedAt: waktu penciptaan di perangkat.
// Return { allowed, provenance, reason }.
// - allowed bila clientCreatedAt jatuh pada Jumat WIB.
// - provenance "online" bila tanggal WIB sama dengan serverNow,
//   "offline-replay" bila serverNow sesudahnya (maks 7x24 jam + 5 menit toleransi jam).
// - Palsu proporsional: tolak bila client di masa depan >5 menit, lebih tua dari
//   7 hari + 5 menit, atau bukan Jumat.
function klasifikasiKirim({ serverNow = new Date(), clientCreatedAt }) {
  const server = serverNow instanceof Date ? serverNow : new Date(serverNow);
  const client = clientCreatedAt instanceof Date ? clientCreatedAt : new Date(clientCreatedAt);
  if (Number.isNaN(server.getTime())) {
    return { allowed: false, provenance: null, reason: "WAKTU_SERVER_INVALID" };
  }
  if (Number.isNaN(client.getTime())) {
    return { allowed: false, provenance: null, reason: "WAKTU_KLIEN_INVALID" };
  }
  const diffMs = server.getTime() - client.getTime();
  if (diffMs < -5 * 60 * 1000) {
    return { allowed: false, provenance: null, reason: "WAKTU_MASA_DEPAN" };
  }
  if (!isJumatJakarta(client)) {
    return { allowed: false, provenance: null, reason: "BUKAN_JUMAT" };
  }
  const tujuhHariMs = 7 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000;
  if (diffMs > tujuhHariMs) {
    return { allowed: false, provenance: null, reason: "REPLAY_KEDALUWARSA" };
  }
  const samaHari = tanggalJakarta(server) === tanggalJakarta(client);
  return { allowed: true, provenance: samaHari ? "online" : "offline-replay", reason: "OK" };
}

module.exports = {
  tanggalJakarta,
  jakartaWeekday,
  isJumatJakarta,
  mingguKe,
  targetMingguan,
  klasifikasiKirim,
};

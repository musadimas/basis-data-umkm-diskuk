// Pure rules of the public agenda (Y07/M7-07…M7-10). Kept free of the database so the temporal
// status, the safe-link filtering, the reminder schedule and the target normalisation can be
// tested directly — including the WIB month/year boundaries and the invalid-target cases.
import { ProgramError } from "../../lib/utils/http.js";
import { normalisasiTeleponSeluler } from "../../lib/validate.js";

export const KATEGORI_KEGIATAN = [
  { value: "pelatihan", label: "Pelatihan/Bimtek" },
  { value: "sertifikasi", label: "Sertifikasi" },
  { value: "pameran", label: "Pameran" },
  { value: "akselerasi", label: "Akselerasi UMKM Talent" },
  { value: "literasi_digital", label: "Literasi Digital/PMSE" },
];

export const METODE_KEGIATAN = [
  { value: "luring", label: "Luring" },
  { value: "daring", label: "Daring" },
  { value: "hybrid", label: "Hybrid" },
];

export const STATUS_KEGIATAN = [
  { value: "berjalan", label: "Sedang Berjalan" },
  { value: "pendaftaran", label: "Pendaftaran Dibuka" },
  { value: "segera", label: "Segera Datang" },
  { value: "selesai", label: "Selesai & Dokumentasi" },
];

export const KANAL_PENGINGAT = ["email", "whatsapp"];

export const HARI_JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
export const AGENDA_HARI_MUNDUR = 90;
export const AGENDA_HARI_MAJU = 366;

const KATEGORI_VALUES = KATEGORI_KEGIATAN.map((item) => item.value);
const METODE_VALUES = METODE_KEGIATAN.map((item) => item.value);
const STATUS_VALUES = STATUS_KEGIATAN.map((item) => item.value);

export function labelKategori(value) {
  return KATEGORI_KEGIATAN.find((item) => item.value === value)?.label ?? value;
}

export function labelMetode(value) {
  return METODE_KEGIATAN.find((item) => item.value === value)?.label ?? value;
}

export function labelStatus(value) {
  return STATUS_KEGIATAN.find((item) => item.value === value)?.label ?? value;
}

const ms = (value) => {
  const time = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(time) ? time : null;
};

/**
 * Temporal status from the dates (Asia/Jakarta wall clock is implicit: timestamps are absolute):
 * running between start and end; before the start it is open for registration unless the deadline
 * has passed or the quota is full. The phase treats "Selesai & Dokumentasi" as one group.
 */
export function statusKegiatan(kegiatan, now = new Date()) {
  const time = ms(now);
  const mulai = ms(kegiatan.tanggalMulai ?? kegiatan.tanggal_mulai);
  const selesai = ms(kegiatan.tanggalSelesai ?? kegiatan.tanggal_selesai);
  if (mulai === null || selesai === null || time === null) return "segera";
  if (time > selesai) return "selesai";
  if (time >= mulai) return "berjalan";
  const batas = kegiatan.batasRegistrasi ?? kegiatan.batas_registrasi;
  const tutup = batas === null || batas === undefined ? mulai : ms(batas);
  const kuota = kegiatan.kuota ?? null;
  const terisi = Number(kegiatan.terisi ?? 0);
  const penuh = kuota !== null && kuota !== undefined && terisi >= Number(kuota);
  return tutup !== null && time <= tutup && !penuh ? "pendaftaran" : "segera";
}

/** Remaining seats; null when the event does not cap its quota. */
export function sisaKuota(kegiatan) {
  const kuota = kegiatan.kuota ?? null;
  if (kuota === null || kuota === undefined) return null;
  return Math.max(Number(kuota) - Number(kegiatan.terisi ?? 0), 0);
}

/**
 * Only absolute https links are published: an editor typo or a javascript:/http: URL must never
 * reach a "Daftar" or "Dokumen" button (Y07: tautan resmi aman).
 */
export function tautanAman(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return null;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  return parsed.protocol === "https:" ? parsed.toString() : null;
}

/** YYYY-MM-DD (and the month window) in Asia/Jakarta, used for month navigation and grouping. */
export function hariJakarta(value) {
  const time = ms(value);
  if (time === null) return null;
  return new Date(time + HARI_JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

export function bulanJakarta(value) {
  const hari = hariJakarta(value);
  return hari ? hari.slice(0, 7) : null;
}

/**
 * Window of one WIB calendar month [start, next start) or, without bulan/tahun, the agenda window
 * that covers the timeline: three months of finished events plus a year of upcoming ones.
 */
export function rentangWindow({ bulan = null, tahun = null } = {}, now = new Date()) {
  const time = ms(now) ?? Date.now();
  if (bulan && tahun) {
    // WIB midnight of the first day is 17:00 UTC of the previous day (UTC+7, no DST).
    const mulai = Date.UTC(tahun, bulan - 1, 1) - HARI_JAKARTA_OFFSET_MS;
    const akhir = Date.UTC(tahun, bulan, 1) - HARI_JAKARTA_OFFSET_MS;
    return { dari: new Date(mulai), sampai: new Date(akhir) };
  }
  return {
    dari: new Date(time - AGENDA_HARI_MUNDUR * 86_400_000),
    sampai: new Date(time + AGENDA_HARI_MAJU * 86_400_000),
  };
}

const daftar = (raw) => {
  const value = Array.isArray(raw) ? raw.join(",") : String(raw ?? "");
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
};

const tidakValid = (field) => new ProgramError(400, "INVALID_PAYLOAD", `The field "${field}" is not valid.`);

/**
 * Query of the public list: bulan/tahun, kategori, penyelenggara, metode, ramah, status. Unknown
 * values are refused instead of silently ignored, so the count shown always matches the request.
 */
export function parseQueryKegiatan(query = {}) {
  const one = (key) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const bulan = one("bulan") === undefined || one("bulan") === "" ? null : Number(one("bulan"));
  const tahun = one("tahun") === undefined || one("tahun") === "" ? null : Number(one("tahun"));
  if (bulan !== null && (!Number.isInteger(bulan) || bulan < 1 || bulan > 12)) throw tidakValid("bulan");
  if (tahun !== null && (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100)) throw tidakValid("tahun");
  if ((bulan === null) !== (tahun === null)) throw tidakValid("bulan");

  const kategori = daftar(one("kategori"));
  for (const value of kategori) if (!KATEGORI_VALUES.includes(value)) throw tidakValid("kategori");

  const penyelenggara = daftar(one("penyelenggara"));
  if (penyelenggara.length > 40) throw tidakValid("penyelenggara");
  for (const value of penyelenggara) if (value.length > 160) throw tidakValid("penyelenggara");

  const metode = one("metode") ?? null;
  if (metode !== null && metode !== "" && !METODE_VALUES.includes(metode)) throw tidakValid("metode");

  const status = daftar(one("status"));
  for (const value of status) if (!STATUS_VALUES.includes(value)) throw tidakValid("status");

  const ramahRaw = one("ramah");
  const ramah = ramahRaw === "1" || ramahRaw === "true" || ramahRaw === true;

  return { bulan, tahun, kategori, penyelenggara, metode: metode || null, ramah, status };
}

// No markup characters in the local part and a plain host name: the masked address is shown back
// on an HTML page (kegiatan/index.js), so it must never be able to carry a tag.
const EMAIL_PATTERN = /^[^\s@<>"'`&]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

/**
 * Normalised reminder target: lower-cased email or an international Indonesian mobile number.
 * Invalid input is refused here (nomor tak valid) instead of being stored and failing later.
 */
export function normalisasiTujuan(kanal, tujuan) {
  const value = typeof tujuan === "string" ? tujuan.trim() : "";
  if (kanal === "email") {
    const email = value.toLowerCase();
    if (email.length > 160 || !EMAIL_PATTERN.test(email)) {
      throw new ProgramError(400, "TUJUAN_TIDAK_VALID", "The email address is not valid.");
    }
    return email;
  }
  if (kanal === "whatsapp") {
    const normal = normalisasiTeleponSeluler(value);
    if (!normal) {
      throw new ProgramError(400, "TUJUAN_TIDAK_VALID", "The WhatsApp number is not valid.");
    }
    return normal;
  }
  throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "kanal" is not valid.');
}

/** Address as it may be shown back to the visitor: never the full personal value. */
export function maskTujuan(kanal, tujuan) {
  if (kanal === "email") {
    const [local, domain] = String(tujuan).split("@");
    if (!domain) return "***";
    return `${local.slice(0, 1)}***@${domain}`;
  }
  const digits = String(tujuan).replace(/\D/g, "");
  return `${digits.slice(0, 5)}****${digits.slice(-3)}`;
}

/**
 * Default reminder moment: one day before the event starts, never in the past (a visitor who opts
 * in less than a day before the event gets the reminder on the next job tick).
 */
export function jadwalPengingat(tanggalMulai, now = new Date()) {
  const mulai = ms(tanggalMulai);
  const time = ms(now) ?? Date.now();
  if (mulai === null) return new Date(time);
  return new Date(Math.max(mulai - 86_400_000, time));
}

/** Requested schedule of an opt-in: absolute ISO instant between now and the event start. */
export function parseJadwalKirim(value, { tanggalMulai, tanggalSelesai }, now = new Date()) {
  if (value === undefined || value === null || value === "") return jadwalPengingat(tanggalMulai, now);
  const waktu = ms(value);
  const time = ms(now) ?? Date.now();
  const selesai = ms(tanggalSelesai);
  if (waktu === null) throw tidakValid("jadwalKirim");
  if (waktu < time - 60_000) throw tidakValid("jadwalKirim");
  if (selesai !== null && waktu > selesai) throw tidakValid("jadwalKirim");
  return new Date(waktu);
}

/** Counts per status group of the already filtered rows, so the timeline headers and the API agree. */
export function kelompokStatus(list, now = new Date()) {
  const kelompok = Object.fromEntries(STATUS_VALUES.map((value) => [value, 0]));
  for (const item of list) {
    const status = item.status ?? statusKegiatan(item, now);
    kelompok[status] += 1;
  }
  return kelompok;
}

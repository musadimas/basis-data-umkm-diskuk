/** Klinik scheduling rules (Brief Fitur Modul 7.3). Pure functions for unit tests. */
import { jakartaDate } from "../kpi/rules.js";

export const SLOTS = ["09:00", "10:30", "13:00", "14:30"];
export const MAX_HARI_KE_DEPAN = 30;
export const STATUS = ["masuk", "dijadwalkan", "berjalan", "tindak_lanjut", "selesai", "batal"];
export const PRIORITAS = ["normal", "tinggi", "mendesak"];
export const RUJUKAN = ["sarpras", "vokasi", "mediasi_sapa", "talent_lab"];
export const ASPEK_DIAGNOSIS = ["legalitas", "keuangan", "pemasaran", "produksi", "sdm"];

const DAY = 86_400_000;

/**
 * A consultation can be booked on a weekday from tomorrow up to 30 days ahead (Jakarta dates).
 * Returns null when valid, else a reason code.
 */
export function tanggalTidakValid(tanggal, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tanggal))) return "TANGGAL_TIDAK_VALID";
  const target = Date.parse(`${tanggal}T00:00:00Z`);
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 10) !== tanggal) return "TANGGAL_TIDAK_VALID";
  const today = Date.parse(`${jakartaDate(now)}T00:00:00Z`);
  if (target <= today || target > today + MAX_HARI_KE_DEPAN * DAY) return "TANGGAL_DI_LUAR_RENTANG";
  const weekday = new Date(target).getUTCDay();
  if (weekday === 0 || weekday === 6) return "TANGGAL_AKHIR_PEKAN";
  return null;
}

/** Ticket number KLN-YYYY-MM-NNNN (Jakarta month); the counter keeps growing past 9999. */
export function nomorTiket(sequence, now = new Date()) {
  const [year, month] = jakartaDate(now).split("-");
  return `KLN-${year}-${month}-${String(sequence).padStart(4, "0")}`;
}

/** First bytes of the accepted attachment types; the declared MIME type alone is not trusted. */
export function sniffType(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

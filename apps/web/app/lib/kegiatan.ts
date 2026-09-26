/** Event calendar helpers for the public /kegiatan page (Brief Fitur Modul 7.2). */
import type { Kegiatan, KategoriKegiatan } from "~/types/program";

export type StatusKegiatan = "berjalan" | "pendaftaran" | "segera" | "selesai";

export const STATUS_KEGIATAN: Record<StatusKegiatan, { label: string; className: string }> = {
  berjalan: { label: "Sedang Berjalan", className: "bg-emerald-100 text-emerald-800" },
  pendaftaran: { label: "Pendaftaran Dibuka", className: "bg-sky-100 text-sky-800" },
  segera: { label: "Segera Datang", className: "bg-amber-100 text-amber-900" },
  selesai: { label: "Selesai", className: "bg-slate-200 text-slate-700" },
};

export const KATEGORI_KEGIATAN: Record<KategoriKegiatan, { label: string; dot: string; className: string }> = {
  pelatihan: { label: "Pelatihan", dot: "bg-blue-600", className: "bg-blue-100 text-blue-800" },
  pameran: { label: "Pameran", dot: "bg-purple-600", className: "bg-purple-100 text-purple-800" },
  bazar: { label: "Bazar", dot: "bg-orange-500", className: "bg-orange-100 text-orange-800" },
  seminar: { label: "Seminar", dot: "bg-teal-600", className: "bg-teal-100 text-teal-800" },
  temu_bisnis: { label: "Temu Bisnis", dot: "bg-rose-600", className: "bg-rose-100 text-rose-800" },
  lainnya: { label: "Lainnya", dot: "bg-slate-500", className: "bg-slate-100 text-slate-700" },
};

export const METODE_LABEL: Record<Kegiatan["metode"], string> = { luring: "Luring", daring: "Daring", hybrid: "Hybrid" };

/**
 * Status derived from the dates: running between start and end; before the start it is open for
 * registration unless the deadline has passed or the quota is full ("Segera Datang").
 */
export function statusKegiatan(kegiatan: Pick<Kegiatan, "tanggal_mulai" | "tanggal_selesai" | "batas_registrasi" | "kuota" | "terisi">, now = new Date()): StatusKegiatan {
  const time = now.getTime();
  const mulai = Date.parse(kegiatan.tanggal_mulai);
  const selesai = Date.parse(kegiatan.tanggal_selesai);
  if (time > selesai) return "selesai";
  if (time >= mulai) return "berjalan";
  const tutup = kegiatan.batas_registrasi ? Date.parse(kegiatan.batas_registrasi) : mulai;
  const penuh = kegiatan.kuota !== null && kegiatan.terisi >= kegiatan.kuota;
  return time <= tutup && !penuh ? "pendaftaran" : "segera";
}

/** Calendar day in Asia/Jakarta as YYYY-MM-DD. */
export function hariJakarta(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

/** Weeks (Monday first) covering a month; days outside the month are null. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** Events that take place on a calendar day (Jakarta time), including multi-day events. */
export function kegiatanPadaHari(list: Kegiatan[], day: string): Kegiatan[] {
  return list.filter((item) => hariJakarta(item.tanggal_mulai) <= day && day <= hariJakarta(item.tanggal_selesai));
}

/** Directus filter for events overlapping [from, to). */
export function rentangFilter(from: Date, to: Date) {
  return { _and: [{ tanggal_mulai: { _lt: to.toISOString() } }, { tanggal_selesai: { _gte: from.toISOString() } }] };
}

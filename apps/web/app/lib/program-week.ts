// Y03 — mirror program-week.js backend (vektor identik diuji dua sisi).
// Minggu program dari tanggal_mulai (WIB), batas jumlah_minggu.
// Pelaporan baru hanya Jumat WIB; replay offline Jumat sah maks 7 hari.

export function tanggalJakarta(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function jakartaWeekday(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
  }).format(date);
}

export function isJumatJakarta(date: Date = new Date()): boolean {
  return jakartaWeekday(date) === "Friday";
}

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || "")) return null;
  const parts = ymd.split("-").map(Number);
  const y = parts[0] as number;
  const m = parts[1] as number;
  const d = parts[2] as number;
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function mingguKe(tanggalMulai: string, now: Date = new Date()): number {
  const start = parseYmd(tanggalMulai);
  if (!start) return 0;
  const today = parseYmd(tanggalJakarta(now));
  if (!today) return 0;
  const hari = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  if (hari < 0) return 0;
  return Math.floor(hari / 7) + 1;
}

export function targetMingguan(
  omzetTahunan: number | null | undefined,
  faktorTarget = 1.2,
  override: number | null | undefined = null,
): number | null {
  if (override !== null && override !== undefined) return override;
  if (omzetTahunan === null || omzetTahunan === undefined) return null;
  const omzet = Number(omzetTahunan);
  const faktor = Number(faktorTarget);
  if (!Number.isFinite(omzet) || !Number.isFinite(faktor)) return null;
  return Math.round((omzet / 52) * faktor);
}

export function capaianPersen(omzet: number, target: number | null | undefined): number | null {
  if (target === null || target === undefined) return null;
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) return null;
  const o = Number(omzet);
  if (!Number.isFinite(o)) return null;
  return Math.round((o / t) * 1000) / 10;
}

export function formatTanggalKalender(ymd: string): string {
  const parts = ymd.split("-").map(Number);
  const y = parts[0] as number;
  const m = parts[1] as number;
  const d = parts[2] as number;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function layakRekomendasi(
  laporan: { mingguKe: number; omzet: number; target: number | null; status: string }[] = [],
): boolean {
  const rows = [...laporan]
    .filter((l) => Number.isInteger(Number(l.mingguKe)))
    .map((l) => ({
      mingguKe: Number(l.mingguKe),
      omzet: Number(l.omzet),
      target: l.target === null || l.target === undefined ? null : Number(l.target),
      status: l.status,
    }))
    .sort((a, b) => a.mingguKe - b.mingguKe);
  let run = 0;
  let last: number | null = null;
  for (const r of rows) {
    const ok =
      r.status === "disetujui" &&
      r.target !== null &&
      Number.isFinite(r.target as number) &&
      (r.target as number) > 0 &&
      Number.isFinite(r.omzet) &&
      r.omzet >= (r.target as number);
    if (!ok) {
      run = 0;
      last = r.mingguKe;
      continue;
    }
    run = last !== null && r.mingguKe === last + 1 && run > 0 ? run + 1 : 1;
    if (run >= 4) return true;
    last = r.mingguKe;
  }
  return false;
}

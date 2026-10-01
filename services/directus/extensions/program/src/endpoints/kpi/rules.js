/** Weekly KPI rules (Brief Fitur Modul 5). Pure functions so they are unit-tested directly. */

export const PITCHING_STREAK = 4;

/** Calendar date in Asia/Jakarta as YYYY-MM-DD. */
export function jakartaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Day of week in Asia/Jakarta: 0 = Sunday … 5 = Friday. */
export function jakartaWeekday(now = new Date()) {
  return new Date(`${jakartaDate(now)}T00:00:00Z`).getUTCDay();
}

/** M5-03: weekly reports are made on Friday, Asia/Jakarta. */
export const HARI_LAPOR = 5;
/** A report drafted offline on a Friday may sync up to this many days later. */
export const BATAS_SINKRON_HARI = 7;
/** Device clocks ahead of the server by more than this are refused. */
export const TOLERANSI_JAM_MS = 5 * 60_000;

/**
 * When a report counts as made: the server clock, or the device time of an offline draft
 * (`dibuatPada`). A device time must be a valid instant, not ahead of the server beyond the
 * tolerance, and at most BATAS_SINKRON_HARI old. Returns null when the device time is refused.
 */
export function waktuLaporan(dibuatPada, now = new Date()) {
  if (dibuatPada == null) return { waktu: now, klien: null };
  if (typeof dibuatPada !== "string") return null;
  const waktu = new Date(dibuatPada);
  const selisih = now.getTime() - waktu.getTime();
  if (!Number.isFinite(selisih) || selisih < -TOLERANSI_JAM_MS || selisih > BATAS_SINKRON_HARI * 86_400_000) return null;
  return { waktu, klien: waktu };
}

export function hariLapor(waktu) {
  return jakartaWeekday(waktu) === HARI_LAPOR;
}

/**
 * Programme week for a date: week 1 starts on tanggal_mulai. 0 before the start; capped at
 * jumlah_minggu after the end.
 */
export function currentWeek(tanggalMulai, jumlahMinggu, now = new Date()) {
  const start = Date.parse(`${String(tanggalMulai).slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${jakartaDate(now)}T00:00:00Z`);
  if (!Number.isFinite(start) || today < start) return 0;
  const week = Math.floor((today - start) / (7 * 86_400_000)) + 1;
  return Math.min(week, Number(jumlahMinggu));
}

/**
 * Rangkaian minggu terbaru yang disetujui dan mencapai target (BUG-014). Laporan `menunggu`
 * di ujung belum dihitung; L = minggu tertinggi di antara laporan yang sudah ditinjau. Berjalan
 * mundur dari L: berhenti pada minggu yang hilang, ditolak, di bawah target, atau masih menunggu.
 */
export function latestTargetStreak(reports) {
  const byWeek = new Map(reports.map((report) => [Number(report.mingguKe), report]));
  const reviewed = reports.filter((report) => report.status !== "menunggu").map((report) => Number(report.mingguKe));
  if (!reviewed.length) return 0;
  let streak = 0;
  for (let week = Math.max(...reviewed); week >= 1; week -= 1) {
    const report = byWeek.get(week);
    if (!report || report.status !== "disetujui" || !(Number(report.realisasiOmzet) >= Number(report.target))) break;
    streak += 1;
  }
  return streak;
}

export function pitchingEligible(reports) {
  return latestTargetStreak(reports) >= PITCHING_STREAK;
}

/** Achievement against target in percent, one decimal. */
export function capaian(realisasi, target) {
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) return null;
  return Math.round((Number(realisasi) / t) * 1000) / 10;
}

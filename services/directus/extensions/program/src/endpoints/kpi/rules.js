/** Weekly KPI rules (Brief Fitur Modul 5). Pure functions so they are unit-tested directly. */

export const PITCHING_STREAK = 4;

/** Calendar date in Asia/Jakarta as YYYY-MM-DD. */
export function jakartaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
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

/** Longest run of consecutive weeks whose approved turnover met the week's target. */
export function longestTargetStreak(reports) {
  const met = new Set(
    reports
      .filter((report) => report.status === "disetujui" && Number(report.realisasiOmzet) >= Number(report.target))
      .map((report) => Number(report.mingguKe)),
  );
  let best = 0;
  for (const week of met) {
    if (met.has(week - 1)) continue;
    let length = 1;
    while (met.has(week + length)) length += 1;
    best = Math.max(best, length);
  }
  return best;
}

export function pitchingEligible(reports) {
  return longestTargetStreak(reports) >= PITCHING_STREAK;
}

/** Achievement against target in percent, one decimal. */
export function capaian(realisasi, target) {
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) return null;
  return Math.round((Number(realisasi) / t) * 1000) / 10;
}

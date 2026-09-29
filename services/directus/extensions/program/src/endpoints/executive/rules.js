import { jakartaDate } from "../kpi/rules.js";

const WEEK_MS = 7 * 86_400_000;
const round1 = (n) => Math.round(n * 10) / 10;

export function completedWeeks(start, length, now = new Date()) {
  const first = Date.parse(`${String(start).slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${jakartaDate(now)}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(today) || today < first) return 0;
  return Math.max(0, Math.min(Number(length), Math.floor((today - first) / WEEK_MS)));
}

/** All values derive from approved weekly reports. A missing week breaks an at-risk run. */
export function aggregateProgram(participants, now = new Date()) {
  const trend = Array.from({ length: 12 }, (_, i) => ({ minggu: i + 1, target: 0, realisasi: null }));
  let expected = 0;
  let approved = 0;
  let growthTotal = 0;
  let growthCount = 0;
  const atRisk = [];
  for (const p of participants) {
    const limit = Math.min(12, Number(p.jumlah_minggu));
    const elapsed = completedWeeks(p.tanggal_mulai, limit, now);
    expected += elapsed;
    const byWeek = new Map((p.laporan ?? []).filter((l) => l.status === "disetujui").map((l) => [Number(l.minggu_ke), l]));
    const baseline = p.omzet_tahunan == null ? null : Number(p.omzet_tahunan) / 52;
    const actuals = [];
    for (let week = 1; week <= limit; week++) {
      const point = trend[week - 1];
      point.target += Number(p.target_mingguan);
      const report = byWeek.get(week);
      if (week > elapsed || !report || report.realisasi_omzet == null) continue;
      const amount = Number(report.realisasi_omzet);
      if (!Number.isFinite(amount) || amount < 0) continue;
      approved++;
      point.realisasi = (point.realisasi ?? 0) + amount;
      actuals.push(amount);
    }
    if (baseline !== null && Number.isFinite(baseline) && baseline > 0 && actuals.length) {
      growthTotal += ((actuals.reduce((a, b) => a + b, 0) / actuals.length - baseline) / baseline) * 100;
      growthCount++;
    }
    if (baseline !== null && baseline > 0 && elapsed >= 2) {
      const a = byWeek.get(elapsed - 1);
      const b = byWeek.get(elapsed);
      if (a && b && a.realisasi_omzet != null && b.realisasi_omzet != null &&
          Number.isFinite(Number(a.realisasi_omzet)) && Number.isFinite(Number(b.realisasi_omzet)) &&
          Number(a.realisasi_omzet) >= 0 && Number(b.realisasi_omzet) >= 0 &&
          Number(a.realisasi_omzet) <= baseline * 0.7 && Number(b.realisasi_omzet) <= baseline * 0.7) {
        atRisk.push({
          pesertaId: p.id,
          usahaId: p.usaha,
          nama: p.nama,
          kota: p.kota_nama,
          pendampingId: p.pendamping,
          pendamping: p.pendamping_nama,
          mingguAkhir: elapsed,
          latitude: p.latitude == null ? null : Number(p.latitude),
          longitude: p.longitude == null ? null : Number(p.longitude),
        });
      }
    }
  }
  return {
    kepatuhan: { terverifikasi: approved, diharapkan: expected, persen: expected ? round1((approved / expected) * 100) : null, targetLebihDari: 95 },
    kenaikanOmzet: { persen: growthCount ? round1(growthTotal / growthCount) : null, pesertaDihitung: growthCount, sumber: "SIDT tahunan / 52 vs rata-rata laporan disetujui" },
    tren: trend,
    atRisk,
  };
}

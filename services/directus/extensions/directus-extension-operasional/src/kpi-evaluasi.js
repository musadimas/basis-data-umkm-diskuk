"use strict";

// Y03 — evaluasi KPI mingguan (murni, dipakai binaan-service + web).
// Aturan target nol: capaian null bila target null/0 (UI menampilkan "—").
// Rekomendasi: ≥4 minggu BERURUTAN (minggu_ke naik 1) dengan
// status "disetujui", target tidak null dan >0, serta omzet >= target.

function capaianPersen(omzet, target) {
  if (target === null || target === undefined) return null;
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) return null;
  const o = Number(omzet);
  if (!Number.isFinite(o)) return null;
  return Math.round((o / t) * 1000) / 10;
}

function normalisasiLaporan(laporan = []) {
  return [...laporan]
    .filter((l) => l && Number.isInteger(Number(l.mingguKe)))
    .map((l) => ({
      mingguKe: Number(l.mingguKe),
      omzet: Number(l.omzet),
      target: l.target === null || l.target === undefined ? null : Number(l.target),
      status: l.status,
    }))
    .sort((a, b) => a.mingguKe - b.mingguKe);
}

function layakRekomendasi(laporan = []) {
  const rows = normalisasiLaporan(laporan);
  let run = 0;
  let lastMinggu = null;
  for (const r of rows) {
    const memenuhi =
      r.status === "disetujui" &&
      r.target !== null &&
      Number.isFinite(r.target) &&
      r.target > 0 &&
      Number.isFinite(r.omzet) &&
      r.omzet >= r.target;
    if (!memenuhi) {
      run = 0;
      lastMinggu = r.mingguKe;
      continue;
    }
    if (lastMinggu !== null && r.mingguKe === lastMinggu + 1 && run > 0) {
      run += 1;
    } else {
      run = 1;
    }
    if (run >= 4) return true;
    lastMinggu = r.mingguKe;
  }
  return false;
}

module.exports = { capaianPersen, layakRekomendasi };

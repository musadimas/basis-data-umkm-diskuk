/**
 * Rentang divisi KBLI 2020 per sektor huruf (A–U).
 * Sumber tunggal: services/directus/analytics-shared/contracts.cjs (KBLI_SECTORS);
 * salinan ini hanya memetakan huruf → rentang divisi, tanpa nama panjang.
 */
export const KBLI_SECTOR_DIVISIONS = [
  { code: "A", start: 1, end: 3 },
  { code: "B", start: 5, end: 9 },
  { code: "C", start: 10, end: 33 },
  { code: "D", start: 35, end: 35 },
  { code: "E", start: 36, end: 39 },
  { code: "F", start: 41, end: 43 },
  { code: "G", start: 45, end: 47 },
  { code: "H", start: 49, end: 53 },
  { code: "I", start: 55, end: 56 },
  { code: "J", start: 58, end: 63 },
  { code: "K", start: 64, end: 66 },
  { code: "L", start: 68, end: 68 },
  { code: "M", start: 69, end: 75 },
  { code: "N", start: 77, end: 82 },
  { code: "O", start: 84, end: 84 },
  { code: "P", start: 85, end: 85 },
  { code: "Q", start: 86, end: 88 },
  { code: "R", start: 90, end: 93 },
  { code: "S", start: 94, end: 96 },
  { code: "T", start: 97, end: 98 },
  { code: "U", start: 99, end: 99 },
] as const;

/** Huruf sektor untuk sebuah kode KBLI (berdasarkan 2 digit pertama), atau null bila tidak terpetakan. */
export function sectorForKbli(kode: string | null | undefined): string | null {
  const division = /^\d{2,5}$/.test(kode ?? "")
    ? Number(String(kode).slice(0, 2))
    : null;
  if (division === null) return null;
  return (
    KBLI_SECTOR_DIVISIONS.find(
      (sector) => division >= sector.start && division <= sector.end,
    )?.code ?? null
  );
}

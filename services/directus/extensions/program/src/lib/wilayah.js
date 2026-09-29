// Reference regions of Jawa Barat used by the public agenda (Y07/M7-08).
//
// The 27 kabupaten/kota are a fixed administrative fact, so the "penyelenggara" filter can always
// offer all 27 dinas even when the reference `kota` table of a given environment only carries the
// regions that already have data. Names match the public `kota` grant so both surfaces agree.
export const KABUPATEN_KOTA_JABAR = [
  "Kabupaten Bandung",
  "Kabupaten Bandung Barat",
  "Kabupaten Bekasi",
  "Kabupaten Bogor",
  "Kabupaten Ciamis",
  "Kabupaten Cianjur",
  "Kota Bandung",
  "Kabupaten Cirebon",
  "Kota Cirebon",
  "Kabupaten Garut",
  "Kabupaten Indramayu",
  "Kabupaten Karawang",
  "Kabupaten Kuningan",
  "Kabupaten Majalengka",
  "Kabupaten Pangandaran",
  "Kabupaten Purwakarta",
  "Kabupaten Subang",
  "Kabupaten Sukabumi",
  "Kabupaten Sumedang",
  "Kabupaten Tasikmalaya",
  "Kota Bekasi",
  "Kota Bogor",
  "Kota Cimahi",
  "Kota Depok",
  "Kota Sukabumi",
  "Kota Tasikmalaya",
  "Kota Banjar",
];

export const PENYELENGGARA_PROVINSI = "Dinas KUKM Provinsi Jawa Barat";

/** "Dinas KUMKM <kabupaten/kota>" for each of the 27 regions, in the reference order. */
export function dinasKabKota() {
  return KABUPATEN_KOTA_JABAR.map((nama) => `Dinas KUMKM ${nama}`);
}

/**
 * Fixed penyelenggara options: province, the 27 dinas kabupaten/kota, and the remaining two
 * groups the brief names (kementerian/lembaga and mitra). Values found in published events are
 * appended by the caller so partners that document themselves with another name still appear.
 */
export function opsiPenyelenggaraTetap() {
  return [PENYELENGGARA_PROVINSI, ...dinasKabKota(), "Kementerian/Lembaga", "Mitra"];
}

/** Fixed options plus event values, de-duplicated and sorted for a stable dropdown. */
export function gabungkanPenyelenggara(tetap = opsiPenyelenggaraTetap(), dariData = []) {
  const tetapSet = new Set(tetap);
  const lain = dariData.filter((value) => typeof value === "string" && value.trim() !== "" && !tetapSet.has(value));
  return [...tetap, ...[...new Set(lain)].sort()];
}

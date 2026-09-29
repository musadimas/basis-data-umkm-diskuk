/** Aturan katalog yang murni: dipakai service, mock Playwright, dan tes tanpa database. */
import { ProgramError } from "../../lib/utils/http.js";
import { oneOf, optionalText } from "../../lib/validate.js";

export const KURASI_STATUS = ["menunggu", "tayang", "rekomendasi_marketplace", "ditolak"];
/** Keputusan yang boleh diambil kurator (status `menunggu` hanya hasil pengajuan/ubah). */
export const KURASI_KEPUTUSAN = ["tayang", "rekomendasi_marketplace", "ditolak"];
/** Only these states are catalog-worthy; everything else stays invisible to the public. */
export const STATUS_TAYANG = ["tayang", "rekomendasi_marketplace"];

/** Anti-spam bound for the public letter-of-intent form: N letters per origin per window. */
export const LOI_MAX_PER_WINDOW = 5;
export const LOI_WINDOW_MINUTES = 10;
/** Surat dengan isi yang sama pada produk yang sama dalam jendela ini dianggap satu. */
export const LOI_DUPLIKAT_JAM = 24;

/** Keputusan kurasi dari body; penolakan wajib bercatatan. */
export function validasiKurasi(body) {
  const keputusan = oneOf(body, "keputusan", KURASI_KEPUTUSAN);
  const catatan = optionalText(body, "catatan", 2000);
  if (keputusan === "ditolak" && !catatan) {
    throw new ProgramError(400, "CATATAN_WAJIB", "A note is required when rejecting a product.");
  }
  return { keputusan, catatan };
}

/** "Rp 12.000 - Rp 15.000" dari harga grosir dan retail; satu harga bila hanya satu; null bila kosong. */
export function hargaRange(retail, grosir) {
  const prices = [retail, grosir].filter((value) => value !== null && value !== undefined).map(Number);
  if (!prices.length) return null;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const format = (value) => `Rp ${value.toLocaleString("id-ID")}`;
  return low === high ? format(low) : `${format(low)} - ${format(high)}`;
}

/**
 * Apakah `input` mengulang surat yang sudah tersimpan? Selalu per produk: kunci klien yang sama,
 * atau e-mail + pesan yang sama dalam LOI_DUPLIKAT_JAM terakhir (cermin kueri SQL di service).
 * `surat`: [{ produk, clientUuid, email, pesan, dateCreated }].
 */
export function loiDuplikat(surat, input, now = Date.now()) {
  const batas = now - LOI_DUPLIKAT_JAM * 3_600_000;
  return surat.some(
    (item) =>
      item.produk === input.produk &&
      (item.clientUuid === input.clientUuid ||
        (item.email === input.email && item.pesan === input.pesan && Date.parse(item.dateCreated) > batas)),
  );
}

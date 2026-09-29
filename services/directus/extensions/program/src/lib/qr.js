import { encode as encodeQr } from "uqr";

/** Matriks modul QR untuk `renderDokumen`; module shared tidak bisa me-resolve `uqr`. */
export function qrModul(teks) {
  return encodeQr(String(teks), { border: 2 }).data;
}

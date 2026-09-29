/**
 * Talent Passport QR certificate as a one-page PDF (Y04/M6-01). The browser renders the QR onto a
 * canvas and this module wraps the JPEG bytes into a valid PDF (DCTDecode image XObject) — pure
 * TypeScript, no PDF dependency. Layout: title, business name, the QR itself, the code and the
 * verification URL, plus the issuer line.
 */

import { INSTANSI } from "~/constants/OPERASIONAL";

export interface QrPdfMeta {
  kode: string;
  url: string;
  nama: string;
  diterbitkanAt?: string;
}

export const PAGE_WIDTH = 298;
export const PAGE_HEIGHT = 420;

/** PDF text strings are Latin-1; anything else becomes "?" so the file stays valid. */
function latin1(value: string): string {
  return value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function pdfString(value: string): string {
  return `(${latin1(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
}

function textLine(x: number, y: number, font: string, size: number, value: string): string {
  return `BT /${font} ${size} Tf ${x} ${y} Td ${pdfString(value)} Tj ET`;
}

/** JPEG bytes → single-page PDF bytes. Exported (pure) for unit tests. */
export function jpegPdf(jpeg: Uint8Array, width: number, height: number, meta: QrPdfMeta): Uint8Array {
  const issuer = `Diterbitkan oleh ${INSTANSI}`;
  const terbit = meta.diterbitkanAt ? new Date(meta.diterbitkanAt).toLocaleDateString("id-ID", { dateStyle: "long" }) : "";
  const content = [
    textLine(24, 392, "F2", 16, "Talent Passport · Jawa Barat"),
    textLine(24, 372, "F1", 11, meta.nama),
    `q 220 0 0 220 39 128 cm /Im0 Do Q`,
    textLine(24, 104, "F2", 13, meta.kode),
    textLine(24, 86, "F1", 8, meta.url),
    textLine(24, 44, "F1", 8, issuer),
    terbit ? textLine(24, 30, "F1", 8, `Diterbitkan ${terbit}`) : "",
    textLine(24, 58, "F1", 7, "Scan QR ini untuk memverifikasi keaslian Talent Passport pada situs resmi DISKUK Jawa Barat."),
  ]
    .filter(Boolean)
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 6 0 R /F2 7 0 R >> /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let position = 0;
  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    position += bytes.length;
  };
  const push = (value: string) => {
    pushBytes(Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff));
  };
  push("%PDF-1.4\n");
  objects.forEach((body, index) => {
    offsets.push(position);
    push(`${index + 1} 0 obj\n${body}`);
    // The image stream is binary; its "endstream" keyword is appended with the raw JPEG length.
    if (index === 3) {
      pushBytes(jpeg);
      push("\nendstream\nendobj\n");
    } else {
      push("\nendobj\n");
    }
  });
  const xrefPosition = position;
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets) push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF\n`);
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Canvas (with the QR already drawn) → data:application/pdf URL for a download link. */
export async function qrPdfDataUrl(canvas: HTMLCanvasElement, meta: QrPdfMeta): Promise<string> {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const jpeg = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const pdf = jpegPdf(jpeg, canvas.width, canvas.height, meta);
  let binaryPdf = "";
  for (const byte of pdf) binaryPdf += String.fromCharCode(byte);
  return `data:application/pdf;base64,${btoa(binaryPdf)}`;
}

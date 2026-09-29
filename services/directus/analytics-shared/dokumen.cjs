"use strict";

/**
 * Module Dokumen (Kandidat 05): satu-satunya serializer PDF server. Model isi masuk, `Buffer` keluar,
 * tanpa dependency (folder ini tidak punya node_modules). QR dikirim pemanggil sebagai matriks
 * boolean karena `uqr` hanya bisa di-resolve dari program dan worker.
 *
 * Stream memakai WinAnsi: satu karakter = satu byte latin1. `/Length` dan offset xref dihitung per
 * byte latin1, jadi teks non-ASCII seperti "Café" dan "·" tidak menjadi mojibake (B26).
 */

const INSTANSI = "Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat";

/** Helvetica 9 pt muat sekitar 95 karakter di media box 595 pt. */
const LEBAR_BARIS = 95;
const BARIS_PER_HALAMAN = 44;

function teksPdf(value) {
  return String(value ?? "")
    .replace(/—|–/g, "-")
    .replace(/×/g, "x")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/•/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?")
    .replace(/([\\()])/g, "\\$1");
}

/** Bungkus pada spasi supaya tidak ada kata hilang; tiap potongan tetap dihitung ke anggaran halaman. */
function bungkusTeks(value, lebar = LEBAR_BARIS) {
  const kata = String(value ?? "")
    .split(/\s+/)
    .filter(Boolean);
  if (!kata.length) return [""];
  const potongan = [];
  let baris = "";
  for (const satu of kata) {
    if (!baris) baris = satu;
    else if (baris.length + 1 + satu.length <= lebar) baris += ` ${satu}`;
    else {
      potongan.push(baris);
      baris = satu;
    }
  }
  potongan.push(baris);
  return potongan;
}

/** URL publik web; env yang diinjeksi didahulukan, lalu `process.env`, lalu default lokal. */
function publicUrl(env) {
  return (
    env?.PUBLIC_WEB_URL ||
    process.env.PUBLIC_WEB_URL ||
    env?.PUBLIC_URL ||
    process.env.PUBLIC_URL ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

function operatorQr(qr) {
  const modul = qr?.modul;
  if (!Array.isArray(modul) || !modul.length) return "";
  const ukuran = Number(qr.ukuran) || 100;
  const size = modul.length;
  const originX = 595 - 50 - ukuran;
  const originY = 842 - 50 - ukuran;
  const cellSize = ukuran / size;
  const rects = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modul[y][x]) {
        const cx = originX + x * cellSize;
        const cy = originY + (size - 1 - y) * cellSize;
        rects.push(`${cx.toFixed(2)} ${cy.toFixed(2)} ${cellSize.toFixed(2)} ${cellSize.toFixed(2)} re`);
      }
    }
  }
  return `q\n0 g\n${rects.join("\n")}\nf\nQ\n`;
}

function paginasi(bagian) {
  const items = [];
  for (const b of bagian) {
    if (!b) continue;
    if (b.judul) items.push({ type: "heading", text: b.judul });
    for (const line of b.baris || []) {
      for (const potongan of bungkusTeks(line)) items.push({ type: "line", text: potongan });
    }
    items.push({ type: "spacer" });
  }
  const halaman = [];
  let sekarang = [];
  let terpakai = 0;
  for (const item of items) {
    const biaya = item.type === "heading" ? 2 : 1;
    if (terpakai + biaya > BARIS_PER_HALAMAN && sekarang.length > 0) {
      halaman.push(sekarang);
      sekarang = [];
      terpakai = 0;
    }
    sekarang.push(item);
    terpakai += biaya;
  }
  if (sekarang.length > 0 || halaman.length === 0) halaman.push(sekarang);
  return halaman;
}

/**
 * @param {{judul?: string, subjudul?: string, bagian?: {judul?: string, baris?: string[]}[],
 *   qr?: {modul: boolean[][], ukuran?: number} | null,
 *   meta?: {generatedAt?: string, sumber?: string}}} model
 * @returns {Buffer}
 */
function renderDokumen({ judul = "Dokumen Resmi", subjudul = "", bagian = [], qr = null, meta = {} } = {}) {
  const halaman = paginasi(bagian);
  const totalPages = halaman.length;
  const generatedAt = meta.generatedAt || new Date().toISOString().slice(0, 10);
  const qrOps = operatorQr(qr);

  const pageStreams = halaman.map((pageItems, idx) => {
    const pageNum = idx + 1;
    const stream = [];
    if (pageNum === 1 && qrOps) stream.push(qrOps);
    stream.push("BT");
    if (pageNum === 1) {
      stream.push("/F1 15 Tf", "50 790 Td", `(${teksPdf(judul)}) Tj`);
      if (subjudul) {
        stream.push("0 -18 Td", "/F2 10 Tf", `(${teksPdf(subjudul)}) Tj`, "0 -16 Td");
      } else {
        stream.push("0 -24 Td");
      }
    } else {
      stream.push("/F1 11 Tf", "50 790 Td", `(${teksPdf(`${judul} - sambungan`)}) Tj`, "0 -20 Td");
    }
    for (const item of pageItems) {
      if (item.type === "heading") stream.push("/F1 11 Tf", `(${teksPdf(item.text)}) Tj`, "0 -15 Td");
      else if (item.type === "line") stream.push("/F2 9 Tf", `(${teksPdf(item.text)}) Tj`, "0 -13 Td");
      else stream.push("0 -8 Td");
    }
    stream.push("ET");

    // Dua baris footer 8 pt supaya tidak melewati tepi halaman.
    const footerAtas = [INSTANSI, meta.sumber].filter(Boolean).join(" · ");
    const footerBawah = `dibuat ${generatedAt} · halaman ${pageNum}/${totalPages}`;
    stream.push("BT", "/F2 8 Tf", "50 44 Td", `(${teksPdf(footerAtas)}) Tj`, "0 -10 Td", `(${teksPdf(footerBawah)}) Tj`, "ET");
    return stream.join("\n");
  });

  const catalogIdx = 1;
  const pagesIdx = 2;
  const fontBoldIdx = 3;
  const fontRegIdx = 4;
  let nextObj = 5;
  const pageObjIndices = [];
  const contentIndices = [];
  for (let i = 0; i < pageStreams.length; i++) {
    pageObjIndices.push(nextObj++);
    contentIndices.push(nextObj++);
  }

  const objects = [];
  objects[catalogIdx - 1] = `<< /Type /Catalog /Pages ${pagesIdx} 0 R >>`;
  objects[pagesIdx - 1] = `<< /Type /Pages /Kids [${pageObjIndices.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageStreams.length} >>`;
  objects[fontBoldIdx - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objects[fontRegIdx - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  for (let i = 0; i < pageStreams.length; i++) {
    objects[pageObjIndices[i] - 1] = `<< /Type /Page /Parent ${pagesIdx} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontBoldIdx} 0 R /F2 ${fontRegIdx} 0 R >> >> /Contents ${contentIndices[i]} 0 R >>`;
    objects[contentIndices[i] - 1] = `<< /Length ${Buffer.byteLength(pageStreams[i], "latin1")} >>\nstream\n${pageStreams[i]}\nendstream`;
  }

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalogIdx} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

module.exports = { INSTANSI, publicUrl, renderDokumen, teksPdf };

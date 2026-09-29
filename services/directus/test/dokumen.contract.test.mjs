// Kandidat 05: kontrak module Dokumen (`analytics-shared/dokumen.cjs`), satu-satunya serializer PDF.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { INSTANSI, publicUrl, renderDokumen, teksPdf } = require("../analytics-shared/dokumen.cjs");

const punyaPdftotext = spawnSync("pdftotext", ["-v"]).error === undefined;

function ekstrak(pdf) {
  const dir = mkdtempSync(join(tmpdir(), "dokumen-"));
  try {
    const berkas = join(dir, "x.pdf");
    writeFileSync(berkas, pdf);
    return execFileSync("pdftotext", ["-layout", berkas, "-"], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function periksaPanjangStream(latin) {
  const headers = [...latin.matchAll(/\/Length (\d+) >>\nstream\n/g)];
  assert.ok(headers.length >= 1, "tidak ada stream di PDF");
  for (const header of headers) {
    const start = header.index + header[0].length;
    const end = latin.indexOf("\nendstream", start);
    assert.equal(Number(header[1]), Buffer.byteLength(latin.slice(start, end), "latin1"));
  }
}

test("teksPdf mentransliterasi tanda baca tipografis dan meng-escape kurung", () => {
  assert.equal(teksPdf("Kulit — 28 × 20 cm"), "Kulit - 28 x 20 cm");
  assert.equal(
    teksPdf("Target ≥ 50% & ≤ 100% • “Kualitas” (A)"),
    'Target >= 50% & <= 100% - "Kualitas" \\(A\\)',
  );
});

test("renderDokumen: byte latin1, /Length dan xref akurat (B26)", () => {
  const pdf = renderDokumen({
    judul: "Café Sunda",
    bagian: [{ judul: "Ringkasan", baris: ["Kopi Café · teh manis"] }],
  });
  assert.ok(Buffer.isBuffer(pdf));
  const latin = pdf.toString("latin1");
  assert.match(latin, /Caf\xe9 Sunda/);
  assert.doesNotMatch(latin, /Caf\xc3\xa9/, "UTF-8 dua byte menghasilkan mojibake di stream WinAnsi");
  periksaPanjangStream(latin);
  const xref = Number(/startxref\n(\d+)/.exec(latin)[1]);
  assert.equal(latin.slice(xref, xref + 4), "xref");
});

test("pdftotext membaca 'Café' dan '·' persis (B26)", { skip: !punyaPdftotext && "pdftotext tidak terpasang" }, () => {
  const teks = ekstrak(
    renderDokumen({ judul: "Café Sunda", bagian: [{ judul: "Ringkasan", baris: ["Kopi Café · teh manis"] }] }),
  );
  assert.match(teks, /Café Sunda/);
  assert.match(teks, /Kopi Café · teh manis/);
  assert.match(teks, new RegExp(INSTANSI));
  assert.match(teks, /dibuat \d{4}-\d{2}-\d{2} · halaman 1\/1/);
  assert.doesNotMatch(teks, /Ã|Â/);
});

test("baris 300 karakter dibungkus dan semua kata ada di teks hasil ekstraksi (B26)", { skip: !punyaPdftotext && "pdftotext tidak terpasang" }, () => {
  const kata = Array.from({ length: 40 }, (_, index) => `kata${index}`);
  const pdf = renderDokumen({ judul: "Bungkus", bagian: [{ baris: [kata.join(" ")] }] });
  const teks = ekstrak(pdf);
  for (const satu of kata) assert.ok(teks.includes(satu), `kata hilang: ${satu}`);
  const panjang = pdf
    .toString("latin1")
    .matchAll(/\(([^()\\]*)\) Tj/g);
  assert.deepEqual([...panjang].map((m) => m[1]).filter((s) => s.length > 95), []);
});

test("120 baris menjadi 3 halaman dengan footer benar (B26)", { skip: !punyaPdftotext && "pdftotext tidak terpasang" }, () => {
  const baris = Array.from({ length: 120 }, (_, index) => `Baris ${index + 1}`);
  const pdf = renderDokumen({ judul: "Panjang", bagian: [{ baris }] });
  assert.match(pdf.toString("latin1"), /\/Count 3\b/);
  const teks = ekstrak(pdf);
  assert.match(teks, /halaman 1\/3/);
  assert.match(teks, /halaman 3\/3/);
  for (const satu of ["Baris 1", "Baris 60", "Baris 120"]) assert.ok(teks.includes(satu), `hilang: ${satu}`);
});

test("QR dikirim sebagai matriks dan digambar sebagai operator vektor di halaman 1", () => {
  const modul = [
    [true, false, true],
    [false, true, false],
    [true, false, true],
  ];
  const latin = renderDokumen({ judul: "QR", bagian: [], qr: { modul, ukuran: 90 } }).toString("latin1");
  assert.equal((latin.match(/ re(?=\n)/g) ?? []).length, 5, "satu operator `re` per modul gelap");
  assert.match(latin, /q\n0 g\n/);
  const tanpa = renderDokumen({ judul: "QR", bagian: [], qr: null }).toString("latin1");
  assert.doesNotMatch(tanpa, / re(?=\n)/);
});

test("publicUrl mendahulukan env yang diinjeksi, lalu process.env, lalu default lokal", () => {
  const simpan = { web: process.env.PUBLIC_WEB_URL, url: process.env.PUBLIC_URL };
  try {
    delete process.env.PUBLIC_WEB_URL;
    delete process.env.PUBLIC_URL;
    assert.equal(publicUrl(undefined), "http://127.0.0.1:3000");
    assert.equal(publicUrl({ PUBLIC_URL: "https://a.test/" }), "https://a.test");
    process.env.PUBLIC_WEB_URL = "https://proses.test";
    assert.equal(publicUrl({}), "https://proses.test");
    assert.equal(publicUrl({ PUBLIC_WEB_URL: "https://env.test/" }), "https://env.test");
  } finally {
    for (const [kunci, nilai] of [["PUBLIC_WEB_URL", simpan.web], ["PUBLIC_URL", simpan.url]]) {
      if (nilai === undefined) delete process.env[kunci];
      else process.env[kunci] = nilai;
    }
  }
});

test("INSTANSI satu konstanta resmi", () => {
  assert.equal(INSTANSI, "Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat");
});

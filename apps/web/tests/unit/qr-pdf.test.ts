import { describe, expect, it } from "vitest";
import { PAGE_HEIGHT, PAGE_WIDTH, jpegPdf } from "../../app/lib/qr-pdf";

// Any bytes work: the wrapper only counts lengths and offsets, it never parses the JPEG.
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const META = { kode: "TP7K2M9QX4RB", url: "https://contoh.id/passport/TP7K2M9QX4RB", nama: "Keripik Siti (Jabar)" };

const latin1 = (pdf: Uint8Array) => Buffer.from(pdf).toString("latin1");

describe("jpegPdf", () => {
  it("builds a structurally valid one-page PDF with the JPEG embedded", () => {
    const pdf = latin1(jpegPdf(JPEG, 512, 512, META));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain(`/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`);
    expect(pdf).toContain("/Filter /DCTDecode");
    expect(pdf).toContain("/Width 512");
    // The raw JPEG bytes sit inside the image stream, between "stream\n" and "endstream".
    const start = pdf.indexOf("stream\n", pdf.indexOf("/DCTDecode")) + "stream\n".length;
    expect(Buffer.from(pdf.slice(start, start + JPEG.length), "latin1").equals(Buffer.from(JPEG))).toBe(true);
    expect(pdf).toContain("(TP7K2M9QX4RB)");
    expect(pdf).toContain("(https://contoh.id/passport/TP7K2M9QX4RB)");
  });

  it("keeps every content-stream line to valid operators (B28)", () => {
    const pdf = latin1(jpegPdf(JPEG, 512, 512, META));
    const imageStream = pdf.indexOf("stream\n", pdf.indexOf("/DCTDecode"));
    const imageEnd = pdf.indexOf("endstream", imageStream);
    const contentStart = pdf.indexOf("stream\n", imageEnd + "endstream".length) + "stream\n".length;
    const content = pdf.slice(contentStart, pdf.indexOf("\nendstream", contentStart));
    const allowed = /^(BT \/F[12] \d+ Tf -?\d+ -?\d+ Td \(.*\) Tj ET|q [\d. ]+cm \/Im0 Do Q)$/;
    const lines = content.split("\n").filter(Boolean);
    for (const line of lines) {
      expect(line, `baris di luar operator PDF: ${line}`).toMatch(allowed);
    }
    expect(content).toContain("(Scan QR ini");
  });

  it("declares WinAnsiEncoding so the middle dot and accented names read back (B26/B28)", () => {
    const pdf = latin1(jpegPdf(JPEG, 512, 512, { ...META, nama: "Café Keripik" }));
    // Base-14 fonts default to StandardEncoding, where 0xB7 reads as a bullet and 0xE9 as "Ø".
    expect(pdf.match(/\/Encoding \/WinAnsiEncoding/g)).toHaveLength(2);
    expect(pdf).toContain("(Café Keripik)");
  });

  it("escapes parentheses in text and keeps the xref offsets pointing at every object", () => {
    const pdf = latin1(jpegPdf(JPEG, 512, 512, META));
    expect(pdf).toContain("\\(Jabar\\)");
    const xrefAt = Number(pdf.slice(pdf.lastIndexOf("startxref") + 10).trim().split("\n")[0]);
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const entries = [...pdf.slice(xrefAt).matchAll(/^(\d{10}) 00000 n /gm)].map((match) => Number(match[1]));
    expect(entries.length).toBe(7);
    for (const [index, offset] of entries.entries()) {
      expect(pdf.slice(offset, offset + 7)).toBe(`${index + 1} 0 obj`);
    }
  });
});

describe("nama instansi B38", () => {
  it("baris penerbit memakai satu nama kanonik Dinas", () => {
    const pdf = latin1(jpegPdf(JPEG, 512, 512, META));
    expect(pdf).toContain("(Diterbitkan oleh Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat)");
  });
});

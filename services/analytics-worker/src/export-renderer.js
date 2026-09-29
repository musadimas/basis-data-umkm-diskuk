import { deflateSync } from "node:zlib";
import PptxGenJS from "pptxgenjs";
import dokumen from "../../directus/analytics-shared/dokumen.cjs";

const { renderDokumen } = dokumen;

/** Satu nama instansi untuk seluruh dokumen agregat (B38). */
export const INSTANSI = "Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const body = Buffer.from(data);
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  name.copy(out, 4);
  body.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, body])), 8 + body.length);
  return out;
}

// 5x7 Basic ASCII font table (ASCII 32 to 126)
const FONT_5X7 = {
  32: [0, 0, 0, 0, 0],
  33: [0, 0, 0x5f, 0, 0],
  34: [0, 7, 0, 7, 0],
  35: [0x14, 0x7f, 0x14, 0x7f, 0x14],
  36: [0x24, 0x2a, 0x7f, 0x2a, 0x12],
  37: [0x23, 0x13, 0x08, 0x64, 0x62],
  38: [0x36, 0x49, 0x55, 0x22, 0x50],
  39: [0, 5, 3, 0, 0],
  40: [0, 0x1c, 0x22, 0x41, 0],
  41: [0, 0x41, 0x22, 0x1c, 0],
  42: [0x14, 0x08, 0x3e, 0x08, 0x14],
  43: [0x08, 0x08, 0x3e, 0x08, 0x08],
  44: [0, 0x50, 0x30, 0, 0],
  45: [0x08, 0x08, 0x08, 0x08, 0x08],
  46: [0, 0x60, 0x60, 0, 0],
  47: [0x20, 0x10, 0x08, 0x04, 0x02],
  48: [0x3e, 0x51, 0x49, 0x45, 0x3e],
  49: [0, 0x42, 0x7f, 0x40, 0],
  50: [0x42, 0x61, 0x51, 0x49, 0x46],
  51: [0x21, 0x41, 0x45, 0x4b, 0x31],
  52: [0x18, 0x14, 0x12, 0x7f, 0x10],
  53: [0x27, 0x45, 0x45, 0x45, 0x39],
  54: [0x3c, 0x4a, 0x49, 0x49, 0x30],
  55: [0x01, 0x71, 0x09, 0x05, 0x03],
  56: [0x36, 0x49, 0x49, 0x49, 0x36],
  57: [0x06, 0x49, 0x49, 0x29, 0x1e],
  58: [0, 0x36, 0x36, 0, 0],
  59: [0, 0x56, 0x36, 0, 0],
  60: [0x08, 0x14, 0x22, 0x41, 0],
  61: [0x14, 0x14, 0x14, 0x14, 0x14],
  62: [0, 0x41, 0x22, 0x14, 0x08],
  63: [0x02, 0x01, 0x51, 0x09, 0x06],
  64: [0x32, 0x49, 0x79, 0x41, 0x3e],
  65: [0x7e, 0x11, 0x11, 0x11, 0x7e],
  66: [0x7f, 0x49, 0x49, 0x49, 0x36],
  67: [0x3e, 0x41, 0x41, 0x41, 0x22],
  68: [0x7f, 0x41, 0x41, 0x22, 0x1c],
  69: [0x7f, 0x49, 0x49, 0x49, 0x41],
  70: [0x7f, 0x09, 0x09, 0x09, 0x01],
  71: [0x3e, 0x41, 0x49, 0x49, 0x7a],
  72: [0x7f, 0x08, 0x08, 0x08, 0x7f],
  73: [0, 0x41, 0x7f, 0x41, 0],
  74: [0x20, 0x40, 0x41, 0x3f, 0x01],
  75: [0x7f, 0x08, 0x14, 0x22, 0x41],
  76: [0x7f, 0x40, 0x40, 0x40, 0x40],
  77: [0x7f, 0x02, 0x0c, 0x02, 0x7f],
  78: [0x7f, 0x04, 0x08, 0x10, 0x7f],
  79: [0x3e, 0x41, 0x41, 0x41, 0x3e],
  80: [0x7f, 0x09, 0x09, 0x09, 0x06],
  81: [0x3e, 0x41, 0x51, 0x21, 0x5e],
  82: [0x7f, 0x09, 0x19, 0x29, 0x46],
  83: [0x46, 0x49, 0x49, 0x49, 0x31],
  84: [0x01, 0x01, 0x7f, 0x01, 0x01],
  85: [0x3f, 0x40, 0x40, 0x40, 0x3f],
  86: [0x1f, 0x20, 0x40, 0x20, 0x1f],
  87: [0x7f, 0x20, 0x18, 0x20, 0x7f],
  88: [0x63, 0x14, 0x08, 0x14, 0x63],
  89: [0x07, 0x08, 0x70, 0x08, 0x07],
  90: [0x61, 0x51, 0x49, 0x45, 0x43],
  91: [0, 0x7f, 0x41, 0x41, 0],
  92: [0x02, 0x04, 0x08, 0x10, 0x20],
  93: [0, 0x41, 0x41, 0x7f, 0],
  94: [0x04, 0x02, 0x01, 0x02, 0x04],
  95: [0x40, 0x40, 0x40, 0x40, 0x40],
  96: [0, 1, 2, 4, 0],
};

// Fill in lowercase a-z (derive from uppercase for crisp small display)
for (let c = 97; c <= 122; c++) {
  FONT_5X7[c] = FONT_5X7[c - 32];
}

function setPixel(raw, width, height, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const idx = y * (1 + width * 4) + 1 + x * 4;
  raw[idx] = r;
  raw[idx + 1] = g;
  raw[idx + 2] = b;
  raw[idx + 3] = a;
}

function fillRect(raw, width, height, startX, startY, rectW, rectH, r, g, b, a = 255) {
  const x1 = Math.max(0, startX);
  const y1 = Math.max(0, startY);
  const x2 = Math.min(width, startX + rectW);
  const y2 = Math.min(height, startY + rectH);
  for (let y = y1; y < y2; y++) {
    for (let x = x1; x < x2; x++) {
      setPixel(raw, width, height, x, y, r, g, b, a);
    }
  }
}

function drawChar(raw, width, height, ch, startX, startY, scale, r, g, b) {
  const code = ch.charCodeAt(0);
  const cols = FONT_5X7[code] || FONT_5X7[63]; // fallback '?'
  for (let col = 0; col < 5; col++) {
    const bits = cols[col];
    for (let row = 0; row < 7; row++) {
      if ((bits >> row) & 1) {
        fillRect(raw, width, height, startX + col * scale, startY + row * scale, scale, scale, r, g, b);
      }
    }
  }
}

function drawText(raw, width, height, text, startX, startY, scale, r, g, b) {
  const str = String(text ?? "");
  let currX = startX;
  const spacing = 6 * scale;
  for (let i = 0; i < str.length; i++) {
    drawChar(raw, width, height, str[i], currX, startY, scale, r, g, b);
    currX += spacing;
    if (currX >= width - 10) break;
  }
}

/**
 * Renders presentation-resolution PNG (default 900x560, RGBA).
 * Fixes the previous 1x1 stub to comply with M2-01.
 */
export function renderPng({ title = "Analitik UMKM", groups = [], meta = {} } = {}) {
  const width = 900;
  const height = 560;
  const stride = 1 + width * 4;
  const raw = Buffer.alloc(height * stride);

  // Initialize filter bytes
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // Filter 0 (None)
  }

  // Background #FFFFFF
  fillRect(raw, width, height, 0, 0, width, height, 255, 255, 255);

  // Top header banner #0F3D91
  fillRect(raw, width, height, 0, 0, width, 60, 15, 61, 145);

  // Title in header (white, 2x scale)
  drawText(raw, width, height, String(title).slice(0, 36), 30, 16, 2, 255, 255, 255);

  // Organization subtitle in header
  drawText(raw, width, height, INSTANSI.toUpperCase(), 30, 42, 1, 220, 230, 250);

  if (meta.filterSummary)
    drawText(raw, width, height, String(meta.filterSummary).replaceAll("|", "-").toUpperCase().slice(0, 140), 30, 70, 1, 71, 85, 105);

  // Chart area
  const items = groups.slice(0, 12);
  const maxVal = Math.max(1, ...items.map((g) => Number(g.value) || 0));

  if (items.length > 0) {
    const startY = 96;
    const rowH = 34;
    const barMaxW = 420;
    const barStartX = 260;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const y = startY + i * rowH;
      const val = Number(item.value) || 0;
      const share = item.share != null ? `${item.share}%` : "";
      const barW = Math.max(4, Math.round((val / maxVal) * barMaxW));

      // Label (left)
      const lbl = String(item.label || "").slice(0, 22);
      drawText(raw, width, height, lbl, 30, y + 6, 1, 30, 41, 59);

      // Bar background
      fillRect(raw, width, height, barStartX, y + 4, barMaxW, 16, 241, 245, 249);

      // Filled bar (brand blue #2563EB)
      fillRect(raw, width, height, barStartX, y + 4, barW, 16, 37, 99, 235);

      // Value & share (right)
      const valText = `${val.toLocaleString("id-ID")} (${share})`;
      drawText(raw, width, height, valText, barStartX + barMaxW + 15, y + 6, 1, 71, 85, 105);
    }
  } else {
    // Empty state / general preview card
    drawText(raw, width, height, "Ringkasan Eksekutif Analitik", 40, 100, 2, 30, 41, 59);
    drawText(raw, width, height, "Visualisasi agregat siap presentasi.", 40, 130, 1, 100, 116, 139);
    fillRect(raw, width, height, 40, 160, 400, 18, 37, 99, 235);
    fillRect(raw, width, height, 40, 190, 320, 18, 59, 130, 246);
    fillRect(raw, width, height, 40, 220, 240, 18, 96, 165, 250);
  }

  // Footer banner #F8FAFC with border
  fillRect(raw, width, height, 0, height - 35, width, 35, 248, 250, 252);
  fillRect(raw, width, height, 0, height - 35, width, 1, 226, 232, 240);

  const asOfText = `Data per: ${meta.dataAsOf || "Terkini"} - Dibuat: ${meta.generatedAt || new Date().toISOString().slice(0, 10)}`;
  drawText(raw, width, height, asOfText, 30, height - 22, 1, 100, 116, 139);

  // Construct PNG
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Deflate
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Non-interlaced

  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** PDF agregat: satu bagian tabel lewat module Dokumen (paginasi, wrap, latin1) tanpa batas baris. */
export function renderPdf({ title = "Analitik UMKM", lines = [], meta = {} } = {}) {
  return renderDokumen({
    judul: title,
    bagian: [{ baris: Array.isArray(lines) ? lines : [] }],
    meta: {
      generatedAt: meta.generatedAt || undefined,
      sumber: `Data per ${meta.dataAsOf || "Belum tersedia"} · masking v${meta.maskingVersion || 1}`,
    },
  });
}

export function pptxChartType(visual) {
  return visual === "donut" ? "doughnut" : "bar";
}

/**
 * Renders 3-slide PPTX deck:
 * Slide 1: Cover title + metadata
 * Slide 2: Native chart (bar or doughnut)
 * Slide 3: Aggregation table with cumulative %
 */
export async function renderAggregatePptx({
  judul = "Analitik UMKM",
  dataAsOf = "Belum tersedia",
  filterSummary = "",
  visual = "bar",
  groups = [],
} = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = judul;

  // Slide 1: Cover
  const slide1 = pptx.addSlide();
  slide1.background = { color: "0F3D91" };
  slide1.addText(judul, {
    x: 0.8,
    y: 2.0,
    w: 11.5,
    h: 1.4,
    fontSize: 32,
    bold: true,
    color: "FFFFFF",
  });
  slide1.addText(`Data per ${dataAsOf}`, {
    x: 0.8,
    y: 3.6,
    w: 11.5,
    h: 0.6,
    fontSize: 16,
    color: "DCE6FA",
  });
  if (filterSummary)
    slide1.addText(String(filterSummary), {
      x: 0.8,
      y: 4.3,
      w: 11.5,
      h: 0.8,
      fontSize: 14,
      color: "DCE6FA",
    });
  slide1.addText(INSTANSI, {
    x: 0.8,
    y: 6.2,
    w: 11.5,
    h: 0.5,
    fontSize: 14,
    color: "DCE6FA",
  });

  // Slide 2: Native Chart
  const slide2 = pptx.addSlide();
  slide2.addText(judul, {
    x: 0.8,
    y: 0.4,
    w: 11.5,
    h: 0.6,
    fontSize: 22,
    bold: true,
    color: "0F3D91",
  });
  const topGroups = groups.slice(0, 20);
  if (topGroups.length > 0) {
    const cType = pptx.ChartType[pptxChartType(visual)] || pptx.ChartType.bar;
    const chartData = [
      {
        name: judul,
        labels: topGroups.map((g) => String(g.label ?? "")),
        values: topGroups.map((g) => Number(g.value ?? 0)),
      },
    ];
    slide2.addChart(cType, chartData, {
      x: 0.8,
      y: 1.2,
      w: 11.5,
      h: 5.4,
      showLegend: visual === "donut",
    });
  } else {
    slide2.addText("Tidak ada data untuk grafik.", {
      x: 0.8,
      y: 3.0,
      w: 11.5,
      h: 1.0,
      fontSize: 16,
      color: "666666",
    });
  }

  // Slide 3: Aggregation Table
  const slide3 = pptx.addSlide();
  slide3.addText(`Tabel Agregasi · ${judul}`, {
    x: 0.8,
    y: 0.4,
    w: 11.5,
    h: 0.6,
    fontSize: 22,
    bold: true,
    color: "0F3D91",
  });

  const tableRows = groups.slice(0, 15);
  let kumulatif = 0;
  const rows = [
    [
      { text: "Kelompok", options: { bold: true, fill: { color: "0F3D91" }, color: "FFFFFF" } },
      { text: "Jumlah", options: { bold: true, fill: { color: "0F3D91" }, color: "FFFFFF", align: "right" } },
      { text: "Share (%)", options: { bold: true, fill: { color: "0F3D91" }, color: "FFFFFF", align: "right" } },
      { text: "Kumulatif (%)", options: { bold: true, fill: { color: "0F3D91" }, color: "FFFFFF", align: "right" } },
    ],
  ];

  for (let i = 0; i < tableRows.length; i++) {
    const g = tableRows[i];
    const share = Number(g.share || 0);
    kumulatif += share;
    const bg = i % 2 === 0 ? "F8FAFC" : "FFFFFF";
    rows.push([
      { text: String(g.label ?? ""), options: { fill: { color: bg } } },
      { text: Number(g.value ?? 0).toLocaleString("id-ID"), options: { fill: { color: bg }, align: "right" } },
      { text: `${share.toFixed(1)}%`, options: { fill: { color: bg }, align: "right" } },
      { text: `${Math.min(kumulatif, 100).toFixed(1)}%`, options: { fill: { color: bg }, align: "right" } },
    ]);
  }

  slide3.addTable(rows, {
    x: 0.8,
    y: 1.2,
    w: 11.5,
    colW: [4.5, 2.5, 2.2, 2.3],
    fontSize: 11,
    border: { type: "solid", pt: 0.5, color: "CBD5E1" },
  });

  if (groups.length > 15) {
    slide3.addText(`Menampilkan 15 dari ${groups.length} kelompok teratas`, {
      x: 0.8,
      y: 6.6,
      w: 11.5,
      h: 0.4,
      fontSize: 10,
      italic: true,
      color: "666666",
    });
  }

  return await pptx.write({ outputType: "nodebuffer" });
}

export function renderAggregate({ title, groups, meta, visual: _visual = "bar" }) {
  const lines = [...(meta?.filterSummary ? [String(meta.filterSummary)] : []), ...(groups || []).map((group) =>
      typeof group.value === "number" ? `${group.label}: ${group.value} (${group.share || 0}%)` : `${group.label}: ${group.value}`, // profil: nilai teks tanpa persen
    )];
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" role="img"><title>${String(title || "Analitik UMKM").replace(/[<&>]/g, "")}</title><desc>${lines.join("; ").replace(/[<&>]/g, "")}</desc><rect width="100%" height="100%" fill="white"/><text x="30" y="40">${String(title || "Analitik UMKM").replace(/[<&>]/g, "")}</text>${(groups || []).slice(0, 20).map((g, i) => `<text x="30" y="${70 + i * 22}">${String(g.label).replace(/[<&>]/g, "")} — ${g.value}</text>`).join("")}</svg>`,
    png: renderPng({ title, groups, meta }),
    pdf: renderPdf({ title, lines, meta }),
  };
}

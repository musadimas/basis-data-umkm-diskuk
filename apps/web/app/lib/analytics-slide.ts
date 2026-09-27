/**
 * "Export Slide PPT" for Canvas Analitik (Brief Fitur Modul 2). Built in the browser from what the
 * canvas already shows: the rendered chart (rasterised SVG) and the aggregated groups. Only
 * aggregates leave the page, the same data the PNG/PDF aggregate exports contain.
 */
import type { AnalyticsFilter, AnalyticsGroup, AnalyticsMetric } from "~/types/analytics";

export interface SlideInput {
  metric: AnalyticsMetric;
  dimensionLabel: string;
  groups: AnalyticsGroup[];
  total: number;
  filters: AnalyticsFilter[];
  fieldLabel: (fieldId: string) => string;
  dataAsOf: string | null;
  chartPng: string | null;
}

const MAX_TABLE_ROWS = 15;
const OPERATOR: Record<AnalyticsFilter["operator"], string> = {
  eq: "=",
  neq: "≠",
  in: "∈",
  contains: "memuat",
  starts_with: "diawali",
};

export function formatMetric(value: number, metric: AnalyticsMetric) {
  return metric.unit === "IDR"
    ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value)
    : new Intl.NumberFormat("id-ID").format(value);
}

export function describeFilters(filters: AnalyticsFilter[], fieldLabel: (fieldId: string) => string): string {
  if (!filters.length) return "Tanpa filter (seluruh Jawa Barat)";
  return filters
    .map((filter) => `${fieldLabel(filter.fieldId)} ${OPERATOR[filter.operator]} ${Array.isArray(filter.value) ? filter.value.join(", ") : filter.value}`)
    .join(" · ");
}

/** Header plus the largest groups; the rest are summed into one "Lainnya" row so totals still add up. */
export function slideTableRows(input: Pick<SlideInput, "groups" | "metric" | "dimensionLabel">): string[][] {
  const sorted = [...input.groups].sort((a, b) => b.value - a.value);
  const shown = sorted.slice(0, MAX_TABLE_ROWS);
  const rest = sorted.slice(MAX_TABLE_ROWS);
  const percent = (share: number) => `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(share)}%`;
  const rows = shown.map((group) => [group.label, formatMetric(group.value, input.metric), percent(group.share)]);
  if (rest.length) {
    rows.push([
      `Lainnya (${rest.length} kelompok)`,
      formatMetric(rest.reduce((sum, group) => sum + group.value, 0), input.metric),
      percent(rest.reduce((sum, group) => sum + group.share, 0)),
    ]);
  }
  return [[input.dimensionLabel, input.metric.label, "Porsi"], ...rows];
}

export function slideFileName(metric: AnalyticsMetric, dimensionLabel: string, now = new Date()) {
  const slug = `${metric.label}-per-${dimensionLabel}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `analitik-${slug}-${now.toISOString().slice(0, 10)}.pptx`;
}

const STYLE_PROPS = [
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "opacity",
  "font-family", "font-size", "font-weight", "text-anchor", "dominant-baseline", "visibility", "display",
];

/**
 * Rasterises a rendered chart. Unovis colours come from CSS variables, so every element's computed
 * presentation styles are copied inline before serialising.
 */
export async function svgToPng(svg: SVGSVGElement, scale = 2): Promise<string | null> {
  const box = svg.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const source = [svg, ...svg.querySelectorAll("*")];
  const target = [clone, ...clone.querySelectorAll("*")];
  source.forEach((element, index) => {
    const computed = getComputedStyle(element);
    const style = STYLE_PROPS.map((prop) => `${prop}:${computed.getPropertyValue(prop)}`).join(";");
    target[index]?.setAttribute("style", style);
  });
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(box.width));
  clone.setAttribute("height", String(box.height));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("chart image failed to load"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(box.width * scale);
    canvas.height = Math.round(box.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Builds the three-slide deck and triggers the download. */
export async function downloadSlideDeck(input: SlideInput) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = `${input.metric.label} per ${input.dimensionLabel}`;
  const title = `${input.metric.label} per ${input.dimensionLabel}`;
  const asOf = input.dataAsOf
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(input.dataAsOf))
    : "tanggal data belum tersedia";
  const footer = `Sumber: Dashboard UMKM DISKUK Jawa Barat · data per ${asOf}`;

  const cover = pptx.addSlide();
  cover.background = { color: "0F3D91" };
  cover.addText(title, { x: 0.6, y: 2.2, w: 12, h: 1.2, fontSize: 36, bold: true, color: "FFFFFF" });
  cover.addText(describeFilters(input.filters, input.fieldLabel), { x: 0.6, y: 3.5, w: 12, h: 0.8, fontSize: 16, color: "DCE6FA" });
  cover.addText(`Total: ${formatMetric(input.total, input.metric)}`, { x: 0.6, y: 4.3, w: 12, h: 0.6, fontSize: 20, bold: true, color: "FFD54F" });
  cover.addText(footer, { x: 0.6, y: 6.6, w: 12, h: 0.4, fontSize: 11, color: "DCE6FA" });

  const chart = pptx.addSlide();
  chart.addText(title, { x: 0.5, y: 0.3, w: 12.3, h: 0.6, fontSize: 22, bold: true, color: "0F3D91" });
  if (input.chartPng) {
    chart.addImage({ data: input.chartPng, x: 0.5, y: 1.1, w: 12.3, h: 5.3, sizing: { type: "contain", w: 12.3, h: 5.3 } });
  } else {
    chart.addText("Grafik tidak dapat dirender untuk tampilan ini; lihat tabel pada slide berikutnya.", { x: 0.5, y: 3, w: 12.3, h: 0.8, fontSize: 16, color: "666666" });
  }
  chart.addText(footer, { x: 0.5, y: 6.8, w: 12.3, h: 0.4, fontSize: 10, color: "666666" });

  const table = pptx.addSlide();
  table.addText(`Tabel agregasi · ${title}`, { x: 0.5, y: 0.3, w: 12.3, h: 0.6, fontSize: 22, bold: true, color: "0F3D91" });
  const rows = slideTableRows(input).map((row, index) =>
    row.map((text, column) => ({
      text,
      options: {
        bold: index === 0,
        fill: { color: index === 0 ? "0F3D91" : index % 2 ? "FFFFFF" : "F1F5F9" },
        color: index === 0 ? "FFFFFF" : "1F2937",
        align: (column === 0 ? "left" : "right") as "left" | "right",
      },
    })),
  );
  table.addTable(rows, { x: 0.5, y: 1.1, w: 12.3, colW: [6.3, 4, 2], fontSize: 12, border: { type: "solid", pt: 0.5, color: "CBD5E1" }, autoPage: false });
  table.addText(footer, { x: 0.5, y: 6.8, w: 12.3, h: 0.4, fontSize: 10, color: "666666" });

  await pptx.writeFile({ fileName: slideFileName(input.metric, input.dimensionLabel) });
}

import { describe, expect, it } from "vitest";
import { describeFilters, slideFileName, slideTableRows } from "../../app/lib/analytics-slide";

const metric = { key: "jumlah", label: "Jumlah UMKM", aggregation: "count", unit: "usaha" as const };

describe("slide table", () => {
  it("lists the largest groups and folds the rest into one row", () => {
    const groups = Array.from({ length: 18 }, (_, index) => ({ key: String(index), label: `Kota ${index}`, value: 100 - index, share: 5 }));
    const rows = slideTableRows({ groups, metric, dimensionLabel: "Kabupaten/kota" });
    expect(rows[0]).toEqual(["Kabupaten/kota", "Jumlah UMKM", "Porsi"]);
    expect(rows).toHaveLength(1 + 15 + 1);
    expect(rows[1]).toEqual(["Kota 0", "100", "5%"]);
    expect(rows.at(-1)).toEqual(["Lainnya (3 kelompok)", "252", "15%"]);
  });

  it("formats rupiah metrics", () => {
    const rows = slideTableRows({ groups: [{ key: "a", label: "A", value: 1500000, share: 100 }], metric: { ...metric, unit: "IDR" }, dimensionLabel: "Skala" });
    expect(rows[1]![1]).toMatch(/^Rp\s?1\.500\.000$/);
  });
});

describe("slide text", () => {
  it("describes the active filters with field labels", () => {
    const label = (id: string) => ({ kota: "Kabupaten/kota", skala: "Skala" })[id] ?? id;
    expect(describeFilters([], label)).toBe("Tanpa filter (seluruh Jawa Barat)");
    expect(describeFilters([{ fieldId: "kota", operator: "in", value: ["Bandung", "Bogor"] }, { fieldId: "skala", operator: "eq", value: "mikro" }], label)).toBe(
      "Kabupaten/kota ∈ Bandung, Bogor · Skala = mikro",
    );
  });

  it("names the file after the metric, dimension and date", () => {
    expect(slideFileName(metric, "Kabupaten/kota", new Date("2026-09-26T10:00:00Z"))).toBe("analitik-jumlah-umkm-per-kabupaten-kota-2026-09-26.pptx");
  });
});

import { describe, expect, it } from "vitest";
import {
  canonicalAggregateKey,
  canonicalRecordsKey,
  canonicalizeAnalysisUrl,
  defaultAnalysis,
  parseAnalysisUrl,
  serializeAnalysisUrl,
} from "~/lib/analytics-query";
describe("analytics query URL contract", () => {
  it("round trips only safe semantic state", () => {
    const config = {
      ...defaultAnalysis,
      filters: [
        {
          fieldId: "skala_dilaporkan",
          operator: "eq" as const,
          value: "mikro",
        },
      ],
      visual: "table" as const,
    };
    const parsed = parseAnalysisUrl(serializeAnalysisUrl(config));
    expect(parsed.warning).toBe(false);
    expect(parsed.config).toMatchObject(config);
  });
  it("rejects unknown keys and canaries", () => {
    const result = parseAnalysisUrl(
      "metric=jumlah_umkm&groupBy=kota_nama&nik=1234567890123456&filter=kota_nama~eq~Jakarta",
    );
    expect(result.warning).toBe(true);
    expect(result.config.filters).toHaveLength(1);
    expect(canonicalizeAnalysisUrl(result.config)).not.toContain("nik");
  });
  it("falls back when identifiers or visual are invalid", () => {
    const result = parseAnalysisUrl(
      "metric=usaha%3BDROP&visual=line&record_uuid=abc",
    );
    expect(result.warning).toBe(true);
    expect(result.config.metric).toBe(defaultAnalysis.metric);
    expect(result.config.visual).toBe(defaultAnalysis.visual);
  });
  it("preserves multiple filters and safe pagination while excluding PII identifiers", () => {
    const config = {
      ...defaultAnalysis,
      sort: "nama" as const,
      page: 2,
      filters: [
        { fieldId: "kota_nama", operator: "eq" as const, value: "Kota Bogor" },
        {
          fieldId: "skala_dilaporkan",
          operator: "in" as const,
          value: ["micro", "small"],
        },
      ],
    };
    const parsed = parseAnalysisUrl(serializeAnalysisUrl(config));
    expect(parsed.warning).toBe(false);
    expect(parsed.config.filters).toEqual(config.filters);
    expect(parsed.config.page).toBe(2);
    expect(parseAnalysisUrl("groupBy=masked_nik").warning).toBe(true);
  });
  it("round trips in-filters whose joined value exceeds 100 characters", () => {
    const names = ["KAB. BOGOR", "KAB. SUKABUMI", "KAB. CIANJUR", "KAB. BANDUNG", "KAB. GARUT", "KAB. TASIKMALAYA", "KAB. CIAMIS", "KAB. KUNINGAN", "KAB. CIREBON"];
    const config = { ...defaultAnalysis, filters: [{ fieldId: "kota_nama", operator: "in" as const, value: names }] };
    const parsed = parseAnalysisUrl(serializeAnalysisUrl(config));
    expect(names.join(",").length).toBeGreaterThan(100);
    expect(parsed.warning).toBe(false);
    expect(parsed.config.filters).toEqual(config.filters);
  });
  it("keeps region names that contain PII keywords but still drops NIK and phone values", () => {
    const config = {
      ...defaultAnalysis,
      filters: [
        { fieldId: "kelurahan_nama", operator: "in" as const, value: ["MEKARMANIK", "SUKAMANAH"] },
        { fieldId: "sektor_kbli", operator: "eq" as const, value: "ELEKTRONIK" },
      ],
    };
    const parsed = parseAnalysisUrl(serializeAnalysisUrl(config));
    expect(parsed.warning).toBe(false);
    expect(parsed.config.filters).toEqual(config.filters);
    expect(parseAnalysisUrl("filter=kelurahan_nama~eq~3273010101011234").warning).toBe(true);
    expect(parseAnalysisUrl("filter=kelurahan_nama~in~MEKARMANIK%2C081234567890").warning).toBe(true);
  });
  it("rejects in-filters with more than 100 values", () => {
    const value = Array.from({ length: 101 }, (_, i) => `K${i}`).join(",");
    expect(parseAnalysisUrl(`filter=kota_nama~in~${encodeURIComponent(value)}`).warning).toBe(true);
  });
});

describe("canonical analytics cache keys", () => {
  const filter = (
    fieldId: string,
    operator: "eq" | "in",
    value: string | string[],
  ) => ({ fieldId, operator, value });
  it("ignores visual, pagination and sort so chart switches stay cached", () => {
    const base = canonicalAggregateKey(defaultAnalysis);
    expect(canonicalAggregateKey({ ...defaultAnalysis, visual: "donut" })).toBe(
      base,
    );
    expect(
      canonicalAggregateKey({ ...defaultAnalysis, page: 3, cursor: "abc" }),
    ).toBe(base);
    expect(canonicalAggregateKey({ ...defaultAnalysis, sort: "nama" })).toBe(
      base,
    );
  });
  it("treats filter order and in-value order as equivalent", () => {
    const left = canonicalAggregateKey({
      ...defaultAnalysis,
      filters: [
        filter("kota_nama", "eq", "Kota Bogor"),
        filter("skala_dilaporkan", "in", ["micro", "small"]),
      ],
    });
    const right = canonicalAggregateKey({
      ...defaultAnalysis,
      filters: [
        filter("skala_dilaporkan", "in", ["small", "micro"]),
        filter("kota_nama", "eq", "Kota Bogor"),
      ],
    });
    expect(left).toBe(right);
  });
  it("changes the key when server-relevant inputs change", () => {
    const base = canonicalAggregateKey(defaultAnalysis);
    expect(
      canonicalAggregateKey({ ...defaultAnalysis, groupBy: "kecamatan_nama" }),
    ).not.toBe(base);
    expect(
      canonicalAggregateKey({
        ...defaultAnalysis,
        breakdown: "skala_dilaporkan",
      }),
    ).not.toBe(base);
    expect(
      canonicalAggregateKey({
        ...defaultAnalysis,
        filters: [filter("kota_nama", "eq", "Kota Bogor")],
      }),
    ).not.toBe(base);
  });
  it("records key tracks filters and sort only", () => {
    const base = canonicalRecordsKey(defaultAnalysis);
    expect(
      canonicalRecordsKey({ ...defaultAnalysis, visual: "table", page: 2 }),
    ).toBe(base);
    expect(canonicalRecordsKey({ ...defaultAnalysis, sort: "nama" })).not.toBe(
      base,
    );
    expect(
      canonicalRecordsKey({
        ...defaultAnalysis,
        filters: [filter("skala_dilaporkan", "eq", "mikro")],
      }),
    ).not.toBe(base);
  });
});

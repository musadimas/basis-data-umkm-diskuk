import { describe, expect, it } from "vitest";
import {
  applyLockedKota,
  defaultTabularFilters,
  tabularFilterQuery,
} from "~/composables/useTabularFilters";

describe("kunci kabupaten/kota filter tabular (B39)", () => {
  it("locks both the draft and the applied filter for a kabkota", () => {
    const filters = defaultTabularFilters();
    const applied = defaultTabularFilters();
    expect(applyLockedKota(filters, applied, "7")).toBe(true);
    expect(filters.kabupatenKota).toBe("7");
    expect(applied.kabupatenKota).toBe("7");
    expect(tabularFilterQuery(applied).kota).toBe("7");
  });

  it("leaves a chosen wilayah untouched when there is no lock", () => {
    const filters = { ...defaultTabularFilters(), kabupatenKota: "12" };
    const applied = { ...defaultTabularFilters(), kabupatenKota: "12" };
    expect(applyLockedKota(filters, applied, null)).toBe(false);
    expect(filters.kabupatenKota).toBe("12");
    expect(applied.kabupatenKota).toBe("12");
  });
});

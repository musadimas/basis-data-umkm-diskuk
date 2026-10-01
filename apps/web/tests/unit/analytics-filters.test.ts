import { describe, expect, it } from "vitest";
import {
  BUILDER_HIDDEN_FIELDS,
  builderLabel,
  mergeFilter,
  MAX_IN_VALUES,
} from "~/lib/analytics-filters";

const eq = (fieldId: string, value: string) => ({
  fieldId,
  operator: "eq" as const,
  value,
});

describe("mergeFilter", () => {
  it("menggabungkan eq kedua pada field sama menjadi in, posisi chip tetap", () => {
    const filters = [eq("kota_nama", "KAB. BEKASI"), eq("skala_dilaporkan", "micro")];
    expect(mergeFilter(filters, eq("kota_nama", "KOTA BEKASI"))).toEqual([
      { fieldId: "kota_nama", operator: "in", value: ["KAB. BEKASI", "KOTA BEKASI"] },
      eq("skala_dilaporkan", "micro"),
    ]);
  });
  it("nilai sama tidak menggandakan dan tetap eq", () => {
    expect(mergeFilter([eq("kota_nama", "A")], eq("kota_nama", "A"))).toEqual([eq("kota_nama", "A")]);
  });
  it("menambah ke in yang sudah ada", () => {
    const start = [{ fieldId: "kota_nama", operator: "in" as const, value: ["A", "B"] }];
    expect(mergeFilter(start, eq("kota_nama", "C"))[0]).toEqual({ fieldId: "kota_nama", operator: "in", value: ["A", "B", "C"] });
  });
  it("neq dan operator teks mengganti", () => {
    const start = [eq("kota_nama", "A")];
    expect(mergeFilter(start, { fieldId: "kota_nama", operator: "neq", value: "B" })).toEqual([{ fieldId: "kota_nama", operator: "neq", value: "B" }]);
    expect(mergeFilter([{ fieldId: "kbli_kode", operator: "contains", value: "56" }], eq("kbli_kode", "56103"))).toEqual([eq("kbli_kode", "56103")]);
  });
  it("nilai berkoma mengganti, tidak digabung", () => {
    expect(mergeFilter([eq("kecamatan_nama", "A")], eq("kecamatan_nama", "B, C"))).toEqual([eq("kecamatan_nama", "B, C")]);
  });
  it("melebihi batas mengembalikan daftar yang sama", () => {
    const start = [{ fieldId: "kelurahan_nama", operator: "in" as const, value: Array.from({ length: MAX_IN_VALUES }, (_, i) => `K${i}`) }];
    expect(mergeFilter(start, eq("kelurahan_nama", "baru"))).toBe(start);
  });
  it("field baru ditambahkan di akhir", () => {
    expect(mergeFilter([eq("skala_dilaporkan", "micro")], eq("kota_nama", "A"))).toHaveLength(2);
  });
});

describe("field wilayah builder", () => {
  it("menyembunyikan id/kode dan memberi label tunggal", () => {
    expect([...BUILDER_HIDDEN_FIELDS].sort()).toEqual(["kecamatan_id", "kelurahan_id", "kota_id", "kota_kode"]);
    expect(builderLabel({ key: "kota_nama", label: "Nama kabupaten/kota" })).toBe("Kabupaten/kota");
    expect(builderLabel({ key: "skala_dilaporkan", label: "Skala" })).toBe("Skala");
  });
});

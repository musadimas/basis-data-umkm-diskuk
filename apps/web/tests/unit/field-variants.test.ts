import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const baca = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("ui/field tanpa impor melingkar (flake klinik-ui)", () => {
  it("Field.vue tidak mengimpor dari index barel", () => {
    const vue = baca("../../app/components/ui/field/Field.vue");
    expect(vue).not.toMatch(/from\s+["']\.["']/);
  });

  it("varian tinggal di berkas terpisah yang diimpor Field dan barel", () => {
    const vue = baca("../../app/components/ui/field/Field.vue");
    expect(vue).toMatch(/variants/);
    const barel = baca("../../app/components/ui/field/index.ts");
    expect(barel).toMatch(/variants/);
    const varian = baca("../../app/components/ui/field/variants.ts");
    expect(varian).toMatch(/fieldVariants/);
  });
});

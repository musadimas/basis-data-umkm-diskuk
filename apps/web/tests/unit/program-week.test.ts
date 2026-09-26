import { describe, expect, it } from "vitest";
import {
  tanggalJakarta,
  mingguKe,
  targetMingguan,
  isJumatJakarta,
  capaianPersen,
  layakRekomendasi,
} from "../../app/lib/program-week";

describe("kontrak minggu Y03 (identik backend)", () => {
  it("vektor minggu mulai 2026-09-28", () => {
    expect(mingguKe("2026-09-28", new Date("2026-09-27T16:59:59Z"))).toBe(0);
    expect(mingguKe("2026-09-28", new Date("2026-09-27T17:00:00Z"))).toBe(1);
    expect(mingguKe("2026-09-28", new Date("2026-10-04T16:59:59Z"))).toBe(1);
    expect(mingguKe("2026-09-28", new Date("2026-10-04T17:30:00Z"))).toBe(2);
    expect(tanggalJakarta(new Date("2026-09-27T17:00:00Z"))).toBe("2026-09-28");
  });

  it("target mingguan + Jumat WIB + capaian target nol", () => {
    expect(targetMingguan(780000000, 1.2, null)).toBe(18000000);
    expect(targetMingguan(null, 1.2, null)).toBe(null);
    expect(isJumatJakarta(new Date("2026-10-02T05:00:00Z"))).toBe(true);
    expect(isJumatJakarta(new Date("2026-10-01T05:00:00Z"))).toBe(false);
    expect(capaianPersen(21000000, 18000000)).toBe(116.7);
    expect(capaianPersen(5000, 0)).toBe(null);
  });

  it("rekomendasi 4 berurutan; celah memutus", () => {
    expect(
      layakRekomendasi([1, 2, 3, 4].map((m) => ({ mingguKe: m, omzet: 19000000, target: 18000000, status: "disetujui" }))),
    ).toBe(true);
    expect(
      layakRekomendasi([2, 3, 5, 6].map((m) => ({ mingguKe: m, omzet: 19000000, target: 18000000, status: "disetujui" }))),
    ).toBe(false);
  });
});

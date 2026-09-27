import { describe, expect, it } from "vitest";
import { kegiatanPadaHari, monthGrid, statusKegiatan } from "../../app/lib/kegiatan";
import type { Kegiatan } from "../../app/types/program";

const base = { tanggal_mulai: "2026-10-10T02:00:00Z", tanggal_selesai: "2026-10-12T09:00:00Z", batas_registrasi: null, kuota: null, terisi: 0 };

describe("statusKegiatan", () => {
  it("derives the status from dates, deadline and quota", () => {
    expect(statusKegiatan(base, new Date("2026-10-01T00:00:00Z"))).toBe("pendaftaran");
    expect(statusKegiatan({ ...base, batas_registrasi: "2026-09-30T00:00:00Z" }, new Date("2026-10-01T00:00:00Z"))).toBe("segera");
    expect(statusKegiatan({ ...base, kuota: 30, terisi: 30 }, new Date("2026-10-01T00:00:00Z"))).toBe("segera");
    expect(statusKegiatan(base, new Date("2026-10-11T00:00:00Z"))).toBe("berjalan");
    expect(statusKegiatan(base, new Date("2026-10-13T00:00:00Z"))).toBe("selesai");
  });
});

describe("month calendar", () => {
  it("starts weeks on Monday and pads the month", () => {
    const grid = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(grid[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it("places multi-day events on every day they run, in Jakarta time", () => {
    const event = { ...base, id: "1", tanggal_mulai: "2026-10-09T18:00:00Z" } as Kegiatan; // 10 Oct 01:00 WIB
    expect(kegiatanPadaHari([event], "2026-10-09")).toHaveLength(0);
    expect(kegiatanPadaHari([event], "2026-10-10")).toHaveLength(1);
    expect(kegiatanPadaHari([event], "2026-10-12")).toHaveLength(1);
  });
});

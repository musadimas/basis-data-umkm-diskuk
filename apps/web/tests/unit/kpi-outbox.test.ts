import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasilUntukEntri, type OutboxEntry } from "~/lib/kpi-outbox";

const baca = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

function entriUji(error: OutboxEntry["error"]): OutboxEntry {
  return {
    clientUuid: "00000000-0000-4000-8000-000000000001",
    pesertaId: "peserta-1",
    mingguKe: 3,
    realisasiOmzet: 100000,
    jumlahTransaksi: 4,
    kendala: null,
    photos: [],
    createdAt: "2026-09-28T00:00:00.000Z",
    error,
  };
}

describe("outbox KPI B25: hasil kirim jujur", () => {
  it("hasilUntukEntri memetakan hilang/antre/ditolak", () => {
    expect(hasilUntukEntri(undefined)).toBe("terkirim");
    expect(hasilUntukEntri(entriUji(null))).toBe("antre");
    expect(hasilUntukEntri(entriUji({ code: "LAPORAN_SUDAH_ADA", message: "x" }))).toBe("ditolak");
  });

  it("flushOutbox menolak non-retryable dengan error dan menahan retryable tanpa error", () => {
    const sumber = baca("../../app/lib/kpi-outbox.ts");
    expect(baca("../../app/lib/kpi.ts")).toMatch(/LAPORAN_SUDAH_ADA/);
    expect(sumber).toMatch(/retryable/);
    expect(sumber).toMatch(/entry\.error = /);
  });
});

describe("useKpiOutbox.add mengembalikan outcome (B25)", () => {
  it("add() mengembalikan Promise<HasilKirimOutbox>, bukan void", () => {
    const sumber = baca("../../app/composables/useKpiOutbox.ts");
    expect(sumber).toMatch(/HasilKirimOutbox/);
    expect(sumber).toMatch(/hasilUntukEntri/);
    expect(sumber).toMatch(/: Promise<.*HasilKirimOutbox/);
  });

  it("form usaha memakai outcome, bukan status online semata", () => {
    const sumber = baca("../../app/pages/(private)/dashboard/usaha/index.vue");
    expect(sumber).toMatch(/hasil/);
    expect(sumber).toMatch(/ditolak/);
    expect(sumber).not.toMatch(/outbox\.online\.value\s*\?\s*`Laporan minggu ke-/);
  });
});

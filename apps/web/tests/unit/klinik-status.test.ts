import { describe, expect, it } from "vitest";
import { KANBAN_KOLOM, KLINIK_STATUS, labelStatusKlinik } from "../../app/constants/PROGRAM";

describe("status klinik B34", () => {
  it("kanban tetap lima kolom tanpa dibatalkan", () => {
    expect(KANBAN_KOLOM.map((kolom) => kolom.value)).toEqual([
      "masuk",
      "dijadwalkan",
      "berjalan",
      "tindak_lanjut",
      "selesai",
    ]);
  });

  it("daftar status memuat dibatalkan sebagai anggota keenam", () => {
    expect(KLINIK_STATUS.map((item) => item.value)).toEqual([
      "masuk",
      "dijadwalkan",
      "berjalan",
      "tindak_lanjut",
      "selesai",
      "batal",
    ]);
    expect(KLINIK_STATUS.find((item) => item.value === "batal")?.label).toBe("Dibatalkan");
  });

  it("label yang dikenal memakai daftar; kode asing tampil apa adanya", () => {
    expect(labelStatusKlinik("masuk")).toBe("Tiket Masuk");
    expect(labelStatusKlinik("batal")).toBe("Dibatalkan");
    expect(labelStatusKlinik("kode_baru")).toBe("kode_baru");
    expect(labelStatusKlinik("")).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import {
  KATEGORI_KEGIATAN,
  batasRegistrasiTeks,
  filterDariQuery,
  hariJakarta,
  jadwalPengingatTeks,
  kegiatanPadaHari,
  labelBulan,
  monthGrid,
  queryKegiatan,
  sisaKuotaTeks,
  tindakanKegiatan,
  waktuKegiatan,
} from "../../app/lib/kegiatan";
import type { KegiatanAgenda } from "../../app/types/program";

const dasar: KegiatanAgenda = {
  id: "k1",
  judul: "Sertifikasi Halal Gratis",
  ringkasan: null,
  kategori: "sertifikasi",
  kategoriLabel: "Sertifikasi",
  penyelenggara: "Dinas KUMKM Kabupaten Subang",
  kotaNama: "Kabupaten Subang",
  metode: "luring",
  metodeLabel: "Luring",
  ramahDisabilitas: false,
  tanggalMulai: "2026-10-10T02:00:00.000Z",
  tanggalSelesai: "2026-10-12T09:00:00.000Z",
  batasRegistrasi: "2026-10-08T09:00:00.000Z",
  lokasi: "Gedung Sate",
  tautanDaring: null,
  kuota: 50,
  terisi: 10,
  sisaKuota: 40,
  status: "pendaftaran",
  statusLabel: "Pendaftaran Dibuka",
  silabus: null,
  narasumber: null,
  fasilitas: null,
  syarat: { skala: null, wilayah: null, nib: false, catatan: null },
  poster: null,
  registrationUrl: "https://daftar.example.invalid/halal",
  dokumenUrl: null,
  materiUrl: null,
};

describe("agenda filters", () => {
  it("keeps the five brief categories and reads them back from the URL", () => {
    expect(Object.keys(KATEGORI_KEGIATAN)).toEqual(["pelatihan", "sertifikasi", "pameran", "akselerasi", "literasi_digital"]);
    expect(queryKegiatan({ kategori: "sertifikasi", penyelenggara: "Dinas KUMKM Kota Bandung", metode: "luring", ramah: true })).toEqual({
      kategori: "sertifikasi",
      penyelenggara: "Dinas KUMKM Kota Bandung",
      metode: "luring",
      ramah: "1",
    });
    expect(queryKegiatan({ kategori: "", penyelenggara: "", metode: "", ramah: false })).toEqual({});
    expect(queryKegiatan({ kategori: "", penyelenggara: "", metode: "", ramah: false }, { tahun: 2026, bulan: 10 })).toEqual({ bulan: "10", tahun: "2026" });
    expect(filterDariQuery({ kategori: "aksalerasi", metode: "telepati", ramah: "1", penyelenggara: "X" })).toEqual({
      kategori: "",
      penyelenggara: "X",
      metode: "",
      ramah: true,
    });
    expect(filterDariQuery({ kategori: "pameran" }).kategori).toBe("pameran");
  });
});

describe("month calendar", () => {
  it("starts weeks on Monday and pads the month", () => {
    const grid = monthGrid(2026, 10); // October 2026 starts on a Thursday
    expect(grid[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(labelBulan(2026, 10)).toBe("Oktober 2026");
    // February of a leap year keeps the 1-based contract used by the API and the URL.
    expect(monthGrid(2028, 2).flat().filter(Boolean)).toHaveLength(29);
  });

  it("places multi-day events on every day they run, in Jakarta time", () => {
    const event = { ...dasar, tanggalMulai: "2026-10-09T18:00:00Z" }; // 10 Oct 01:00 WIB
    expect(hariJakarta(event.tanggalMulai)).toBe("2026-10-10");
    expect(kegiatanPadaHari([event], "2026-10-09")).toHaveLength(0);
    expect(kegiatanPadaHari([event], "2026-10-10")).toHaveLength(1);
    expect(kegiatanPadaHari([event], "2026-10-12")).toHaveLength(1);
  });
});

describe("call to action per status", () => {
  it("sends a running event to its official streaming/presence link", () => {
    const jalan = tindakanKegiatan({ ...dasar, status: "berjalan", tautanDaring: "https://zoom.example.invalid/a" });
    expect(jalan).toMatchObject({ jenis: "presensi", href: "https://zoom.example.invalid/a" });
    const tanpaTautan = tindakanKegiatan({ ...dasar, status: "berjalan", tautanDaring: null });
    expect(tanpaTautan.nonaktif).toBe(true);
    expect(tanpaTautan.href ?? null).toBeNull();
  });

  it("offers the official registration form and is honest when the link is missing", () => {
    expect(tindakanKegiatan(dasar)).toMatchObject({ jenis: "daftar", label: "Daftar Sekarang", href: "https://daftar.example.invalid/halal" });
    const tanpaUrl = tindakanKegiatan({ ...dasar, registrationUrl: null });
    expect(tanpaUrl.nonaktif).toBe(true);
    expect(tanpaUrl.pesan).toContain("belum tersedia");
    // No promise of an internal registration that Stage 1 does not have.
    expect(tanpaUrl.pesan).not.toContain("internal");
  });

  it("offers the reminder when registration is closed and materials once finished", () => {
    expect(tindakanKegiatan({ ...dasar, status: "segera" })).toMatchObject({ jenis: "pengingat", label: "Ingatkan saya" });
    expect(tindakanKegiatan({ ...dasar, status: "selesai", materiUrl: "https://materi.example.invalid/x" })).toMatchObject({
      jenis: "materi",
      href: "https://materi.example.invalid/x",
    });
    expect(tindakanKegiatan({ ...dasar, status: "selesai", materiUrl: null }).nonaktif).toBe(true);
  });
});

describe("focus card copy", () => {
  it("writes the schedule, the remaining quota and the registration deadline", () => {
    expect(waktuKegiatan(dasar)).toBe("10 Okt 2026, 09.00 – 12 Okt 2026, 16.00 WIB");
    expect(sisaKuotaTeks(dasar)).toBe("Sisa 40 dari 50 kuota");
    expect(sisaKuotaTeks({ ...dasar, sisaKuota: 0 })).toBe("Kuota penuh");
    expect(sisaKuotaTeks({ ...dasar, kuota: null, sisaKuota: null })).toBeNull();
    expect(batasRegistrasiTeks(dasar)).toBe("Batas registrasi 8 Okt 2026, 16.00 WIB");
    expect(batasRegistrasiTeks({ ...dasar, batasRegistrasi: null })).toBeNull();
    expect(jadwalPengingatTeks("2026-10-09T02:00:00Z")).toBe("Pengingat dijadwalkan 9 Okt 2026, 09.00 WIB");
  });
});

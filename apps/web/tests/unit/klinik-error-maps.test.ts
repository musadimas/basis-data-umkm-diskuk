import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// B35: penjaga drift — setiap kode error yang dikirim server untuk alur klinik/KPI
// harus punya pesan di peta web, dan peta tidak boleh memuat kode yang tak pernah
// dikirim server (contoh: NOMOR_TIDAK_VALID).
const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const baca = (rel: string) => readFileSync(join(AKAR, rel), "utf8");

/** Kunci dari blok literal satu-kunci-per-baris (`const NAMA ... = { KODE: ..., };`). */
function kunciPeta(sumber: string, nama: string): string[] {
  const blok = sumber.slice(sumber.indexOf(`const ${nama}`));
  const isi = blok.slice(0, blok.indexOf("\n};"));
  return [...isi.matchAll(/^ {2}([A-Z][A-Z_0-9]*):/gm)].map((cocok) => cocok[1]);
}

const SUMBER_SERVER = [
  "services/directus/extensions/program/src/endpoints/klinik/service.js",
  "services/directus/extensions/program/src/endpoints/klinik/penugasan.js",
  "services/directus/extensions/program/src/endpoints/klinik/direktori.js",
  "services/directus/extensions/program/src/endpoints/klinik/outcome.js",
  "services/directus/extensions/program/src/endpoints/klinik/rules.js",
  "services/directus/extensions/program/src/endpoints/klinik/index.js",
  "services/directus/extensions/program/src/endpoints/kpi/service.js",
  "services/directus/extensions/program/src/lib/captcha.js",
  "services/directus/extensions/program/src/lib/utils/http.js",
  "services/directus/extensions/program/src/lib/validate.js",
  "services/directus/analytics-shared/cakupan.cjs",
];

/** Kode statis `ProgramError(status, "KODE")` + kode dinamis TANGGAL_* dari rules. */
function korpusServer(): Set<string> {
  const kode = new Set<string>();
  for (const rel of SUMBER_SERVER) {
    const isi = baca(rel);
    for (const cocok of isi.matchAll(/CakupanError\s*\(\s*\d+\s*,\s*"([A-Z0-9_]+)"/g)) kode.add(cocok[1]);
    for (const cocok of isi.matchAll(/ProgramError\s*\(\s*\d+\s*,\s*"([A-Z0-9_]+)"/g)) kode.add(cocok[1]);
    for (const cocok of isi.matchAll(/"(TANGGAL_[A-Z_]+)"/g)) kode.add(cocok[1]);
    // Kode bawaan parameter, mis. `uuidParam(value, code = "INVALID_ID")`.
    for (const cocok of isi.matchAll(/\bcode\s*=\s*"([A-Z][A-Z_0-9]+)"/g)) kode.add(cocok[1]);
    // Kode dari literal `code:` tanpa konstruktor ProgramError (mis. 23503 → INVALID_REFERENCE).
    for (const cocok of isi.matchAll(/code:\s*"([A-Z][A-Z_0-9]+)"/g)) kode.add(cocok[1]);
  }
  return kode;
}

// Semua halaman klinik memakai satu peta di module klien (Kandidat 06).
const PETA = {
  konsultasi: { berkas: "apps/web/app/lib/klinik.ts", nama: "PESAN_KLINIK" },
  klinik: { berkas: "apps/web/app/lib/klinik.ts", nama: "PESAN_KLINIK" },
  lacak: { berkas: "apps/web/app/lib/klinik.ts", nama: "PESAN_KLINIK" },
  kpi: { berkas: "apps/web/app/lib/kpi.ts", nama: "PESAN_KPI" },
} as const;

describe("peta error klinik/KPI menutupi kode server (B35)", () => {
  it("formulir publik memetakan seluruh penolakan pemesanan", () => {
    const kunci = kunciPeta(baca(PETA.konsultasi.berkas), PETA.konsultasi.nama);
    for (const kode of [
      "CAPTCHA_INVALID",
      "SLOT_PENUH",
      "POLI_TIDAK_VALID",
      "TANGGAL_TIDAK_VALID",
      "TANGGAL_DI_LUAR_RENTANG",
      "TANGGAL_AKHIR_PEKAN",
      "LAMPIRAN_TERLALU_BANYAK",
      "LAMPIRAN_TERLALU_BESAR",
      "LAMPIRAN_TIDAK_DIDUKUNG",
      "INVALID_PAYLOAD",
    ]) {
      expect(kunci, `konsultasi.vue memetakan ${kode}`).toContain(kode);
    }
  });

  it("panel petugas memetakan penolakan PATCH termasuk slot dan kota", () => {
    const kunci = kunciPeta(baca(PETA.klinik.berkas), PETA.klinik.nama);
    for (const kode of [
      "TIKET_BERUBAH",
      "TRANSISI_TIDAK_VALID",
      "BUKAN_PENUGASAN_ANDA",
      "INVALID_PAYLOAD",
      "SLOT_PENUH",
      "KOTA_NOT_ASSIGNED",
    ]) {
      expect(kunci, `klinik.vue memetakan ${kode}`).toContain(kode);
    }
  });

  it("lacak tiket memakai TIKET_TIDAK_DITEMUKAN, bukan NOMOR_TIDAK_VALID", () => {
    const kunci = kunciPeta(baca(PETA.lacak.berkas), PETA.lacak.nama);
    expect(kunci).toContain("TIKET_TIDAK_DITEMUKAN");
    expect(kunci).toContain("CAPTCHA_INVALID");
    expect(kunci).toContain("INVALID_PAYLOAD");
    expect(kunci, "kode yang tak pernah dikirim server").not.toContain("NOMOR_TIDAK_VALID");
  });

  it("outbox KPI memetakan konflik id dan bukti tak valid", () => {
    const kunci = kunciPeta(baca(PETA.kpi.berkas), PETA.kpi.nama);
    for (const kode of [
      "LAPORAN_SUDAH_ADA",
      "MINGGU_TIDAK_VALID",
      "PESERTA_TIDAK_AKTIF",
      "CLIENT_UUID_CONFLICT",
      "BUKTI_TIDAK_VALID",
      "INVALID_PAYLOAD",
    ]) {
      expect(kunci, `kpi.ts memetakan ${kode}`).toContain(kode);
    }
  });

  it("tidak ada kunci peta yang asing bagi server", () => {
    const korpus = korpusServer();
    for (const [label, peta] of Object.entries(PETA)) {
      for (const kode of kunciPeta(baca(peta.berkas), peta.nama)) {
        expect([...korpus], `${label}: ${kode} dikirim server`).toContain(kode);
      }
    }
  });
});

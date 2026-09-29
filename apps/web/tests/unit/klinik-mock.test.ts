import { describe, expect, it } from "vitest";
import { AKTOR_MOCK, VERSI_AWAL, klinikMockResponse } from "../fixtures/klinik-data.mjs";

// Mock Playwright klinik: aturannya diimpor dari rules backend, jadi tes ini menjaga bahwa mock
// benar-benar memakainya (M1-M5 di architecture_review_fixes.md, Kandidat 06).

interface Aktor {
  id: string;
  admin: boolean;
  peran: string;
  kotaId?: number | null;
}

/** Isian PATCH/POST uji: nilai skalar atau daftar sederhana. */
interface Isi {
  [kunci: string]: string | number | boolean | null | string[];
}

interface Kunci {
  id: string;
  nomor: string;
  status: string;
  pendamping: string | null;
  kotaId?: number | null;
  whatsapp: string;
  poli: number;
  jadwalTanggal: string;
  jadwalSlot: string;
  versi?: string;
  riwayat?: { aksi: string }[];
}

const baris = (id: string, overrides: Partial<Kunci> = {}): Kunci => ({
  id,
  nomor: `KLN-2026-09-000${id.slice(-1)}`,
  status: "masuk",
  pendamping: null,
  whatsapp: "081234567890",
  poli: 1,
  jadwalTanggal: "2026-10-07",
  jadwalSlot: "10:30",
  ...overrides,
});

const keadaan = (tiket: Kunci[], aktor: Aktor | null = null) => ({ tiket, tiketForms: [], requests: [], prefill: null, aktor });
const daftar = (state: ReturnType<typeof keadaan>, query = {}) => klinikMockResponse({ method: "GET", path: "/klinik/tiket", query, state });
const patch = (state: ReturnType<typeof keadaan>, id: string, body: Isi) => klinikMockResponse({ method: "PATCH", path: `/klinik/tiket/${id}`, body, state });

/** Hari kerja 14 hari ke depan (sudah lolos aturan rentang dan akhir pekan server). */
function hariKerja() {
  const tanggal = new Date(Date.now() + 7 * 3_600_000 + 14 * 86_400_000);
  while ([0, 6].includes(tanggal.getUTCDay())) tanggal.setUTCDate(tanggal.getUTCDate() + 1);
  return tanggal.toISOString().slice(0, 10);
}

describe("M1: daftar tiket mengikuti cakupan dan menyaring batal", () => {
  it("batal hanya muncul dengan ?status=batal; status tak dikenal ditolak", () => {
    const state = keadaan([baris("a1"), baris("a2", { status: "batal" })]);
    expect(daftar(state).data.map((item: Kunci) => item.id)).toEqual(["a1"]);
    expect(daftar(state, { status: "batal" }).data.map((item: Kunci) => item.id)).toEqual(["a2"]);
    expect(daftar(state, { status: "aneh" })).toMatchObject({ status: 400, code: "INVALID_PAYLOAD" });
  });

  it("kabkota hanya melihat tiket usaha di kotanya; pendamping tiket sendiri + kolam", () => {
    const tiket = [baris("a1", { kotaId: 3201 }), baris("a2", { kotaId: 3273 }), baris("a3", { kotaId: null })];
    const kab = keadaan(tiket, { id: "k", admin: false, peran: "kabkota", kotaId: 3201 });
    expect(daftar(kab).data.map((item: Kunci) => item.id)).toEqual(["a1"]);

    const pend = keadaan([baris("a1", { pendamping: "p1" }), baris("a2", { pendamping: "p2" }), baris("a3")], { id: "p1", admin: false, peran: "pendamping" });
    expect(daftar(pend).data.map((item: Kunci) => item.id)).toEqual(["a1", "a3"]);
  });

  it("DTO membawa transisi, statusLabel, dan versi dari rules", () => {
    const [item] = daftar(keadaan([baris("a1")])).data;
    expect(item).toMatchObject({ statusLabel: "Tiket Masuk", transisi: ["dijadwalkan", "batal"], versi: VERSI_AWAL });
  });
});

describe("M2/M3: PATCH memakai aturan klaim dan audit server", () => {
  const pendamping = { id: "p1", admin: false, peran: "pendamping" };

  it("tiket kolam hanya bisa diklaim dulu; sesudahnya penugasan menjadi milik pendamping itu", () => {
    const state = keadaan([baris("a1")], pendamping);
    expect(patch(state, "a1", { status: "dijadwalkan", versi: VERSI_AWAL })).toMatchObject({ status: 403, code: "BUKAN_PENUGASAN_ANDA" });
    const klaim = patch(state, "a1", { pendamping: "p1", versi: VERSI_AWAL });
    expect(klaim.status).toBe(200);
    expect(klaim.data.transisi).toEqual(["dijadwalkan", "batal"]);
    expect(patch(state, "a1", { status: "dijadwalkan", versi: klaim.data.versi }).status).toBe(200);
  });

  it("versi wajib, basi ditolak, loncat tahap ditolak", () => {
    const state = keadaan([baris("a1")]);
    expect(patch(state, "a1", { status: "dijadwalkan" })).toMatchObject({ status: 400, code: "INVALID_PAYLOAD" });
    expect(patch(state, "a1", { status: "dijadwalkan", versi: "2026-01-01T00:00:00.000000Z" })).toMatchObject({ status: 409, code: "TIKET_BERUBAH" });
    expect(patch(state, "a1", { status: "selesai", versi: VERSI_AWAL })).toMatchObject({ status: 409, code: "TRANSISI_TIDAK_VALID" });
  });

  it("satu baris audit per jenis perubahan, terbaru di depan", () => {
    const state = keadaan([baris("a1")]);
    const hasil = patch(state, "a1", { status: "dijadwalkan", pendamping: "p9", actionPlan: "Daftar PIRT", versi: VERSI_AWAL });
    expect(hasil.status).toBe(200);
    expect(hasil.data.riwayat.map((jejak: { aksi: string }) => jejak.aksi)).toEqual(["catatan", "penugasan", "transisi"]);
  });
});

describe("M4/M5: lacak dan booking", () => {
  const lacak = (state: ReturnType<typeof keadaan>, body: Isi) => klinikMockResponse({ method: "POST", path: "/klinik/tiket/lacak", body, state });

  it("lacak menormalkan nomor WhatsApp dan menjawab 404 untuk nomor salah format", () => {
    const state = keadaan([baris("a1", { nomor: "KLN-2026-09-0001", whatsapp: "6281234567890" })]);
    expect(lacak(state, { nomor: "kln-2026-09-0001", whatsapp: "+62 812-3456-7890", captcha: "t" }).status).toBe(200);
    expect(lacak(state, { nomor: "KLN-1", whatsapp: "081234567890", captcha: "t" })).toMatchObject({ status: 404, code: "TIKET_TIDAK_DITEMUKAN" });
    expect(lacak(state, { nomor: "KLN-2026-09-0001", whatsapp: "0899999999", captcha: "t" })).toMatchObject({ status: 404 });
    expect(lacak(state, { nomor: "KLN-2026-09-0001", whatsapp: "081234567890" })).toMatchObject({ status: 400, code: "CAPTCHA_INVALID" });
  });

  const pesan = (state: ReturnType<typeof keadaan>, payload: Isi, files: string[] = []) =>
    klinikMockResponse({ method: "POST", path: "/klinik/tiket", form: { payload, captcha: "t", files, contentType: "multipart/form-data" }, state });
  const dasar = (): Isi => ({
    namaUsaha: "Warung Bu Siti",
    namaKontak: "Siti",
    whatsapp: "0812-3456-7890",
    email: null,
    poli: 4,
    deskripsi: "Akun marketplace kami dibekukan tanpa alasan.",
    moda: "daring",
    tanggal: hariKerja(),
    slot: "10:30",
    consent: true,
  });

  it("tanggal akhir pekan/di luar rentang ditolak; poli diambil dari KLINIK_POLI; slot terisi 409", () => {
    const state = keadaan([]);
    expect(pesan(state, { ...dasar(), tanggal: "2020-01-01" })).toMatchObject({ status: 400, code: "TANGGAL_DI_LUAR_RENTANG" });
    expect(pesan(state, { ...dasar(), tanggal: "kemarin" })).toMatchObject({ status: 400, code: "TANGGAL_TIDAK_VALID" });
    expect(pesan(state, { ...dasar(), poli: 99 })).toMatchObject({ status: 400, code: "POLI_TIDAK_VALID" });
    expect(pesan(state, { ...dasar(), whatsapp: "12345" })).toMatchObject({ status: 400, code: "INVALID_PAYLOAD" });
    expect(pesan(state, dasar(), ["a", "b", "c", "d"])).toMatchObject({ status: 400, code: "LAMPIRAN_TERLALU_BANYAK" });

    const pertama = pesan(state, dasar());
    expect(pertama.status).toBe(201);
    expect(pertama.data.poli).toBe("Advokasi & Mediasi PMSE");
    expect(state.tiket[0]).toMatchObject({ whatsapp: "6281234567890", poliNama: "Advokasi & Mediasi PMSE" });
    expect(pesan(state, dasar())).toMatchObject({ status: 409, code: "SLOT_PENUH" });
    expect(AKTOR_MOCK.peran).toBe("provinsi");
  });
});

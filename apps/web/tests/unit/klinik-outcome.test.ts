import { describe, expect, it } from "vitest";
import { ATRIBUT_OUTCOME } from "../../../../services/directus/extensions/program/src/endpoints/klinik/rules.js";
import { KLINIK_ATRIBUT_OUTCOME } from "../../app/constants";
import { direktoriKlinik, hasilKonsultasiProfil, klinikMockResponse, statistikKlinik } from "../fixtures/klinik-data.mjs";

// R04: 15 atribut outcome dan mock klinik. Aturan (aktor berbeda, wilayah, alasan) diimpor dari server;
// tes ini menjaga bahwa mock benar-benar memakainya dan bahwa label web tidak menyimpang dari server.

interface Aktor {
  id: string;
  admin: boolean;
  peran: string;
  kotaId?: number | null;
  nama?: string;
}

/** Isian request uji: skalar, daftar, atau objek bersarang. */
interface Isi {
  [kunci: string]: string | number | boolean | null | Isi | Isi[];
}

interface Tiket {
  id: string;
  nomor: string;
  usaha: string | null;
  kotaId: number | null;
  namaUsaha: string;
  poliNama: string;
  whatsapp: string;
  poli: number;
  status: string;
  pendamping: string;
  jadwalTanggal: string;
  jadwalSlot: string;
  dateCreated: string;
  versi?: string;
  riwayat: string[];
}

interface JawabanCsat {
  tiket: string;
  nilai: number;
  consent: boolean;
}

interface Keadaan {
  tiket: Tiket[];
  tiketForms: Isi[];
  requests: Isi[];
  prefill: null;
  aktor: Aktor | null;
  csat: JawabanCsat[];
  outcomes: Isi[];
}

interface Baris {
  outcome: { id: string; status: string; aksi: string[] } | null;
  outcomeBisaDicatat: boolean;
}

const USAHA = "11111111-1111-4111-8111-000000000001";
const ID_TIKET = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const VERSI = "2026-09-27T10:00:00.000000Z";
const pendamping: Aktor = { id: "p1", admin: false, peran: "pendamping" };
const provinsiA: Aktor = { id: "v1", admin: false, peran: "provinsi", nama: "Verifikator A" };
const provinsiB: Aktor = { id: "v2", admin: false, peran: "provinsi", nama: "Verifikator B" };
const kabkotaLain: Aktor = { id: "k2", admin: false, peran: "kabkota", kotaId: 2 };
const kabkotaSama: Aktor = { id: "k1", admin: false, peran: "kabkota", kotaId: 1 };

const tiketSelesai = (overrides: Partial<Tiket> = {}): Tiket => ({
  id: ID_TIKET,
  nomor: "KLN-2026-09-0001",
  usaha: USAHA,
  kotaId: 1,
  namaUsaha: "Warung Bu Siti",
  poliNama: "Legalitas & Standardisasi Produk",
  whatsapp: "081234567890",
  poli: 1,
  status: "selesai",
  pendamping: "p1",
  jadwalTanggal: "2026-10-07",
  jadwalSlot: "10:30",
  dateCreated: "2026-09-27T10:00:00Z",
  riwayat: [],
  ...overrides,
});

const keadaan = (tiket: Tiket[], aktor: Aktor | null = null): Keadaan => ({ tiket, tiketForms: [], requests: [], prefill: null, aktor, csat: [], outcomes: [] });
/** Pandangan atas state yang sama dengan aktor lain, seperti dua browser di depan satu server. */
const sebagai = (state: Keadaan, aktor: Aktor): Keadaan => Object.assign(Object.create(state), { aktor });

const catat = (state: Keadaan, items: Isi[], id = ID_TIKET) => klinikMockResponse({ method: "POST", path: `/klinik/tiket/${id}/outcome`, body: { items }, state });
const antrean = (state: Keadaan) => klinikMockResponse({ method: "GET", path: "/klinik/outcome", query: {}, state });
const tindak = (state: Keadaan, id: string, aksi: string, body: Isi = {}) => klinikMockResponse({ method: "POST", path: `/klinik/outcome/${id}/${aksi}`, body, state });
const daftarTiket = (state: Keadaan): Baris[] => klinikMockResponse({ method: "GET", path: "/klinik/tiket", query: {}, state }).data;

describe("15 atribut outcome di web sama dengan server", () => {
  it("kunci snake_case dan label mengikuti ATRIBUT_OUTCOME, urutan ATRIBUT_JABAR", () => {
    expect(Object.fromEntries(KLINIK_ATRIBUT_OUTCOME.map((item) => [item.value, item.label]))).toEqual(ATRIBUT_OUTCOME);
  });
});

describe("statistik dan direktori", () => {
  it("CSAT kosong adalah null, dan hanya jawaban ber-consent yang dihitung", () => {
    const state = keadaan([]);
    expect(statistikKlinik(state).csat).toEqual({ rataRata: null, sampel: 0, skalaMaks: 5 });
    state.csat.push({ tiket: "a", nilai: 4, consent: true }, { tiket: "b", nilai: 1, consent: false });
    expect(statistikKlinik(state).csat).toEqual({ rataRata: 4, sampel: 1, skalaMaks: 5 });
  });

  it("konsultan tanpa slot bebas tetap tampil dengan ketersediaan kosong", () => {
    const { konsultan } = direktoriKlinik(keadaan([]), 14);
    expect(konsultan.map((item: { ketersediaan: { tanggal: string }[] }) => item.ketersediaan.length > 0)).toEqual([true, true, false]);
    expect(konsultan[2]).toMatchObject({ afiliasiLabel: "Praktisi", totalSlotBebas: 0 });
  });
});

describe("outcome: catat, verifikasi beda aktor, koreksi, cabut", () => {
  const items: Isi[] = [{ atribut: "npwp_usaha", jenis: "kepatuhan" }, { atribut: "qris", jenis: "perbaikan" }];

  it("hanya tiket selesai milik usaha terdaftar; retry sama jadi duplikat, isi lain ditolak", () => {
    const state = keadaan([tiketSelesai(), tiketSelesai({ id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002", usaha: null }), tiketSelesai({ id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000003", status: "berjalan" })]);
    const petugas = sebagai(state, pendamping);
    expect(catat(petugas, items, "aaaaaaaa-aaaa-4aaa-8aaa-000000000002")).toMatchObject({ status: 409, code: "USAHA_TIDAK_TERTAUT" });
    expect(catat(petugas, items, "aaaaaaaa-aaaa-4aaa-8aaa-000000000003")).toMatchObject({ status: 409, code: "TIKET_BELUM_SELESAI" });
    expect(catat(petugas, [{ atribut: "npwp_usaha", jenis: "salah" }])).toMatchObject({ status: 400, code: "OUTCOME_TIDAK_VALID" });
    const baru = catat(petugas, items);
    expect(baru).toMatchObject({ status: 201, data: { duplikat: false } });
    expect(catat(petugas, [...items].reverse())).toMatchObject({ status: 200, data: { id: baru.data.id, duplikat: true } });
    expect(catat(petugas, [items[0]])).toMatchObject({ status: 409, code: "OUTCOME_SUDAH_ADA" });
  });

  it("aksi mengikuti aktor: pengaju tanpa verifikasi, pendamping tanpa aksi, wilayah lain tanpa akses", () => {
    const state = keadaan([tiketSelesai()]);
    catat(sebagai(state, provinsiA), items);
    const milikPengaju = daftarTiket(sebagai(state, provinsiA))[0]!;
    expect(milikPengaju.outcome).toMatchObject({ status: "diajukan", aksi: ["koreksi", "cabut"] });
    expect(milikPengaju.outcomeBisaDicatat).toBe(false);
    expect(daftarTiket(sebagai(state, provinsiB))[0]!.outcome!.aksi).toEqual(["verifikasi", "koreksi", "cabut"]);
    expect(daftarTiket(sebagai(state, pendamping))[0]!.outcome!.aksi).toEqual([]);
    expect(antrean(sebagai(state, pendamping))).toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(antrean(sebagai(state, kabkotaLain)).data).toEqual([]);
    expect(daftarTiket(sebagai(state, kabkotaLain))).toEqual([]);
    expect(antrean(sebagai(state, kabkotaSama)).data).toHaveLength(1);
  });

  it("verifikasi menolak pengaju, lalu profil hanya memuat outcome terverifikasi; koreksi dan cabut mengubahnya", () => {
    const state = keadaan([tiketSelesai()]);
    const id = catat(sebagai(state, provinsiA), items).data.id;
    expect(tindak(sebagai(state, provinsiA), id, "verifikasi")).toMatchObject({ status: 409, code: "VERIFIKATOR_SAMA" });
    expect(hasilKonsultasiProfil(state, USAHA)).toEqual([]);

    expect(tindak(sebagai(state, provinsiB), id, "verifikasi")).toMatchObject({ status: 200, data: { status: "terverifikasi", duplikat: false } });
    expect(tindak(sebagai(state, provinsiB), id, "verifikasi")).toMatchObject({ data: { duplikat: true } });
    expect(hasilKonsultasiProfil(state, USAHA)).toMatchObject([{ nomorTiket: "KLN-2026-09-0001", diverifikasiOleh: "Verifikator B", items: [{ atribut: "npwpUsaha", jenis: "kepatuhan" }, { atribut: "qris", jenis: "perbaikan" }] }]);
    expect(antrean(sebagai(state, provinsiB)).data).toEqual([]);

    expect(tindak(sebagai(state, provinsiB), id, "koreksi", { items, alasan: "Sal" })).toMatchObject({ status: 400, code: "OUTCOME_TIDAK_VALID" });
    expect(tindak(sebagai(state, provinsiB), id, "koreksi", { items, alasan: "Isi sama saja" })).toMatchObject({ status: 409, code: "OUTCOME_TIDAK_BERUBAH" });
    const koreksi = tindak(sebagai(state, provinsiB), id, "koreksi", { items: [items[0]], alasan: "QRIS belum aktif" });
    expect(koreksi).toMatchObject({ status: 200, data: { versi: 2, status: "terverifikasi" } });
    expect(hasilKonsultasiProfil(state, USAHA)).toMatchObject([{ versi: 2, items: [{ atribut: "npwpUsaha" }] }]);
    expect(tindak(sebagai(state, provinsiB), id, "koreksi", { items: [items[0]], alasan: "QRIS belum aktif" })).toMatchObject({ data: { duplikat: true } });

    const dicabut = tindak(sebagai(state, provinsiB), koreksi.data.id, "cabut", { alasan: "Salah catat" });
    expect(dicabut).toMatchObject({ status: 200, data: { status: "dicabut", duplikat: false } });
    expect(hasilKonsultasiProfil(state, USAHA)).toEqual([]);
    const tiket = daftarTiket(sebagai(state, provinsiB))[0]!;
    expect(tiket.outcome).toMatchObject({ status: "dicabut", aksi: [], alasanCabut: "Salah catat" });
    expect(tiket.outcomeBisaDicatat).toBe(true);
  });

  it("outcome ikut PATCH hanya bersama status selesai dan dibatalkan utuh bila ditolak", () => {
    const state = keadaan([tiketSelesai({ status: "tindak_lanjut", versi: VERSI })]);
    const petugas = sebagai(state, pendamping);
    const patch = (body: Isi) => klinikMockResponse({ method: "PATCH", path: `/klinik/tiket/${ID_TIKET}`, body: { versi: VERSI, ...body }, state: petugas });
    expect(patch({ catatan: "x", outcome: { items } })).toMatchObject({ status: 400, code: "OUTCOME_TIDAK_VALID" });
    expect(patch({ status: "selesai", outcome: { items: [] } })).toMatchObject({ status: 400, code: "OUTCOME_TIDAK_VALID" });
    const ditutup = patch({ status: "selesai", outcome: { items } });
    expect(ditutup).toMatchObject({ status: 200, data: { status: "selesai", outcome: { status: "diajukan", items: [{ label: "NPWP Usaha" }, { label: "QRIS" }] } } });

    const tanpaUsaha = tiketSelesai({ usaha: null, status: "tindak_lanjut", versi: VERSI });
    const gagalTutup = klinikMockResponse({
      method: "PATCH",
      path: `/klinik/tiket/${ID_TIKET}`,
      body: { versi: VERSI, status: "selesai", outcome: { items } },
      state: sebagai(keadaan([tanpaUsaha]), pendamping),
    });
    expect(gagalTutup).toMatchObject({ status: 409, code: "USAHA_TIDAK_TERTAUT" });
    expect(tanpaUsaha.status).toBe("tindak_lanjut");
  });
});

describe("CSAT", () => {
  const dinilai = (state: Keadaan, body: Isi) => klinikMockResponse({ method: "POST", path: "/klinik/tiket/csat", body: { nomor: "KLN-2026-09-0001", whatsapp: "081234567890", nilai: 5, consent: true, captcha: "token", ...body }, state });

  it("satu jawaban per tiket selesai, dan lacak menandai bisa/sudah menilai", () => {
    const state = keadaan([tiketSelesai(), tiketSelesai({ id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002", nomor: "KLN-2026-09-0002", status: "masuk" })]);
    const lacak = (nomor: string) => klinikMockResponse({ method: "POST", path: "/klinik/tiket/lacak", body: { nomor, whatsapp: "081234567890", captcha: "token" }, state }).data.csat;
    expect(lacak("KLN-2026-09-0001")).toEqual({ bisaMenilai: true, sudahMenilai: false });
    expect(lacak("KLN-2026-09-0002")).toEqual({ bisaMenilai: false, sudahMenilai: false });
    expect(dinilai(state, { nomor: "KLN-2026-09-0002" })).toMatchObject({ status: 409, code: "TIKET_BELUM_SELESAI" });
    expect(dinilai(state, { nilai: 6 })).toMatchObject({ status: 400, code: "INVALID_PAYLOAD" });
    expect(dinilai(state, { whatsapp: "081200000000" })).toMatchObject({ status: 404, code: "TIKET_TIDAK_DITEMUKAN" });
    expect(dinilai(state, { consent: false })).toMatchObject({ status: 201, data: { tersimpan: true, dihitung: false } });
    expect(dinilai(state, {})).toMatchObject({ status: 409, code: "CSAT_SUDAH_ADA" });
    expect(lacak("KLN-2026-09-0001")).toEqual({ bisaMenilai: false, sudahMenilai: true });
    expect(statistikKlinik(state).csat.rataRata).toBeNull();
  });
});

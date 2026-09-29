import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  KlinikError,
  PESAN_KLINIK,
  batalkan,
  daftarTiket,
  jadwalkanUlang,
  klaim,
  lacakTiket,
  majukan,
  pesanKlinik,
  pesanTiket,
  prefillSaya,
  simpanSesi,
  slotTersedia,
  tahapBerikutnya,
  type FormTiket,
  type KlinikClient,
} from "../../app/lib/klinik";
import type { KlinikPrefill, KlinikStatus, KlinikTiket } from "../../app/types/program";

interface Panggilan {
  path: string;
  method: string;
  params: Record<string, string | number | boolean>;
  body: string | FormData | undefined;
}

/** Bentuk galat SDK Directus: status HTTP di `response` dan kode di `errors[0].extensions`. */
const galat = (status: number, code: string) => Object.assign(new Error(code), { response: { status }, errors: [{ message: "x", extensions: { code } }] });

/** Client palsu: setiap perintah SDK dieksekusi menjadi deskripsi request-nya, lalu dijawab `jawab`. */
type Jawaban = Error | KlinikTiket | KlinikTiket[] | KlinikPrefill | { nomor: string };

function clientPalsu(jawab: (panggilan: Panggilan) => Jawaban) {
  const panggilan: Panggilan[] = [];
  const client: KlinikClient = {
    request: async (perintah) => {
      const opsi = perintah();
      const catatan: Panggilan = { path: opsi.path, method: opsi.method ?? "GET", params: opsi.params ?? {}, body: opsi.body };
      panggilan.push(catatan);
      const hasil = jawab(catatan);
      if (hasil instanceof Error) throw hasil;
      // SAFETY: stub menjawab data uji; tipe Output ditentukan oleh kasus uji yang memanggilnya.
      return hasil as never;
    },
  };
  return { client, panggilan };
}

const tiket = (overrides: Partial<KlinikTiket> = {}): KlinikTiket => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
  nomor: "KLN-2026-09-0001",
  usaha: null,
  namaUsaha: "Warung Bu Siti",
  namaKontak: "Siti",
  whatsapp: "081234567890",
  email: null,
  poli: 1,
  poliNama: "Legalitas",
  deskripsi: "Butuh PIRT",
  moda: "daring",
  jadwalTanggal: "2026-10-05",
  jadwalSlot: "10:30",
  prioritas: "normal",
  status: "masuk",
  statusLabel: "Tiket Masuk",
  transisi: ["dijadwalkan", "batal"],
  pendamping: null,
  pendampingNama: null,
  pemohon: null,
  sumberIdentitas: "manual",
  waConsent: true,
  linkMeet: null,
  diagnosis: {},
  actionPlan: null,
  rujukan: [],
  catatan: null,
  lampiran: [],
  notifikasi: null,
  versi: "2026-09-27T10:31:12.123456Z",
  dateCreated: "2026-09-26T00:00:00Z",
  dateUpdated: "2026-09-26T00:00:00Z",
  ...overrides,
});

const bodyJson = (panggilan: Panggilan) => JSON.parse(String(panggilan.body));

describe("tulis petugas memakai transisi dari server dan selalu mengirim versi", () => {
  it("majukan mengirim tahap pertama selain batal dari tiket.transisi, bersama versi", async () => {
    const { client, panggilan } = clientPalsu(() => tiket({ status: "dijadwalkan" }));
    const hasil = await majukan(client, tiket());
    expect(hasil?.status).toBe("dijadwalkan");
    expect(panggilan).toHaveLength(1);
    expect(panggilan[0]).toMatchObject({ path: "/v1/program/klinik/tiket/aaaaaaaa-aaaa-4aaa-8aaa-000000000001", method: "PATCH" });
    expect(bodyJson(panggilan[0]!)).toEqual({ status: "dijadwalkan", versi: "2026-09-27T10:31:12.123456Z" });
  });

  it("majukan tidak meminta apa pun bila server tidak menawarkan tahap berikutnya", async () => {
    const { client, panggilan } = clientPalsu(() => tiket());
    expect(await majukan(client, tiket({ status: "selesai", transisi: [] }))).toBeNull();
    expect(await majukan(client, tiket({ transisi: ["batal"] }))).toBeNull();
    expect(panggilan).toHaveLength(0);
    const transisi: KlinikStatus[] = ["berjalan", "batal"];
    expect(tahapBerikutnya(tiket({ transisi }))).toBe("berjalan");
  });

  it("klaim dan simpanSesi membawa versi tiket yang dilihat petugas", async () => {
    const { client, panggilan } = clientPalsu(() => tiket());
    await klaim(client, tiket(), "user-1");
    await simpanSesi(client, tiket({ versi: "2026-09-27T11:00:00.000001Z" }), { catatan: "Sudah dihubungi", linkMeet: null });
    expect(bodyJson(panggilan[0]!)).toEqual({ pendamping: "user-1", versi: "2026-09-27T10:31:12.123456Z" });
    expect(bodyJson(panggilan[1]!)).toEqual({ catatan: "Sudah dihubungi", linkMeet: null, versi: "2026-09-27T11:00:00.000001Z" });
  });

  it("batalkan dan jadwalkanUlang hanya jalan bila server mengizinkannya", async () => {
    const { client, panggilan } = clientPalsu(() => tiket());
    expect(await batalkan(client, tiket({ status: "selesai", transisi: [] }))).toBeNull();
    expect(await jadwalkanUlang(client, tiket())).toBeNull();
    expect(panggilan).toHaveLength(0);

    await batalkan(client, tiket());
    await jadwalkanUlang(client, tiket({ status: "batal", transisi: ["dijadwalkan"] }));
    expect(panggilan.map((item) => bodyJson(item).status)).toEqual(["batal", "dijadwalkan"]);
  });

  it("daftarTiket meminta batal hanya bila diminta", async () => {
    const { client, panggilan } = clientPalsu(() => []);
    await daftarTiket(client);
    await daftarTiket(client, "batal");
    expect(panggilan.map((item) => item.params)).toEqual([{}, { status: "batal" }]);
  });
});

describe("kegagalan menjadi KlinikError", () => {
  it("TIKET_BERUBAH meminta muat ulang; kode lain tidak", async () => {
    const { client } = clientPalsu(() => galat(409, "TIKET_BERUBAH"));
    const kegagalan = await majukan(client, tiket()).catch((cause) => cause);
    expect(kegagalan).toBeInstanceOf(KlinikError);
    expect(kegagalan).toMatchObject({ code: "TIKET_BERUBAH", muatUlang: true, pesan: PESAN_KLINIK.TIKET_BERUBAH });
  });

  it("kode yang tak dikenal dan galat tanpa kode mendapat pesan generik", async () => {
    const { client } = clientPalsu(() => galat(500, "KODE_BARU_DI_SERVER"));
    expect(await majukan(client, tiket()).catch((cause) => cause)).toMatchObject({ code: "KODE_BARU_DI_SERVER", muatUlang: false, pesan: pesanKlinik(undefined) });
    const { client: putus } = clientPalsu(() => new TypeError("fetch failed"));
    expect(await simpanSesi(putus, tiket(), { catatan: "x" }).catch((cause) => cause)).toMatchObject({ code: "UNKNOWN", pesan: pesanKlinik(undefined) });
  });

  it("setiap kode yang bisa dikirim server klinik punya pesan (penjaga drift)", () => {
    const folder = fileURLToPath(new URL("../../../../services/directus/extensions/program/src/endpoints/klinik/", import.meta.url));
    const kode = new Set<string>();
    for (const berkas of readdirSync(folder).filter((nama) => nama.endsWith(".js"))) {
      const isi = readFileSync(`${folder}${berkas}`, "utf8");
      for (const cocok of isi.matchAll(/ProgramError\(\d+, "([A-Z_]+)"/g)) kode.add(cocok[1]!);
      // Alasan tanggal dikembalikan sebagai string oleh rules.js, lalu dilempar service.js.
      for (const cocok of isi.matchAll(/return "(TANGGAL_[A-Z_]+)"/g)) kode.add(cocok[1]!);
    }
    expect(kode.size).toBeGreaterThan(10);
    expect([...kode].filter((item) => !PESAN_KLINIK[item])).toEqual([]);
    // Kode captcha datang dari lib/captcha.js dan melewati endpoint klinik yang sama.
    expect(PESAN_KLINIK.CAPTCHA_INVALID).toBeTruthy();
  });
});

describe("modul publik", () => {
  it("prefillSaya menjawab null pada 401 dan melempar pada galat lain", async () => {
    expect(await prefillSaya(clientPalsu(() => galat(401, "AUTHENTICATION_REQUIRED")).client)).toBeNull();
    const data: KlinikPrefill = { usaha: null, kontak: { nama: "A", email: null, whatsapp: null } };
    expect(await prefillSaya(clientPalsu(() => data).client)).toEqual(data);
    await expect(prefillSaya(clientPalsu(() => galat(500, "INTERNAL_SERVER_ERROR")).client)).rejects.toBeInstanceOf(KlinikError);
  });

  it("lacakTiket: format salah dan 404 sama-sama null; nomor dinormalkan sebelum dikirim", async () => {
    const salahFormat = clientPalsu(() => tiket());
    expect(await lacakTiket(salahFormat.client, "KLN-1", "0812", "tkn")).toBeNull();
    expect(salahFormat.panggilan).toHaveLength(0);

    expect(await lacakTiket(clientPalsu(() => galat(404, "TIKET_TIDAK_DITEMUKAN")).client, "KLN-2026-09-0042", "0812", "tkn")).toBeNull();

    const ok = clientPalsu(() => ({ nomor: "KLN-2026-09-0042" }));
    expect(await lacakTiket(ok.client, " kln-2026-09-0042 ", " 0812 ", "tkn")).toEqual({ nomor: "KLN-2026-09-0042" });
    expect(ok.panggilan[0]).toMatchObject({ path: "/v1/program/klinik/tiket/lacak", method: "POST" });
    expect(bodyJson(ok.panggilan[0]!)).toEqual({ nomor: "KLN-2026-09-0042", whatsapp: "0812", captcha: "tkn" });

    await expect(lacakTiket(clientPalsu(() => galat(400, "CAPTCHA_INVALID")).client, "KLN-2026-09-0042", "0812", "x")).rejects.toMatchObject({ code: "CAPTCHA_INVALID" });
  });

  it("slotTersedia dan pesanTiket memakai route klinik; lampiran ikut sebagai multipart", async () => {
    const slot = clientPalsu(() => []);
    await slotTersedia(slot.client, 1, "2026-10-05");
    expect(slot.panggilan[0]).toMatchObject({ path: "/v1/program/klinik/slot", params: { poli: 1, tanggal: "2026-10-05" } });

    const form: FormTiket = {
      namaUsaha: "Warung Bu Siti",
      namaKontak: "Siti",
      whatsapp: "081234567890",
      email: null,
      poli: 1,
      deskripsi: "Butuh pendampingan PIRT untuk keripik",
      moda: "daring",
      tanggal: "2026-10-05",
      slot: "10:30",
      consent: true,
    };
    const kirim = clientPalsu(() => ({ nomor: "KLN-2026-09-0042" }));
    await pesanTiket(kirim.client, form, [new File(["%PDF-1.4"], "nib.pdf", { type: "application/pdf" })], "tkn");
    const terkirim = kirim.panggilan[0]!.body;
    expect(kirim.panggilan[0]).toMatchObject({ path: "/v1/program/klinik/tiket", method: "POST" });
    expect(terkirim).toBeInstanceOf(FormData);
    if (!(terkirim instanceof FormData)) return;
    expect(JSON.parse(String(terkirim.get("payload")))).toEqual(form);
    expect(terkirim.get("captcha")).toBe("tkn");
    expect(terkirim.getAll("lampiran").map((berkas) => (berkas instanceof File ? berkas.name : ""))).toEqual(["nib.pdf"]);
  });
});

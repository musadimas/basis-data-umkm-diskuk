import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KURASI_STATUS } from "../../app/constants/PROGRAM";
import {
  KURASI_ANTREAN,
  KURASI_TAHAP,
  KatalogError,
  PESAN_KATALOG,
  isTayang,
  katalogApi,
  kurasiLabel,
  tahapKurasiSelesai,
  type KatalogClient,
} from "../../app/lib/katalog";
import { PESAN_KPI, pesanKpi } from "../../app/lib/kpi";
import type { ProdukInput } from "../../app/types/program";

interface Panggilan {
  path: string;
  method: string;
  params?: Record<string, string | number | boolean>;
  body?: string | FormData;
}

interface Dicatat {
  path: string;
  method: string;
  params?: Panggilan["params"];
  body?: object;
}

type Jawaban = object | Error;

/** Client palsu: menjalankan command SDK untuk membaca isinya, lalu menjawab atau gagal. */
function clientPalsu(jawab: (panggilan: Dicatat) => Jawaban) {
  const panggilan: Dicatat[] = [];
  const request = async (command: () => Panggilan): Promise<Jawaban> => {
    const opsi = command();
    const isi: Dicatat = { path: opsi.path, method: opsi.method, params: opsi.params, body: opsi.body === undefined ? undefined : JSON.parse(String(opsi.body)) };
    panggilan.push(isi);
    const hasil = jawab(isi);
    if (hasil instanceof Error) throw hasil;
    return hasil;
  };
  // SAFETY: KatalogClient.request hanya dipanggil dengan command hasil endpoint(), yang bisa dijalankan tanpa argumen.
  const client: KatalogClient = { request: request as KatalogClient["request"] };
  return { client, panggilan };
}

const gagal = (code: string) => Object.assign(new Error("gagal"), { errors: [{ extensions: { code } }] });
// SAFETY: hanya `nama` yang dibaca stub; bidang lain tidak berpengaruh pada route yang diuji.
const PRODUK = { nama: "Keripik" } as ProdukInput;
const ID = "5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11";

describe("katalogApi", () => {
  it("memanggil route yang benar dan mengirim usaha saat membuat produk", async () => {
    const { client, panggilan } = clientPalsu(() => ({ id: "p1" }));
    const api = katalogApi(client);
    await api.produkUsaha(ID);
    await api.simpanProduk(ID, PRODUK);
    await api.simpanProduk(ID, PRODUK, "p1");
    await api.antreanKurasi("menunggu");
    expect(panggilan.map((item) => `${item.method} ${item.path}`)).toEqual([
      "GET /v1/program/katalog/produk",
      "POST /v1/program/katalog/produk",
      "PATCH /v1/program/katalog/produk/p1",
      "GET /v1/program/katalog/kurasi",
    ]);
    expect(panggilan[0]!.params).toEqual({ usaha: ID });
    expect(panggilan[1]!.body).toMatchObject({ usaha: ID, nama: "Keripik" });
    expect(panggilan[3]!.params).toEqual({ status: "menunggu" });
  });

  it("menolak penolakan tanpa catatan di klien tanpa memanggil server", async () => {
    const { client, panggilan } = clientPalsu(() => ({}));
    const api = katalogApi(client);
    await expect(api.putuskanKurasi("p1", "ditolak", "  ")).rejects.toMatchObject({ code: "CATATAN_WAJIB", pesan: PESAN_KATALOG.CATATAN_WAJIB });
    expect(panggilan).toHaveLength(0);
    await api.putuskanKurasi("p1", "tayang", "");
    expect(panggilan[0]!.body).toEqual({ keputusan: "tayang", catatan: null });
  });

  it("mengubah kegagalan server menjadi KatalogError dengan pesan dari satu peta", async () => {
    const { client } = clientPalsu(() => gagal("FOTO_TIDAK_VALID"));
    const kesalahan = await katalogApi(client).simpanProduk(ID, PRODUK).catch((error) => error);
    expect(kesalahan).toBeInstanceOf(KatalogError);
    expect(kesalahan).toMatchObject({ code: "FOTO_TIDAK_VALID", pesan: PESAN_KATALOG.FOTO_TIDAK_VALID });
  });

  it("kode tak dikenal dan kegagalan jaringan memakai pesan bawaan operasi", async () => {
    const { client } = clientPalsu(() => gagal("KODE_BARU"));
    await expect(katalogApi(client).daftarLoi()).rejects.toMatchObject({ code: "KODE_BARU", pesan: "Letter of Intent tidak dapat dimuat." });
    const offline = clientPalsu(() => new Error("Failed to fetch"));
    await expect(katalogApi(offline.client).cariUsaha("abc")).rejects.toMatchObject({ code: "UNKNOWN", pesan: "Usaha tidak dapat dicari. Coba lagi." });
  });

  it("kirimLoi menyertakan persetujuan, dan pesan INVALID_PAYLOAD khusus LOI", async () => {
    const { client, panggilan } = clientPalsu(() => ({ diterima: true, duplikat: false }));
    const input = { produk: ID, nama: "A", instansi: null, email: "a@x.id", telepon: null, jumlah: null, pesan: "Halo", clientUuid: ID, captcha: "tok" };
    await katalogApi(client).kirimLoi(input);
    expect(panggilan[0]).toMatchObject({ method: "POST", path: "/v1/program/katalog/loi", body: { ...input, persetujuanKontak: true } });
    const ditolak = clientPalsu(() => gagal("INVALID_PAYLOAD"));
    await expect(katalogApi(ditolak.client).kirimLoi(input)).rejects.toMatchObject({ pesan: expect.stringContaining("Letter of Intent") });
  });
});

describe("kurasi", () => {
  it("satu sumber label dan urutan", () => {
    expect(KURASI_ANTREAN).toEqual(Object.keys(KURASI_STATUS));
    expect(kurasiLabel("rekomendasi_marketplace")).toBe("Rekomendasi Marketplace");
    expect(isTayang("tayang")).toBe(true);
    expect(isTayang("rekomendasi_marketplace")).toBe(true);
    expect(isTayang("menunggu")).toBe(false);
    expect(isTayang("ditolak")).toBe(false);
  });

  it("tahap selesai mengikuti status; penolakan kembali ke tahap pertama", () => {
    expect(KURASI_TAHAP.filter((tahap) => tahapKurasiSelesai("tayang", tahap))).toEqual(["menunggu", "tayang"]);
    expect(KURASI_TAHAP.filter((tahap) => tahapKurasiSelesai("ditolak", tahap))).toEqual(["menunggu"]);
    expect(KURASI_TAHAP.filter((tahap) => tahapKurasiSelesai("rekomendasi_marketplace", tahap))).toEqual([...KURASI_TAHAP]);
  });
});

describe("kpi: peta pesan", () => {
  it("pesanKpi memetakan kode server dan jatuh ke pesan umum", () => {
    expect(pesanKpi("CLIENT_UUID_CONFLICT")).toBe(PESAN_KPI.CLIENT_UUID_CONFLICT);
    expect(pesanKpi("KODE_BARU")).toContain("ditolak server");
    expect(pesanKpi(undefined)).toContain("ditolak server");
  });
});

/** Semua `ProgramError(status, "KODE"` di sumber backend. */
function kodeServer(...berkas: string[]): string[] {
  const dasar = new URL("../../../../services/directus/extensions/program/src/", import.meta.url);
  const kode = new Set<string>();
  for (const nama of berkas) {
    for (const cocok of readFileSync(new URL(nama, dasar), "utf8").matchAll(/ProgramError\(\s*\d+,\s*"([A-Z_]+)"/g)) kode.add(cocok[1]!);
  }
  return [...kode].sort();
}

describe("tes penjaga drift: setiap kode server punya pesan di klien", () => {
  it("katalog (service, rules, captcha, validate)", () => {
    const kode = kodeServer("endpoints/katalog/service.js", "endpoints/katalog/rules.js", "lib/captcha.js", "lib/validate.js", "lib/access.js");
    expect(kode).toContain("CATATAN_WAJIB");
    expect(kode.filter((item) => !(item in PESAN_KATALOG))).toEqual([]);
  });

  it("kpi (service dan akses)", () => {
    const kode = kodeServer("endpoints/kpi/service.js", "lib/access.js", "lib/validate.js");
    expect(kode).toContain("LAPORAN_SUDAH_ADA");
    expect(kode.filter((item) => !(item in PESAN_KPI))).toEqual([]);
  });
});

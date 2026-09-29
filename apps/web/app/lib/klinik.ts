/**
 * Klien klinik konsultasi: satu-satunya tempat yang mengenal `/v1/program/klinik/*` (Kandidat 06).
 *
 * Halaman tidak memanggil `endpoint()` untuk klinik dan tidak menyalin aturan server. Aturan tahap
 * datang dari server sebagai `tiket.transisi` (status berikutnya yang boleh untuk petugas ini) dan
 * `tiket.statusLabel`; `versi` tiket selalu dikirim balik pada setiap tulis. Setiap kegagalan menjadi
 * `KlinikError`, dengan satu peta pesan untuk semua kode server.
 */
import { endpoint, endpointForm } from "~/lib/directus";
import { requestErrorCode, requestStatus } from "~/lib/request-error";
import type { RuntimeLabelMap } from "~/types/directus";
import type {
  KlinikAspek,
  KlinikPoli,
  KlinikPrefill,
  KlinikPrioritas,
  KlinikRujukan,
  KlinikSlot,
  KlinikStatus,
  KlinikTiket,
  KlinikTiketDibuat,
  KlinikTiketLacak,
} from "~/types/program";

/** Yang dipakai module dari client Directus; client palsu di tes cukup menyediakan `request`. */
export type KlinikClient = Pick<ReturnType<typeof useDirectus>, "request">;

export const MAX_LAMPIRAN = 3;
export const MAX_LAMPIRAN_MB = 5;

/** Format nomor tiket server (`KLN-YYYY-MM-NNNN`); nomor lain tidak pernah cocok dengan tiket mana pun. */
export const FORMAT_NOMOR_TIKET = /^KLN-\d{4}-\d{2}-\d{4,}$/;

const PESAN_UMUM = "Terjadi kendala pada klinik konsultasi. Coba lagi.";

/** Satu pesan per kode error server (klinik, captcha, dan kode umum endpoint program). */
export const PESAN_KLINIK: RuntimeLabelMap = {
  INVALID_PAYLOAD: "Periksa kembali isian Anda.",
  POLI_TIDAK_VALID: "Pilih poli konsultasi yang tersedia.",
  TANGGAL_TIDAK_VALID: "Format tanggal tidak valid.",
  TANGGAL_DI_LUAR_RENTANG: "Pilih tanggal mulai besok hingga 30 hari ke depan.",
  TANGGAL_AKHIR_PEKAN: "Konsultasi hanya tersedia Senin–Jumat.",
  SLOT_PENUH: "Slot ini baru saja dipesan orang lain atau sudah diambil tiket lain. Pilih jadwal lain.",
  LAMPIRAN_TIDAK_DIDUKUNG: "Lampiran harus berupa PDF, JPG, PNG, atau WebP.",
  LAMPIRAN_TERLALU_BESAR: `Setiap lampiran maksimal ${MAX_LAMPIRAN_MB} MB.`,
  LAMPIRAN_TERLALU_BANYAK: `Maksimal ${MAX_LAMPIRAN} lampiran.`,
  LAMPIRAN_TIDAK_DITEMUKAN: "Lampiran tidak ditemukan.",
  CAPTCHA_INVALID: "Captcha kedaluwarsa. Centang ulang lalu coba lagi.",
  CAPTCHA_NOT_CONFIGURED: "Verifikasi captcha belum tersedia. Coba lagi nanti.",
  TIKET_TIDAK_DITEMUKAN: "Tiket tidak ditemukan.",
  TIKET_BERUBAH: "Tiket ini sudah diubah petugas lain setelah Anda membukanya. Daftar dimuat ulang; buka kembali tiketnya.",
  TRANSISI_TIDAK_VALID: "Perpindahan status itu tidak diizinkan. Tiket harus melewati tahap berikutnya.",
  BUKAN_PENUGASAN_ANDA: "Tiket ini bukan penugasan Anda.",
  KOTA_NOT_ASSIGNED: "Akun kab/kota Anda belum memiliki penugasan kota.",
  FORBIDDEN: "Akun ini tidak dapat mengakses klinik konsultasi.",
  AUTHENTICATION_REQUIRED: "Masuk terlebih dahulu.",
  RECEIPT_NOT_CONFIGURED: "Penerimaan status pesan belum dikonfigurasi.",
};

/** Kegagalan klinik: `code` dari server (atau `UNKNOWN`), `pesan` siap tampil, `muatUlang` bila daftar harus dimuat ulang. */
export class KlinikError extends Error {
  readonly code: string;
  readonly pesan: string;
  readonly muatUlang: boolean;

  constructor(code: string, pesan: string, muatUlang: boolean) {
    super(`${code}: ${pesan}`);
    this.name = "KlinikError";
    this.code = code;
    this.pesan = pesan;
    this.muatUlang = muatUlang;
  }
}

export const pesanKlinik = (code: string | undefined) => (code && PESAN_KLINIK[code]) || PESAN_UMUM;

function keKlinikError<E>(cause: E): KlinikError {
  if (cause instanceof KlinikError) return cause;
  const code = requestErrorCode(cause) ?? "UNKNOWN";
  return new KlinikError(code, pesanKlinik(code), code === "TIKET_BERUBAH");
}

/** Menjalankan satu panggilan endpoint dan mengubah semua kegagalannya menjadi `KlinikError`. */
async function jalankan<T>(panggil: () => Promise<T>): Promise<T> {
  try {
    return await panggil();
  } catch (cause) {
    throw keKlinikError(cause);
  }
}

// ── Publik ──────────────────────────────────────────────────────────────────

export function daftarPoli(client: KlinikClient): Promise<KlinikPoli[]> {
  return jalankan(() => client.request(endpoint<KlinikPoli[]>("/v1/program/klinik/poli")));
}

export function slotTersedia(client: KlinikClient, poli: number, tanggal: string): Promise<KlinikSlot[]> {
  return jalankan(() => client.request(endpoint<KlinikSlot[]>("/v1/program/klinik/slot", { query: { poli, tanggal } })));
}

/** Prefill dari akun yang masuk; `null` bila tidak ada sesi (401). */
export async function prefillSaya(client: KlinikClient): Promise<KlinikPrefill | null> {
  try {
    return await client.request(endpoint<KlinikPrefill>("/v1/program/klinik/prefill"));
  } catch (cause) {
    if (requestStatus(cause) === 401) return null;
    throw keKlinikError(cause);
  }
}

/** Isian formulir pemesanan; `usaha` kosong berarti usaha diambil dari sesi (SIDT). */
export interface FormTiket {
  namaUsaha: string | null;
  namaKontak: string;
  whatsapp: string;
  email: string | null;
  poli: number;
  deskripsi: string;
  moda: "daring" | "luring";
  tanggal: string;
  slot: string;
  consent: boolean;
}

export function pesanTiket(client: KlinikClient, form: FormTiket, lampiran: File[], captcha: string): Promise<KlinikTiketDibuat> {
  const body = new FormData();
  body.append("payload", JSON.stringify(form));
  body.append("captcha", captcha);
  for (const file of lampiran) body.append("lampiran", file, file.name);
  return jalankan(() => client.request(endpointForm<KlinikTiketDibuat>("/v1/program/klinik/tiket", body)));
}

/**
 * Baca ulang tiket dengan nomor + WhatsApp. Nomor yang salah format dan tiket yang tidak cocok sama-sama
 * `null` (server pun menjawab 404 untuk keduanya), sehingga tidak ada oracle keberadaan tiket.
 */
export async function lacakTiket(client: KlinikClient, nomor: string, whatsapp: string, captcha: string): Promise<KlinikTiketLacak | null> {
  const nomorBersih = nomor.trim().toUpperCase();
  if (!FORMAT_NOMOR_TIKET.test(nomorBersih)) return null;
  try {
    return await client.request(
      endpoint<KlinikTiketLacak, { nomor: string; whatsapp: string; captcha: string }>("/v1/program/klinik/tiket/lacak", {
        method: "POST",
        body: { nomor: nomorBersih, whatsapp: whatsapp.trim(), captcha },
      }),
    );
  } catch (cause) {
    if (requestErrorCode(cause) === "TIKET_TIDAK_DITEMUKAN") return null;
    throw keKlinikError(cause);
  }
}

// ── Petugas ─────────────────────────────────────────────────────────────────

/** Kolom tiket yang boleh dikirim petugas lewat PATCH; `versi` ditambahkan module ini, bukan halaman. */
export interface SesiTiket {
  status?: KlinikStatus;
  prioritas?: KlinikPrioritas;
  linkMeet?: string | null;
  diagnosis?: Partial<Record<KlinikAspek, string | null>>;
  actionPlan?: string | null;
  rujukan?: KlinikRujukan[];
  catatan?: string | null;
  pendamping?: string;
}

/** Tiket dalam cakupan petugas; tiket batal hanya muncul bila diminta lewat `status: "batal"`. */
export function daftarTiket(client: KlinikClient, status?: KlinikStatus): Promise<KlinikTiket[]> {
  return jalankan(() => client.request(endpoint<KlinikTiket[]>("/v1/program/klinik/tiket", { query: { status } })));
}

function ubah(client: KlinikClient, tiket: KlinikTiket, patch: SesiTiket): Promise<KlinikTiket> {
  return jalankan(() =>
    client.request(
      endpoint<KlinikTiket, SesiTiket & { versi: string }>(`/v1/program/klinik/tiket/${tiket.id}`, {
        method: "PATCH",
        body: { ...patch, versi: tiket.versi },
      }),
    ),
  );
}

/** Tiket dari kolam tanpa penugasan menjadi milik `petugasId`; klaim harus menjadi tulis pertamanya. */
export const klaim = (client: KlinikClient, tiket: KlinikTiket, petugasId: string) => ubah(client, tiket, { pendamping: petugasId });

export const simpanSesi = (client: KlinikClient, tiket: KlinikTiket, sesi: SesiTiket) => ubah(client, tiket, sesi);

/** Tahap berikutnya menurut server (`tiket.transisi`), selain pembatalan; `null` bila tidak ada. */
export function tahapBerikutnya(tiket: KlinikTiket): KlinikStatus | null {
  return tiket.transisi.find((status) => status !== "batal") ?? null;
}

/** Memajukan satu tahap; `null` (tanpa request) bila server tidak menawarkan tahap berikutnya. */
export async function majukan(client: KlinikClient, tiket: KlinikTiket): Promise<KlinikTiket | null> {
  const status = tahapBerikutnya(tiket);
  return status ? ubah(client, tiket, { status }) : null;
}

/** Membatalkan; `null` (tanpa request) bila server tidak mengizinkan tiket ini dibatalkan. */
export async function batalkan(client: KlinikClient, tiket: KlinikTiket): Promise<KlinikTiket | null> {
  return tiket.transisi.includes("batal") ? ubah(client, tiket, { status: "batal" }) : null;
}

/** Tiket batal kembali ke kalender; `null` (tanpa request) bila server tidak menawarkannya. */
export async function jadwalkanUlang(client: KlinikClient, tiket: KlinikTiket): Promise<KlinikTiket | null> {
  return tiket.status === "batal" && tiket.transisi.includes("dijadwalkan") ? ubah(client, tiket, { status: "dijadwalkan" }) : null;
}

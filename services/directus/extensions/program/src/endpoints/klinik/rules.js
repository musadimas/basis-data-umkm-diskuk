/** Klinik scheduling rules (Brief Fitur Modul 7.3). Pure functions for unit tests. */
import { jakartaDate } from "../kpi/rules.js";
import { normalisasiTeleponSeluler } from "../../lib/validate.js";

export const SLOTS = ["09:00", "10:30", "13:00", "14:30"];
export const MAX_HARI_KE_DEPAN = 30;
export const STATUS = ["masuk", "dijadwalkan", "berjalan", "tindak_lanjut", "selesai", "batal"];
export const PRIORITAS = ["normal", "tinggi", "mendesak"];
export const RUJUKAN = ["sarpras", "vokasi", "mediasi_sapa", "talent_lab"];
export const ASPEK_DIAGNOSIS = ["legalitas", "keuangan", "pemasaran", "produksi", "sdm"];

const DAY = 86_400_000;

/** Kanban order: Tiket Masuk → Jadwal Ditetapkan → Sesi Berjalan → Tindak Lanjut → Selesai. */
export const TRANSISI = {
  masuk: ["dijadwalkan", "batal"],
  dijadwalkan: ["berjalan", "batal"],
  berjalan: ["tindak_lanjut", "batal"],
  tindak_lanjut: ["selesai", "batal"],
  selesai: [],
  // A cancelled ticket may be put back on the calendar; the slot unique index rejects the move
  // when another ticket took the slot meanwhile.
  batal: ["dijadwalkan"],
};

/** True when `dari` may become `ke`. Re-sending the same status is always allowed. */
export function transisiSah(dari, ke) {
  return dari === ke || (TRANSISI[dari] ?? []).includes(ke);
}

/** Status label as the kanban shows it (the DTO's `statusLabel`); an unknown code stays as it is. */
const LABEL_KANBAN = {
  masuk: "Tiket Masuk",
  dijadwalkan: "Jadwal Ditetapkan",
  berjalan: "Sesi Berjalan",
  tindak_lanjut: "Tindak Lanjut",
  selesai: "Selesai",
  batal: "Dibatalkan",
};
export const statusLabel = (status) => LABEL_KANBAN[status] ?? String(status);

/** Same shape as PostgreSQL `to_char(date_updated, …)`, which is what `versi` carries. */
export const VERSI = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export const AKSI_AUDIT = ["transisi", "penugasan", "catatan"];
/** Update columns that belong to each audit kind; other columns are not a decision of their own. */
const KATEGORI = {
  transisi: ["status"],
  penugasan: ["pendamping"],
  catatan: ["prioritas", "link_meet", "action_plan", "catatan", "diagnosis", "rujukan"],
};

/**
 * The audit rows of one accepted change: one per kind of change, in AKSI_AUDIT order. Re-sending the
 * current status is not a transition, so only the other columns are recorded then.
 */
export function barisAudit({ statusDari, statusKe, perubahan }) {
  const rows = [];
  for (const aksi of AKSI_AUDIT) {
    if (aksi === "transisi" && statusDari === statusKe) continue;
    const berubah = KATEGORI[aksi].filter((kolom) => kolom in perubahan);
    if (!berubah.length) continue;
    rows.push({
      aksi,
      statusDari: aksi === "transisi" ? statusDari : null,
      statusKe: aksi === "transisi" ? statusKe : null,
      perubahan: berubah,
    });
  }
  return rows;
}

/**
 * JS twin of the SQL scope `cakupanPetugas` (penugasan.js): whether the ticket is on this pemanggil's
 * kanban. `tiket` carries `pendamping` and `kotaId` (the business' kota, null when typed by hand).
 */
export function dalamCakupan(pemanggil, tiket) {
  if (pemanggil?.admin || pemanggil?.peran === "provinsi") return true;
  if (pemanggil?.peran === "kabkota") {
    return Boolean(pemanggil.kotaId) && tiket.kotaId !== null && tiket.kotaId !== undefined && Number(tiket.kotaId) === Number(pemanggil.kotaId);
  }
  if (pemanggil?.peran === "pendamping") return tiket.pendamping === pemanggil.id || tiket.pendamping === null || tiket.pendamping === undefined;
  return false;
}

/**
 * Whether this PATCH may touch this ticket. `tiket` is the locked row with `pendamping`, `status`
 * and `kotaId` (the business' kota, NULL when the applicant typed the name by hand).
 */
export function bolehUbah(pemanggil, tiket, update) {
  if (pemanggil?.admin || pemanggil?.peran === "provinsi") return true;
  if (pemanggil?.peran === "pendamping") {
    if (tiket.pendamping === pemanggil.id) return true;
    return tiket.pendamping === null && update.pendamping === pemanggil.id;
  }
  if (pemanggil?.peran === "kabkota") {
    return tiket.kotaId !== null && tiket.kotaId !== undefined && Number(tiket.kotaId) === Number(pemanggil.kotaId);
  }
  return false;
}

/** Statuses this pemanggil may move the ticket to right now: the server's answer to "what can I press". */
export function transisiUntuk(pemanggil, tiket) {
  if (!dalamCakupan(pemanggil, tiket)) return [];
  return (TRANSISI[tiket.status] ?? []).filter((ke) => bolehUbah(pemanggil, tiket, { status: ke }));
}

/**
 * A consultation can be booked on a weekday from tomorrow up to 30 days ahead (Jakarta dates).
 * Returns null when valid, else a reason code.
 */
export function tanggalTidakValid(tanggal, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tanggal))) return "TANGGAL_TIDAK_VALID";
  const target = Date.parse(`${tanggal}T00:00:00Z`);
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 10) !== tanggal) return "TANGGAL_TIDAK_VALID";
  const today = Date.parse(`${jakartaDate(now)}T00:00:00Z`);
  if (target <= today || target > today + MAX_HARI_KE_DEPAN * DAY) return "TANGGAL_DI_LUAR_RENTANG";
  const weekday = new Date(target).getUTCDay();
  if (weekday === 0 || weekday === 6) return "TANGGAL_AKHIR_PEKAN";
  return null;
}

export const HARI = ["senin", "selasa", "rabu", "kamis", "jumat"];
export const AFILIASI = ["plut", "dinas", "praktisi"];
export const LABEL_AFILIASI = { plut: "PLUT", dinas: "Dinas", praktisi: "Praktisi" };
/** Berapa hari ke depan direktori menghitung ketersediaan bila klien tidak meminta lain. */
export const HORIZON_DIREKTORI = 14;

/** Nama hari kerja (senin…jumat) dari tanggal Jakarta YYYY-MM-DD; null pada akhir pekan. */
export const namaHari = (tanggal) => HARI[new Date(`${tanggal}T00:00:00Z`).getUTCDay() - 1] ?? null;

/** Tanggal yang bisa dipesan dalam `hari` hari ke depan: memakai aturan `tanggalTidakValid` yang sama dengan pemesanan. */
export function tanggalDapatDipesan(now = new Date(), hari = HORIZON_DIREKTORI) {
  const today = Date.parse(`${jakartaDate(now)}T00:00:00Z`);
  const batas = Math.min(Math.max(hari, 1), MAX_HARI_KE_DEPAN);
  const hasil = [];
  for (let ke = 1; ke <= batas; ke += 1) {
    const tanggal = new Date(today + ke * DAY).toISOString().slice(0, 10);
    if (tanggalTidakValid(tanggal, now) === null) hasil.push(tanggal);
  }
  return hasil;
}

/**
 * Slot bebas satu konsultan per tanggal. Sebuah slot bebas bila konsultan melayaninya menurut jadwal
 * mingguan, slot poli-nya belum dipesan tiket aktif, dan (bila konsultan juga akun pendamping) pendamping
 * itu tidak memegang tiket aktif lain pada tanggal+slot yang sama. `terpakaiPoli` berisi `poli|tanggal|slot`,
 * `terpakaiPendamping` berisi `pendamping|tanggal|slot`.
 */
export function ketersediaanKonsultan(konsultan, tanggalList, { terpakaiPoli, terpakaiPendamping }) {
  const hariKerja = new Set(konsultan.hari);
  const dilayani = SLOTS.filter((slot) => konsultan.slot.includes(slot));
  const hasil = [];
  for (const tanggal of tanggalList) {
    if (!hariKerja.has(namaHari(tanggal))) continue;
    const bebas = dilayani.filter(
      (slot) =>
        !terpakaiPoli.has(`${konsultan.poli}|${tanggal}|${slot}`) &&
        !(konsultan.pendamping && terpakaiPendamping.has(`${konsultan.pendamping}|${tanggal}|${slot}`)),
    );
    if (bebas.length) hasil.push({ tanggal, slot: bebas });
  }
  return hasil;
}

/** Kolom JSONB jadwal dari DB → hanya nilai yang dikenal, supaya baris yang diedit tangan tidak merusak DTO. */
export const nilaiDikenal = (nilai, daftar) => (Array.isArray(nilai) ? daftar.filter((item) => nilai.includes(item)) : []);

/** Atribut Jabar yang boleh menjadi outcome (sama dengan 15 kolom `usaha_atribut_jabar`; dijaga contract test). */
export const ATRIBUT_OUTCOME = {
  npwp_usaha: "NPWP Usaha",
  izin_edar: "Izin Edar",
  sertifikat_halal: "Sertifikat Halal",
  pirt_bpom: "PIRT/BPOM",
  hki_merek: "HKI/Merek",
  sni: "SNI",
  rekening_terpisah: "Rekening Usaha Terpisah",
  sop_tertulis: "SOP Tertulis",
  ecommerce: "Pemanfaatan E-commerce",
  medsos_bisnis: "Media Sosial Bisnis",
  qris: "QRIS",
  pembukuan_digital: "Pembukuan Digital",
  akses_kur: "Akses KUR/Perbankan",
  rantai_pasok_industri: "Rantai Pasok Industri",
  kontrak_offtaker: "Kontrak Offtaker",
};
export const JENIS_OUTCOME = ["kepatuhan", "perbaikan"];
export const STATUS_OUTCOME = ["diajukan", "terverifikasi", "dicabut"];
export const LABEL_STATUS_OUTCOME = { diajukan: "Menunggu verifikasi", terverifikasi: "Terverifikasi", dicabut: "Dicabut" };

/** Sidik jari isi outcome (urut atribut) — dua permintaan dengan isi sama adalah retry, bukan outcome baru. */
export const sidikOutcome = (items) =>
  [...items].sort((a, b) => a.atribut.localeCompare(b.atribut)).map((item) => `${item.atribut}:${item.jenis}`).join(",");

/** Verifikator outcome: provinsi/admin, atau kab/kota yang wilayahnya memuat usaha tiketnya. */
export function bolehVerifikasiOutcome(pemanggil, kotaId) {
  if (pemanggil?.admin || pemanggil?.peran === "provinsi") return true;
  if (pemanggil?.peran === "kabkota") {
    return pemanggil.kotaId != null && kotaId !== null && kotaId !== undefined && Number(kotaId) === Number(pemanggil.kotaId);
  }
  return false;
}

/**
 * Aksi yang boleh ditekan pemanggil pada outcome ini: jawaban server atas "tombol apa yang tampil".
 * `verifikasi` menuntut aktor berbeda dari pengaju; koreksi/cabut adalah hak verifikator dan selalu beralasan.
 */
export function aksiOutcomeUntuk(pemanggil, outcome, kotaId) {
  if (outcome.status === "dicabut" || !bolehVerifikasiOutcome(pemanggil, kotaId)) return [];
  const aksi = [];
  if (outcome.status === "diajukan" && outcome.diajukanOleh !== pemanggil.id) aksi.push("verifikasi");
  aksi.push("koreksi", "cabut");
  return aksi;
}

/** A well-formed ticket number; anything else can never match a ticket. */
export const NOMOR_TIKET = /^KLN-\d{4}-\d{2}-\d{4,}$/;

/** Ticket number KLN-YYYY-MM-NNNN (Jakarta month); the counter keeps growing past 9999. */
export function nomorTiket(sequence, now = new Date()) {
  const [year, month] = jakartaDate(now).split("-");
  return `KLN-${year}-${month}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Accepts the numbers the form allows (08xxx / +628xxx / 628xxx) and returns the wa.me form
 * (62xxxxxxxxx), or null when the number is not a valid Indonesian mobile number.
 * Thin wrapper over the shared rule so the three phone validations stay identical (B33).
 */
export function normalisasiTelepon(value) {
  return normalisasiTeleponSeluler(value);
}

export const TEMPLATE_TIKET_DIBUAT = "klinik_tiket_dibuat";
export const TEMPLATE_STATUS_BERUBAH = "klinik_status_berubah";
export const LABEL_MODA = { daring: "daring (video call)", luring: "tatap muka" };
const LABEL_STATUS = {
  masuk: "tiket masuk",
  dijadwalkan: "jadwal ditetapkan",
  berjalan: "sesi berjalan",
  tindak_lanjut: "tindak lanjut rekomendasi",
  selesai: "selesai",
  batal: "dibatalkan",
};

/** WhatsApp message text and template for a freshly booked ticket. */
export function pesanTiket(tiket) {
  const params = {
    nomor: tiket.nomor,
    poli: tiket.poli_nama ?? tiket.poli ?? "",
    tanggal: tiket.jadwal_tanggal ?? tiket.tanggal ?? "",
    slot: tiket.jadwal_slot ?? tiket.slot ?? "",
    moda: LABEL_MODA[tiket.moda] ?? tiket.moda,
  };
  return {
    template: TEMPLATE_TIKET_DIBUAT,
    payload: {
      params,
      text: `Tiket konsultasi ${params.nomor} untuk ${params.poli} pada ${params.tanggal} pukul ${params.slot} WIB (${params.moda}) sudah kami terima. Pendamping DISKUK akan mengonfirmasi jadwal melalui pesan ini.`,
    },
  };
}

/** WhatsApp message text and template for a kanban status change. */
export function pesanStatusBerubah(tiket, status) {
  const params = { nomor: tiket.nomor, status, label: LABEL_STATUS[status] ?? status };
  return {
    template: TEMPLATE_STATUS_BERUBAH,
    payload: {
      params,
      text: `Tiket konsultasi ${params.nomor} kini berstatus: ${params.label}.`,
    },
  };
}

/** Pembatalan tiket memakai template status berubah yang sudah ada (tanpa template provider baru). */
export function pesanPembatalan(tiket) {
  const params = { nomor: tiket.nomor, status: "batal", label: LABEL_STATUS.batal };
  return {
    template: TEMPLATE_STATUS_BERUBAH,
    payload: {
      params,
      text: `Tiket konsultasi ${params.nomor} telah dibatalkan. Anda dapat mendaftar kembali kapan saja melalui halaman Klinik Konsultasi.`,
    },
  };
}

/**
 * Satu pesan per tiket, jenis, status tujuan dan versi tiket (B15): tiket yang dibatalkan, dijadwalkan
 * ulang, lalu dibatalkan lagi mendapat pesannya sendiri. Request yang diulang tetap aman karena
 * `assertVersi` menjawab 409 sebelum pesan diantrekan.
 */
export function kunciPesan(tiket, jenis, status, versi) {
  const dasar = jenis === "status_berubah" ? `${jenis}:${tiket}:${status}` : `${jenis}:${tiket}`;
  return versi ? `${dasar}:${versi}` : dasar;
}

/** First bytes of the accepted attachment types; the declared MIME type alone is not trusted. */
export function sniffType(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

// Pure rules for internal event registration (R03/N7-01…N7-02). Kept free of
// the database so eligibility, quota races, attendance math and the verified
// certificate threshold can be tested directly.
import { ProgramError } from "../../lib/utils/http.js";

export const STATUS_PENDAFTARAN = ["menunggu", "diterima", "ditolak", "daftar_tunggu", "batal"];
export const STATUS_AKTIF = ["menunggu", "diterima", "daftar_tunggu"];
export const KEPUTUSAN = ["diterima", "ditolak", "daftar_tunggu", "batal"];
export const AMBANG_HADIR_PERSEN = 80;

export function cocokSkala(syaratSkala, skalaUsaha) {
  if (syaratSkala === null || syaratSkala === undefined || String(syaratSkala).trim() === "") return true;
  const daftar = String(syaratSkala).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!daftar.length) return true;
  if (!skalaUsaha) return false;
  const skala = String(skalaUsaha).trim().toLowerCase();
  const alias = { micro: ["micro", "mikro"], small: ["small", "kecil"], medium: ["medium", "menengah"] };
  return daftar.some((syarat) => syarat === skala || (alias[skala] ?? []).includes(syarat));
}

export function cocokWilayah(syaratWilayah, kotaNama) {
  if (syaratWilayah === null || syaratWilayah === undefined || String(syaratWilayah).trim() === "") return true;
  if (!kotaNama) return false;
  const syarat = String(syaratWilayah).trim().toLowerCase();
  if (syarat === "jawa barat") return true;
  return String(kotaNama).trim().toLowerCase().includes(syarat) || syarat.includes(String(kotaNama).trim().toLowerCase());
}

/** Server-side eligibility of one business for one internal event. */
export function cekEligibilitas(event, usaha) {
  if (!event?.pendaftaran_internal) return { boleh: false, alasan: "pendaftaran_internal_tidak_dibuka" };
  if (event?.status_publikasi && event.status_publikasi !== "terbit") return { boleh: false, alasan: "kegiatan_tidak_terbit" };
  if (event?.syarat_nib && !usaha?.nib) return { boleh: false, alasan: "wajib_nib" };
  if (!cocokSkala(event?.syarat_skala, usaha?.skala)) return { boleh: false, alasan: "skala_tidak_memenuhi" };
  if (!cocokWilayah(event?.syarat_wilayah, usaha?.kota)) return { boleh: false, alasan: "wilayah_tidak_memenuhi" };
  return { boleh: true, alasan: null };
}

export function butuhPakta(event, pakta) {
  if (event?.butuh_pakta_integritas && pakta !== true) {
    throw new ProgramError(400, "PAKTA_WAJIB", "Pakta integritas Non-ASN/TNI/Polri wajib dicentang untuk kegiatan ini.");
  }
}

/** Attendance share in percent, one decimal. No presence rows means 0. */
export function persenHadir(jumlahSesi, hadir) {
  const total = Number(jumlahSesi) || 0;
  if (total <= 0) return 0;
  return Math.round((Number(hadir) / total) * 1000) / 10;
}

/** 79.9 stays below the gate: strictly >= 80 plus a finished task. */
export function layakSertifikat({ jumlahSesi, hadir, tugasSelesai, butuhTugas = true }) {
  if (butuhTugas && !tugasSelesai) return false;
  return persenHadir(jumlahSesi, hadir) >= AMBANG_HADIR_PERSEN;
}

/** E-pass QR payload: token + event binding so codes never cross participants. */
export function epassPayload({ token, kegiatanId, pendaftaranId }) {
  return `DISKUK-EPASS:${kegiatanId}:${pendaftaranId}:${token}`;
}

export function sertifikatKode() {
  const abjad = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  let kode = "SK";
  for (let i = 0; i < 10; i += 1) kode += abjad[Math.floor(Math.random() * abjad.length)];
  return kode;
}

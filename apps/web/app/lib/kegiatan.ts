/** Public agenda helpers for /kegiatan (Brief Fitur Modul 7.2 — Y07/M7-07…M7-10). */
import type { QueryValueMap, UrlQuery } from "~/types/directus";
import type {
  KegiatanAgenda,
  KegiatanFilters,
  KategoriKegiatan,
  MetodeKegiatan,
  StatusKegiatanAgenda,
  TindakanKegiatan,
} from "~/types/program";

export const KATEGORI_KEGIATAN = {
  pelatihan: { label: "Pelatihan/Bimtek", dot: "bg-blue-600", className: "bg-blue-100 text-blue-800" },
  sertifikasi: { label: "Sertifikasi", dot: "bg-emerald-600", className: "bg-emerald-100 text-emerald-800" },
  pameran: { label: "Pameran", dot: "bg-purple-600", className: "bg-purple-100 text-purple-800" },
  akselerasi: { label: "Akselerasi UMKM Talent", dot: "bg-rose-600", className: "bg-rose-100 text-rose-800" },
  literasi_digital: { label: "Literasi Digital/PMSE", dot: "bg-amber-500", className: "bg-amber-100 text-amber-900" },
} satisfies Record<KategoriKegiatan, { label: string; dot: string; className: string }>;

export const METODE_LABEL = { luring: "Luring", daring: "Daring", hybrid: "Hybrid" } satisfies Record<MetodeKegiatan, string>;

export const STATUS_KEGIATAN = {
  berjalan: { label: "Sedang Berjalan", className: "bg-emerald-100 text-emerald-800" },
  pendaftaran: { label: "Pendaftaran Dibuka", className: "bg-sky-100 text-sky-800" },
  segera: { label: "Segera Datang", className: "bg-amber-100 text-amber-900" },
  selesai: { label: "Selesai & Dokumentasi", className: "bg-slate-200 text-slate-700" },
} satisfies Record<StatusKegiatanAgenda, { label: string; className: string }>;

/** Timeline order of the four status groups. */
export const STATUS_URUT: StatusKegiatanAgenda[] = ["berjalan", "pendaftaran", "segera", "selesai"];

export const KATEGORI_VALUES =
  // SAFETY: kunci objek literal KATEGORI_KEGIATAN adalah seluruh anggota KategoriKegiatan (dijaga `satisfies`).
  Object.keys(KATEGORI_KEGIATAN) as KategoriKegiatan[];
export const METODE_VALUES =
  // SAFETY: kunci objek literal METODE_LABEL adalah seluruh anggota MetodeKegiatan (dijaga `satisfies`).
  Object.keys(METODE_LABEL) as MetodeKegiatan[];

export const FILTER_KOSONG: KegiatanFilters = { kategori: "", penyelenggara: "", metode: "", ramah: false };

const rentang = (value: string | Date) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));

/** Event window in WIB, e.g. "10 Okt 2026, 09.00 – 12 Okt 2026, 16.00 WIB". */
export function waktuKegiatan(item: Pick<KegiatanAgenda, "tanggalMulai" | "tanggalSelesai">): string {
  return `${rentang(item.tanggalMulai)} – ${rentang(item.tanggalSelesai)} WIB`;
}

export function tanggalPendek(value: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export function batasRegistrasiTeks(item: Pick<KegiatanAgenda, "batasRegistrasi">): string | null {
  return item.batasRegistrasi ? `Batas registrasi ${rentang(item.batasRegistrasi)} WIB` : null;
}

/** "Sisa 12 dari 50 kuota" / "Kuota penuh" / null when the event does not cap its quota. */
export function sisaKuotaTeks(item: Pick<KegiatanAgenda, "kuota" | "sisaKuota" | "terisi">): string | null {
  if (item.kuota === null || item.sisaKuota === null) return null;
  return item.sisaKuota === 0 ? "Kuota penuh" : `Sisa ${item.sisaKuota} dari ${item.kuota} kuota`;
}

/** Calendar day in Asia/Jakarta as YYYY-MM-DD. */
export function hariJakarta(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export function hariIniJakarta(): string {
  return hariJakarta(new Date());
}

/** Weeks (Monday first) covering a month (1 = January); days outside the month are null. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** Events that take place on a calendar day (Jakarta time), including multi-day events. */
export function kegiatanPadaHari(list: KegiatanAgenda[], day: string): KegiatanAgenda[] {
  return list.filter((item) => hariJakarta(item.tanggalMulai) <= day && day <= hariJakarta(item.tanggalSelesai));
}

/** Label of one WIB month, for the calendar header. */
export function labelBulan(tahun: number, bulan: number): string {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(tahun, bulan - 1, 1)));
}

/** Query the API understands (and that makes the view shareable); only non-default values. */
export function queryKegiatan(filters: KegiatanFilters, bulan: { tahun: number; bulan: number } | null = null): UrlQuery {
  const query: UrlQuery = {};
  if (filters.kategori) query.kategori = filters.kategori;
  if (filters.penyelenggara) query.penyelenggara = filters.penyelenggara;
  if (filters.metode) query.metode = filters.metode;
  if (filters.ramah) query.ramah = "1";
  if (bulan) {
    query.bulan = String(bulan.bulan);
    query.tahun = String(bulan.tahun);
  }
  return query;
}

/** Hydrates the filter object from a (possibly hand-edited) URL query. */
export function filterDariQuery(query: QueryValueMap): KegiatanFilters {
  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const kategori = String(one("kategori") ?? "");
  const metode = String(one("metode") ?? "");
  const ramah = one("ramah");
  const kategoriDikenal = (value: string): value is KategoriKegiatan => KATEGORI_VALUES.some((item) => item === value);
  const metodeDikenal = (value: string): value is MetodeKegiatan => METODE_VALUES.some((item) => item === value);
  return {
    kategori: kategoriDikenal(kategori) ? kategori : "",
    penyelenggara: String(one("penyelenggara") ?? "").slice(0, 160),
    metode: metodeDikenal(metode) ? metode : "",
    ramah: ramah === "1" || ramah === "true",
  };
}

/**
 * The call-to-action of one event, directed by its (server-computed) status:
 * presensi/streaming while running, the registration form while open, the reminder when
 * registration is closed, and materials/documentation once finished. Internal events (R03)
 * register through the in-app form at /kegiatan/:id; external events keep their official URL.
 * A missing or unsafe link is disabled with an honest message.
 */
export function tindakanKegiatan(item: KegiatanAgenda): TindakanKegiatan {
  switch (item.status) {
    case "berjalan":
      return item.tautanDaring
        ? { jenis: "presensi", label: "Ikuti daring/presensi", href: item.tautanDaring, pesan: "Tautan resmi penyelenggara." }
        : {
            jenis: "presensi",
            label: "Tautan presensi belum tersedia",
            nonaktif: true,
            pesan: "Presensi/streaming resmi belum ditautkan penyelenggara.",
          };
    case "pendaftaran":
      if (item.pendaftaranInternal) {
        return {
          jenis: "daftar",
          label: "Daftar Sekarang",
          href: `/kegiatan/${item.id}`,
          internal: true,
          pesan: "Pendaftaran internal melalui akun UMKM Anda.",
        };
      }
      return item.registrationUrl
        ? { jenis: "daftar", label: "Daftar Sekarang", href: item.registrationUrl, pesan: "Formulir pendaftaran resmi penyelenggara." }
        : {
            jenis: "daftar",
            label: "Daftar Sekarang",
            nonaktif: true,
            pesan: "Tautan pendaftaran resmi belum tersedia, jadi pendaftaran belum dibuka di sini.",
          };
    case "segera":
      return { jenis: "pengingat", label: "Ingatkan saya", pesan: "Kirim pengingat WhatsApp/email sebelum kegiatan." };
    default:
      return item.materiUrl
        ? { jenis: "materi", label: "Buka materi & dokumentasi", href: item.materiUrl, pesan: "Dokumentasi resmi penyelenggara." }
        : {
            jenis: "materi",
            label: "Materi belum diunggah",
            nonaktif: true,
            pesan: "Materi/dokumentasi akan ditautkan penyelenggara setelah acara.",
          };
  }
}

/** Schedule copy of a stored reminder, e.g. "Pengingat dijadwalkan 9 Okt 2026, 09.00 WIB". */
export function jadwalPengingatTeks(value: string): string {
  return `Pengingat dijadwalkan ${rentang(value)} WIB`;
}

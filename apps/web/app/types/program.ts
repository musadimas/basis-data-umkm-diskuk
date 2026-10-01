/** DTOs of the /v1/program endpoints (services/directus/extensions/program). */

export type TalentStatus = "none" | "nominated" | "scouting" | "talent_pool" | "accelerator" | "champion";
export type JenisLegalitas = "halal" | "pirt" | "bpom" | "hki" | "sni" | "umku";
export type StatusLegalitas = "dalam_proses" | "terbit" | "kedaluwarsa" | "dicabut";
export type KesiapanLegalitas = "belum" | "dalam_proses" | "terbit";
export type PengajuanStatus = "draft" | "dinilai" | "disetujui" | "ditolak";

export interface Legalitas {
  id: string;
  jenis: JenisLegalitas;
  nomor: string | null;
  status: StatusLegalitas;
  berlakuHingga: string | null;
  berkas: string | null;
}

export interface UsahaSummary {
  id: string;
  nama: string;
  nib: string | null;
  skala: "micro" | "small" | "medium" | null;
  kodeKbli: string | null;
  kegiatanUtama: string | null;
  produkUtama: string | null;
  omzetTahunan: number | null;
  totalAset: number | null;
  kota: string | null;
  kecamatan: string | null;
  tenagaKerja: number;
  talentStatus: TalentStatus;
  talentBatch: string | null;
  pdnTerverifikasi: boolean;
  ramahDisabilitas: boolean;
  pemilik: { nama: string | null; nikMasked: string };
}

export interface TalentSkor {
  finansial: number;
  pasar: number;
  legalitas: number;
  sdm: number;
  total: number;
  rubrikVersi: string;
  rekomendasi?: string;
}

export interface TalentPengajuan {
  id: string;
  usaha: string;
  status: PengajuanStatus;
  kapasitasProduksi: number | null;
  satuan: string | null;
  kesiapanLegalitas: Partial<Record<JenisLegalitas, KesiapanLegalitas>>;
  literasiQris: boolean;
  literasiPembukuanDigital: boolean;
  suratKomitmen: string | null;
  skor: TalentSkor | null;
  dinilaiAt: string | null;
  catatan: string | null;
  alasanTolak: string | null;
  ditolakAt: string | null;
  beritaAcara: string | null;
  dateCreated: string;
  dateUpdated: string;
}

export interface TalentPengajuanListItem extends TalentPengajuan {
  usahaInfo: { nama: string; nib: string | null; skala: string | null; kota: string | null };
}

export interface TalentUsahaDetail {
  usaha: UsahaSummary;
  legalitas: Legalitas[];
  pengajuan: TalentPengajuan | null;
}

export interface TalentPengajuanInput {
  kapasitasProduksi: number | null;
  satuan: string | null;
  kesiapanLegalitas: Partial<Record<JenisLegalitas, KesiapanLegalitas>>;
  literasiQris: boolean;
  literasiPembukuanDigital: boolean;
  suratKomitmen: string | null;
  catatan: string | null;
}

export interface BeritaAcara {
  id: string;
  nomor: string;
  tanggal: string;
  catatan: string | null;
  berkas: string | null;
  dateCreated: string;
  jumlahPengajuan: number;
}

export type LaporanStatus = "menunggu" | "disetujui" | "ditolak";

export interface KpiPeserta {
  id: string;
  usaha: { id: string; nama: string; nib: string | null; skala: string | null; kota: string | null };
  batch: string;
  fase: string;
  pendamping: { id: string; nama: string | null } | null;
  tanggalMulai: string;
  jumlahMinggu: number;
  /** 0 before the programme starts. */
  mingguBerjalan: number;
  targetMingguan: number;
  rekomendasiPitching: boolean;
  status: "aktif" | "selesai" | "keluar";
}

export interface KpiPesertaListItem extends KpiPeserta {
  laporanTerkirim: number;
  statusMingguIni: LaporanStatus | "belum_mengirim" | null;
}

export interface KpiLaporan {
  id: string;
  peserta: string;
  mingguKe: number;
  target: number;
  realisasiOmzet: number;
  jumlahTransaksi: number;
  capaianPersen: number | null;
  kendala: string | null;
  bukti: string[];
  status: LaporanStatus;
  catatanPendamping: string | null;
  direviewAt: string | null;
  clientUuid: string;
  /** Device time of an offline draft (M5-03 provenance); null when sent directly. */
  dibuatPadaKlien: string | null;
  dateCreated: string;
  dateUpdated: string;
}

export interface KpiLaporanQueueItem extends KpiLaporan {
  pesertaInfo: KpiPeserta | null;
}

/** Satu halaman antrean review (BUG-012). */
export interface KpiLaporanQueuePage {
  items: KpiLaporanQueueItem[];
  meta: { page: number; limit: number; total: number };
}

export interface KpiPesertaDetail {
  peserta: KpiPeserta;
  laporan: KpiLaporan[];
  pitching: { streak: number; dibutuhkan: number; memenuhi: boolean };
  akses: { kirim: boolean; review: boolean };
}

export interface KpiLaporanInput {
  mingguKe: number;
  realisasiOmzet: number;
  jumlahTransaksi: number;
  kendala: string | null;
  bukti: string[];
  clientUuid: string;
  /** When the report was drafted on the device; a Friday draft may sync later. */
  dibuatPada?: string | null;
}

export type KurasiStatus = "menunggu" | "tayang" | "rekomendasi_marketplace" | "ditolak";

/** One valid certificate of the business, copied into the public product record (20260926R). */
export interface ProdukLegalitas {
  jenis: JenisLegalitas;
  nomor: string | null;
  berlakuHingga: string | null;
}

/** A published product as the Directus Public policy exposes it (collection `produk`). */
export interface ProdukPublik {
  id: string;
  nama: string;
  deskripsi: string | null;
  kategori: string | null;
  kbli: string | null;
  harga_retail: number | null;
  harga_grosir: number | null;
  /** Label harga dari server (toProduk.hargaLabel); baris mentah Directus tidak memilikinya. */
  hargaLabel?: string | null;
  moq: number | null;
  video_url: string | null;
  dimensi: string | null;
  berat: string | null;
  shelf_life: string | null;
  bahan_baku: string | null;
  tkdn_persen: number | string | null;
  kapasitas_bulanan: string | null;
  lead_time: string | null;
  persen_bahan_lokal: number | string | null;
  pdn_deklarasi: boolean;
  status_kurasi: KurasiStatus;
  foto: { directus_files_id: string }[];
  usaha_nama: string | null;
  usaha_skala: string | null;
  usaha_talent_status: TalentStatus | null;
  usaha_pdn: boolean;
  usaha_ramah_disabilitas: boolean;
  usaha_whatsapp: string | null;
  usaha_kota: number | null;
  usaha_kota_nama: string | null;
  usaha_sertifikasi: string;
  usaha_nib: string | null;
  usaha_legalitas: ProdukLegalitas[] | null;
  date_created: string;
}

/** A product as its owner and the curators see it (/v1/program/katalog). */
export interface Produk {
  id: string;
  usaha: string;
  nama: string;
  deskripsi: string | null;
  kategori: string | null;
  kbli: string | null;
  hargaRetail: number | null;
  hargaGrosir: number | null;
  /** Rentang harga siap tampil dari server ("Rp 12.000 - Rp 15.000"); null bila tanpa harga. */
  hargaLabel: string | null;
  moq: number | null;
  videoUrl: string | null;
  dimensi: string | null;
  berat: string | null;
  shelfLife: string | null;
  bahanBaku: string | null;
  tkdnPersen: number | null;
  kapasitasBulanan: string | null;
  leadTime: string | null;
  ujiLab: string | null;
  persenBahanLokal: number | null;
  pdnDeklarasi: boolean;
  foto: string[];
  statusKurasi: KurasiStatus;
  catatanKurasi: string | null;
  dikurasiAt: string | null;
  usahaNama: string | null;
  usahaKota: string | null;
  dateCreated: string;
  dateUpdated: string;
}

export type ProdukInput = Omit<Produk, "id" | "usaha" | "hargaLabel" | "statusKurasi" | "catatanKurasi" | "dikurasiAt" | "usahaNama" | "usahaKota" | "dateCreated" | "dateUpdated">;

export interface UsahaPilihan {
  id: string;
  nama: string;
  nib: string | null;
  kota: string | null;
}

export interface ProdukLoi {
  id: string;
  produk: string;
  produkNama: string;
  usahaNama: string | null;
  nama: string;
  instansi: string | null;
  email: string;
  telepon: string | null;
  jumlah: string | null;
  pesan: string;
  /** Pengirim setuju dihubungi kembali; kontak hanya ditampilkan bila true (M7-05). */
  persetujuanKontak: boolean;
  status: "baru" | "ditindaklanjuti" | "ditutup";
  dateCreated: string;
}

export type LoiStatus = ProdukLoi["status"];

export interface PassportSkor {
  finansial: number;
  pasar: number;
  legalitas: number;
  sdm: number;
  kinerja: number;
}

/** A badge on the passport: "terverifikasi" requires recorded evidence, declarations say so. */
export interface PassportBadge {
  key: string;
  label: string;
  terverifikasi: boolean;
  sumber: string;
}

export interface SumberSkor {
  dimensi: string;
  sumber: string;
}

/** Public key of the active Ed25519 signing key, for verification outside the server. */
export interface PassportPublicKey {
  kid: string;
  jwk: { kty: string; crv: string; x: string };
  sidikJari: string;
}

/** The signed, public part of a Talent Passport. */
export interface PassportPayload {
  versi: number;
  kode: string;
  usaha: { nama: string; skala: string | null; kota: string | null; kbli: string | null };
  statusBadge: string;
  skor: PassportSkor;
  rubrikVersi: string;
  sumberSkor?: SumberSkor[];
  badges?: PassportBadge[];
  sertifikasi: JenisLegalitas[];
  pdnTerverifikasi: boolean;
  diterbitkanAt: string;
}

export interface Passport {
  id: string;
  kode: string;
  /** Brief contract `qr_talent_passport_code` — always equal to `kode`. */
  qrTalentPassportCode?: string;
  kid?: string | null;
  status: "aktif" | "dicabut";
  statusBadge: string;
  skor: PassportSkor;
  payload: PassportPayload;
  diterbitkanAt: string;
}

export interface PassportDetail {
  usaha: { id: string; nama: string; talentStatus: TalentStatus };
  eligible: boolean;
  alasan: string | null;
  bisaMenerbitkan: boolean;
  passport: Passport | null;
}

export interface PassportPortfolioItem {
  id: string;
  nama: string;
  deskripsi: string | null;
  videoUrl: string | null;
  dimensi: string | null;
  berat: string | null;
  shelfLife: string | null;
  bahanBaku: string | null;
  persenBahanLokal: number | string | null;
  tkdnPersen: number | string | null;
  kapasitasBulanan: string | null;
  leadTime: string | null;
  ujiLab: string | null;
  foto: string[];
}

export type PassportVerification =
  | { kode: string; qrTalentPassportCode?: string; valid: true; status: "aktif"; passport: PassportPayload; portfolio: PassportPortfolioItem[]; publicKey?: PassportPublicKey }
  | { kode: string; qrTalentPassportCode?: string; valid: false; status: "tidak_valid" | "dicabut"; dicabutAt?: string };

export type KategoriKegiatan = "pelatihan" | "sertifikasi" | "pameran" | "akselerasi" | "literasi_digital";
export type MetodeKegiatan = "luring" | "daring" | "hybrid";
export type StatusKegiatanAgenda = "berjalan" | "pendaftaran" | "segera" | "selesai";

/** The four filters of the public agenda (M7-08). */
export interface KegiatanFilters {
  kategori: KategoriKegiatan | "";
  penyelenggara: string;
  metode: MetodeKegiatan | "";
  ramah: boolean;
}

/** One published event of `GET /v1/program/kegiatan` (Y07/M7-07…M7-10). */
export interface KegiatanAgenda {
  id: string;
  judul: string;
  ringkasan: string | null;
  kategori: KategoriKegiatan;
  kategoriLabel: string;
  penyelenggara: string | null;
  kotaNama: string | null;
  metode: MetodeKegiatan;
  metodeLabel: string;
  ramahDisabilitas: boolean;
  tanggalMulai: string;
  tanggalSelesai: string;
  batasRegistrasi: string | null;
  lokasi: string | null;
  tautanDaring: string | null;
  kuota: number | null;
  terisi: number;
  sisaKuota: number | null;
  /** Computed by the server from its own clock (Asia/Jakarta wall time). */
  status: StatusKegiatanAgenda;
  statusLabel: string;
  silabus: string | null;
  narasumber: string | null;
  fasilitas: string | null;
  syarat: { skala: string | null; wilayah: string | null; nib: boolean; catatan: string | null };
  poster: string | null;
  /** Official registration form; null when absent or not https. */
  registrationUrl: string | null;
  dokumenUrl: string | null;
  materiUrl: string | null;
  /** R03: the event registers through the internal flow instead of an external URL. */
  pendaftaranInternal: boolean;
  butuhPaktaIntegritas: boolean;
}

export interface KegiatanOpsi {
  kategori: { value: KategoriKegiatan; label: string }[];
  metode: { value: MetodeKegiatan; label: string }[];
  penyelenggara: string[];
}

export interface KegiatanMeta {
  serverNow: string;
  jumlah: number;
  terpotong: boolean;
  kelompok: Record<StatusKegiatanAgenda, number>;
  bulan: number | null;
  tahun: number | null;
  opsi: KegiatanOpsi;
}

/**
 * Body of `GET /v1/program/kegiatan`. The extension nests meta inside `data`
 * (`{ data: { items, meta } }`) because the Directus SDK unwraps the top-level `data` key.
 */
export interface KegiatanListResponse {
  items: KegiatanAgenda[];
  meta: KegiatanMeta;
}

/** Opt-in answer of `POST /v1/program/kegiatan/:id/pengingat`; the target arrives masked. */
export interface KegiatanPengingat {
  id: string;
  kegiatan: { id: string; judul: string };
  kanal: "email" | "whatsapp";
  tujuanMasked: string;
  jadwalKirim: string;
  /** `menunggu_gateway` is derived by the API (WhatsApp without a gateway); it is not stored. */
  status: "menunggu" | "menunggu_gateway";
  batalToken: string;
}

/** The call-to-action the agenda shows for one event, resolved from its status. */
export interface TindakanKegiatan {
  jenis: "presensi" | "daftar" | "pengingat" | "materi";
  label: string;
  href?: string | null;
  /** R03: in-app route (internal registration) instead of an external https link. */
  internal?: boolean;
  nonaktif?: boolean;
  pesan?: string | null;
}

export interface FaqEntry {
  id: number;
  pertanyaan: string;
  jawaban: string;
  kategori: string | null;
  sort: number | null;
  /** Last edit, so the help centre can show how current an answer is. */
  date_updated?: string | null;
}

export interface KontakHotline {
  id: number;
  nama_layanan: string;
  whatsapp: string | null;
  telepon: string | null;
  email: string | null;
  jam_layanan: string | null;
  alamat: string | null;
}

export interface KlinikPoli {
  id: number;
  kode: string;
  nama: string;
  deskripsi: string | null;
  /** Editable topics shown under the poli name (e.g. "NIB", "Halal"); empty when the desk has none. */
  subtopik?: string[];
  sort?: number | null;
}

/**
 * Identity prefill for the signed-in visitor (`GET /v1/program/klinik/prefill`). The public form
 * never looks up NIB/NIK: a business either comes from the
 * visitor's own account (`sumber: "sidt"`) or is typed by hand and stays unverified.
 */
export interface KlinikPrefill {
  usaha: { nama: string; skala: string | null; kota: string | null; kbli: string | null; sumber: "sidt" } | null;
  kontak: { nama: string | null; email: string | null; whatsapp: string | null };
}

export interface KlinikSlot {
  slot: string;
  tersedia: boolean;
}

export type KlinikNotifikasiStatus = "pending" | "menunggu_gateway" | "mengirim" | "terkirim" | "diterima" | "gagal" | "batal";

export interface KlinikNotifikasi {
  status: KlinikNotifikasiStatus;
  label: string;
}

export interface KlinikTiketDibuat {
  nomor: string;
  poli: string;
  moda: "daring" | "luring";
  tanggal: string;
  slot: string;
  sumberIdentitas: "sidt" | "manual";
  notifikasi: KlinikNotifikasi;
}

/** Ticket read-back (`POST /v1/program/klinik/tiket/lacak`) — number plus its WhatsApp number. */
export interface KlinikTiketLacak extends KlinikTiketDibuat {
  namaUsaha: string;
  status: KlinikStatus;
  /** Penilaian layanan (CSAT): hanya ditawarkan pada tiket selesai yang belum dinilai. */
  csat: { bisaMenilai: boolean; sudahMenilai: boolean };
}

/** Statistik layanan publik (`GET /v1/program/klinik/statistik`); `null` berarti belum ada data, bukan nol. */
export interface KlinikStatistik {
  totalSelesai: number;
  respons: { rataRataJam: number | null; sampel: number; targetJam: number };
  csat: { rataRata: number | null; sampel: number; skalaMaks: number };
  /** Definisi tiap angka dari server, satu sumber dengan dokumen. */
  definisi: { totalSelesai: string; respons: string; csat: string };
  dihitungPada: string;
}

export type KlinikAfiliasi = "plut" | "dinas" | "praktisi";

/** Satu konsultan di direktori publik (`GET /v1/program/klinik/konsultan`): tanpa kontak maupun id akun. */
export interface KlinikKonsultan {
  id: number;
  nama: string;
  poli: { id: number; kode: string; nama: string };
  afiliasi: KlinikAfiliasi | null;
  afiliasiLabel: string | null;
  /** Hari layanan mingguan (`senin`…`jumat`) dan slot tetapnya. */
  hari: string[];
  slot: string[];
  /** Slot bebas per tanggal dalam rentang; kosong bila belum ada. */
  ketersediaan: { tanggal: string; slot: string[] }[];
  totalSlotBebas: number;
}

export interface KlinikDirektori {
  rentang: { dari: string | null; sampai: string | null };
  konsultan: KlinikKonsultan[];
}

/** Jawaban `POST /v1/program/klinik/tiket/csat`; `dihitung` false bila pemohon tidak memberi consent. */
export interface KlinikCsatTersimpan {
  nomor: string;
  tersimpan: boolean;
  dihitung: boolean;
}

export type KlinikStatus = "masuk" | "dijadwalkan" | "berjalan" | "tindak_lanjut" | "selesai" | "batal";
export type KlinikPrioritas = "normal" | "tinggi" | "mendesak";
export type KlinikRujukan = "sarpras" | "vokasi" | "mediasi_sapa" | "talent_lab";
export type KlinikAspek = "legalitas" | "keuangan" | "pemasaran" | "produksi" | "sdm";

export interface KlinikTiket {
  id: string;
  nomor: string;
  usaha: string | null;
  namaUsaha: string;
  namaKontak: string;
  whatsapp: string;
  email: string | null;
  poli: number;
  poliNama: string;
  deskripsi: string;
  moda: "daring" | "luring";
  jadwalTanggal: string;
  jadwalSlot: string;
  prioritas: KlinikPrioritas;
  status: KlinikStatus;
  /** Label tahap dari server (bukan peta web); kode yang tak dikenal apa adanya. */
  statusLabel: string;
  /** Status berikutnya yang boleh dituju petugas ini; kosong bila tiket di luar hak atau sudah selesai. */
  transisi: KlinikStatus[];
  pendamping: string | null;
  pendampingNama: string | null;
  /** Signed-in applicant on the ticket, when the form was filled from an account. */
  pemohon: string | null;
  sumberIdentitas: "sidt" | "manual";
  waConsent: boolean;
  linkMeet: string | null;
  diagnosis: Partial<Record<KlinikAspek, string>>;
  actionPlan: string | null;
  rujukan: KlinikRujukan[];
  catatan: string | null;
  lampiran: string[];
  /** Latest WhatsApp message for this ticket, with its honest delivery state. */
  notifikasi: (KlinikNotifikasi & { jenis: string; template: string; attempts: number; lastError: string | null }) | null;
  /** Aduan PMSE mendesak: advokasi PMSE yang ditandai mendesak (M7-13). */
  pmseMendesak?: boolean;
  /**
   * Opaque version of the row (`date_updated` in microseconds). The panel echoes it back on every
   * PATCH so two officers cannot overwrite each other's status or notes.
   */
  versi: string;
  /** Actor/time trail of the accepted changes, newest first. */
  riwayat?: KlinikTiketAudit[];
  /** Outcome konsultasi terbaru tiket ini (R04); `null` bila belum pernah dicatat. */
  outcome: KlinikOutcome | null;
  /** Keputusan server: tawarkan "Catat outcome" (tiket selesai milik usaha terdaftar tanpa outcome hidup). */
  outcomeBisaDicatat: boolean;
  dateCreated: string;
  dateUpdated: string;
}

export type KlinikJenisOutcome = "kepatuhan" | "perbaikan";
export type KlinikStatusOutcome = "diajukan" | "terverifikasi" | "dicabut";
/** Tombol yang boleh ditekan pemanggil pada outcome; server yang memutuskan, UI hanya mengikuti. */
export type KlinikAksiOutcome = "verifikasi" | "koreksi" | "cabut";

/** Isian outcome yang dikirim petugas: atribut (snake_case, satu dari 15) dan jenisnya. */
export interface KlinikOutcomeIsi {
  atribut: string;
  jenis: KlinikJenisOutcome;
}

export interface KlinikOutcomeItem extends KlinikOutcomeIsi {
  label: string;
}

export interface KlinikOutcome {
  id: string;
  versi: number;
  status: KlinikStatusOutcome;
  statusLabel: string;
  diajukanNama: string | null;
  diajukanPada: string;
  diverifikasiNama: string | null;
  diverifikasiPada: string | null;
  dicabutNama: string | null;
  dicabutPada: string | null;
  alasanCabut: string | null;
  items: KlinikOutcomeItem[];
  aksi: KlinikAksiOutcome[];
}

/** Baris antrean verifikasi (`GET /v1/program/klinik/outcome`): outcome plus tiket dan usahanya. */
export interface KlinikOutcomeAntrean extends KlinikOutcome {
  nomorTiket: string;
  namaUsaha: string;
  poli: string;
}

/** Jawaban `POST /tiket/:id/outcome` (`duplikat` bila retry atas isi yang sama). */
export interface KlinikOutcomeDicatat {
  id: string;
  duplikat?: boolean;
}

/** Jawaban verifikasi, koreksi, dan pencabutan outcome. */
export interface KlinikOutcomeDiputuskan {
  id: string;
  versi: number;
  status: KlinikStatusOutcome;
  duplikat: boolean;
}

/** One accepted change of a ticket, as the kanban shows it (Y09/M7-13). */
export interface KlinikTiketAudit {
  aksi: "transisi" | "penugasan" | "catatan";
  statusDari: KlinikStatus | null;
  statusKe: KlinikStatus | null;
  perubahan: string[];
  aktorNama: string | null;
  dateCreated: string;
}

// ── R03: pendaftaran kegiatan internal, e-pass/sertifikat, fasilitasi bantuan ──

export type StatusPendaftaran = "menunggu" | "diterima" | "ditolak" | "daftar_tunggu" | "batal";

export interface RegistrasiPrefill {
  usaha: { id: string; nama: string; skala: string | null; kodeKbli: string | null; kota: string | null; sumber: string };
  kontak: { nama: string | null; email: string | null; whatsapp: string | null };
  aksesibilitas: { butuhDisabilitas: boolean };
}

export interface RegistrasiPendaftaran {
  id: string;
  kegiatan: string;
  usaha: string;
  status: StatusPendaftaran;
  skorTalent: number | null;
  skorRubrik: string | null;
  administrasiLolos: boolean;
  alasan: string | null;
  epassToken: string | null;
  tugasSelesai: boolean;
  diputuskanPada: string | null;
  dateCreated: string;
}

export interface RegistrasiPendaftarListItem extends RegistrasiPendaftaran {
  usahaNama: string | null;
  usahaSkala: string | null;
  usahaKota: string | null;
  /** Active certificate of this registration, if issued (R03). */
  sertifikatId: string | null;
  sertifikatKode: string | null;
}

export interface EpassSaya {
  pendaftaran: string;
  qr: string;
  jadwal: string | null;
  lokasi: string | null;
  tautan: string | null;
  metode: string | null;
}

export interface KeputusanHasil extends RegistrasiPendaftaran {
  daftarTungguNaik: RegistrasiPendaftaran | null;
}

export interface SertifikatVerifikasi {
  kode: string;
  valid: boolean;
  status: "aktif" | "dicabut" | "tidak_valid";
  usaha?: string;
  kegiatan?: string;
  dicabutPada?: string | null;
}

export type BentukBantuan = "penghargaan" | "beasiswa" | "operasional" | "sarpras_produksi" | "sarpras_pemasaran" | "revitalisasi_gedung" | "permodalan" | "lainnya";
export type JenisBantuan = "uang" | "barang" | "jasa";
export type StatusPendaftaranBantuan = "dibuka" | "segera" | "ditutup" | "penuh";

export interface BantuanKartu {
  id: string;
  bentuk: BentukBantuan;
  judul: string;
  ringkasan: string | null;
  bentukBantuan: JenisBantuan;
  kuota: number | null;
  terisi: number;
  sisaKuota: number | null;
  pendaftaranMulai: string | null;
  pendaftaranSelesai: string | null;
  serverNow: string;
  statusPendaftaran: StatusPendaftaranBantuan;
  petunjuk: string | null;
  kanalResmi: string | null;
}

export interface BantuanListResponse {
  items: BantuanKartu[];
  meta: { serverNow: string; jumlah: number };
}

export type KurasiInvestorStatus = "menunggu" | "disetujui" | "belum_disetujui" | "dicabut";

export interface KurasiInvestorItem {
  id: string;
  nama: string;
  jenama: string;
  status: KurasiInvestorStatus;
  disetujuiKuratorPada: string | null;
  kuratorDicabutPada: string | null;
  dateUpdated: string;
}

export interface KurasiInvestorDaftar {
  items: KurasiInvestorItem[];
  meta: { counts: Record<KurasiInvestorStatus, number> };
}

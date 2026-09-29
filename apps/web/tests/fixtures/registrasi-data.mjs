/**
 * R03 fixtures: internal registration, e-pass/sertifikat and facilitation cards
 * for the Playwright mocks. The stand-in answers `/v1/program/registrasi*` and
 * `/v1/program/fasilitasi*` with the same envelopes, guards and quota math as the
 * real endpoints (status flow, waitlist, idempotent scan, published-only cards),
 * so the mocked browser flow cannot drift from the server.
 */
import { renderXlsx } from "../../../../services/directus/extensions/program/src/endpoints/registrasi/xlsx.js";

export const REGISTRASI_IDS = {
  kegiatanInternal: "ae000000-0000-4000-8000-0000000000b1",
  kegiatanInternalPenuh: "ae000000-0000-4000-8000-0000000000b2",
  kegiatanInternalPakta: "ae000000-0000-4000-8000-0000000000b3",
  usaha: "11111111-1111-4111-8111-000000000001",
  pendaftarUmkm: "user-4",
};

const HARI = 86_400_000;

/** Baris kegiatan internal sebagaimana DB mengembalikannya (dipakai barisKegiatan). */
export function barisKegiatanInternal(now = Date.now()) {
  const at = (offset) => new Date(now + offset * HARI).toISOString();
  const base = {
    ringkasan: "Pelatihan internal Dinas KUKM dengan pendaftaran lewat akun UMKM.",
    penyelenggara: "Dinas KUKM Provinsi Jawa Barat",
    kota_nama: "Kota Bandung",
    lokasi: "Gedung Disperindag",
    metode: "luring",
    kategori: "pelatihan",
    kuota: 2,
    terisi: 0,
    silabus: "Manajemen keuangan dan pemasaran",
    narasumber: "Praktisi UMKM",
    status_publikasi: "terbit",
    pendaftaran_internal: true,
    butuh_pakta_integritas: false,
    butuh_tugas: true,
    jumlah_sesi: 4,
  };
  return [
    { ...base, id: REGISTRASI_IDS.kegiatanInternal, judul: "Pelatihan Manajemen Internal", ramah_disabilitas: true, tanggal_mulai: at(10), tanggal_selesai: at(11), batas_registrasi: at(8) },
    { ...base, id: REGISTRASI_IDS.kegiatanInternalPenuh, judul: "Bimtek Kapasitas SDM (Kuota Penuh)", kuota: 1, terisi: 1, tanggal_mulai: at(12), tanggal_selesai: at(13), batas_registrasi: at(10) },
    { ...base, id: REGISTRASI_IDS.kegiatanInternalPakta, judul: "Sertifikasi Internal Berpakta", butuh_pakta_integritas: true, tanggal_mulai: at(20), tanggal_selesai: at(21), batas_registrasi: at(18) },
  ];
}

export function createRegistrasiState({ now = Date.now() } = {}) {
  return { now, pendaftaran: [], presensi: {}, sertifikat: {}, urut: 0 };
}

const err = (status, code, message) => ({ status, body: { errors: [{ message, extensions: { code } }] } });

function toPendaftaranDto(row) {
  return {
    id: row.id,
    kegiatan: row.kegiatan,
    usaha: row.usaha,
    status: row.status,
    skorTalent: row.skorTalent ?? null,
    skorRubrik: row.skorRubrik ?? null,
    administrasiLolos: row.status === "diterima",
    alasan: row.alasan ?? null,
    epassToken: row.epassToken,
    tugasSelesai: Boolean(row.tugasSelesai),
    diputuskanPada: row.diputuskanPada ?? null,
    dateCreated: row.dateCreated,
  };
}

const KEGIATAN_INTERNAL = Object.fromEntries(barisKegiatanInternal().map((row) => [row.id, row]));

/**
 * Stand-in for /v1/program/registrasi*. `role` is the active mock role and
 * `secretOk` tells whether the caller validated the internal secret header for
 * /pindai; returns null for paths outside the endpoint so other mocks fall through.
 */
export function registrasiApiResponse({ pathname, method = "GET", body = null, state, role = "umkm", secretOk = false }) {
  if (!pathname.startsWith("/v1/program/registrasi")) return null;
  const sisa = pathname.slice("/v1/program/registrasi".length);

  if (method === "GET" && sisa === "/prefill") {
    if (role !== "umkm") return err(403, "FORBIDDEN", "Only UMKM.");
    return {
      status: 200,
      body: { data: { usaha: { id: REGISTRASI_IDS.usaha, nama: "Wawan Leathercraft", skala: "micro", kodeKbli: "15129", kota: "Kabupaten Bandung", sumber: "sidt" }, kontak: { nama: "Wawan", email: "dummy_wawan.leathercraft@gmail.com", whatsapp: "6281200000001" }, aksesibilitas: { butuhDisabilitas: false } } },
    };
  }

  const daftar = sisa.match(/^\/kegiatan\/([^/]+)\/daftar$/);
  if (method === "POST" && daftar) {
    if (role !== "umkm") return err(403, "FORBIDDEN", "Only UMKM.");
    const kegiatan = KEGIATAN_INTERNAL[daftar[1]];
    if (!kegiatan) return err(404, "KEGIATAN_NOT_FOUND", "The event was not found.");
    if (!body?.captcha) return err(400, "CAPTCHA_INVALID", "The captcha is missing, expired or already used.");
    if (body.consent !== true) return err(400, "CONSENT_WAJIB", "Persetujuan wajib dicentang.");
    if (kegiatan.butuh_pakta_integritas && body.paktaIntegritas !== true) return err(400, "PAKTA_WAJIB", "Pakta wajib.");
    if (body.butuhDisabilitas === true && !String(body.kebutuhanAksesibilitas ?? "").trim()) return err(400, "AKSESIBILITAS_WAJIB", "Kebutuhan aksesibilitas wajib diisi.");
    if (state.pendaftaran.some((row) => row.kegiatan === kegiatan.id && ["menunggu", "diterima", "daftar_tunggu"].includes(row.status))) {
      return err(409, "SUDAH_TERDAFTAR", "Usaha sudah terdaftar aktif.");
    }
    const diterima = Number(kegiatan.terisi ?? 0) + state.pendaftaran.filter((row) => row.kegiatan === kegiatan.id && row.status === "diterima").length;
    const status = kegotaPenuh(kegiatan, diterima) ? "daftar_tunggu" : "menunggu";
    state.urut += 1;
    const row = {
      id: `ef000000-0000-4000-8000-${String(state.urut).padStart(12, "0")}`,
      kegiatan: kegiatan.id,
      usaha: REGISTRASI_IDS.usaha,
      status,
      epassToken: `ab000000-0000-4000-8000-${String(state.urut).padStart(12, "0")}`,
      tugasSelesai: false,
      dateCreated: new Date().toISOString(),
    };
    state.pendaftaran.push(row);
    return { status: 201, body: { data: toPendaftaranDto(row) } };
  }

  const saya = sisa.match(/^\/kegiatan\/([^/]+)\/saya$/);
  if (method === "GET" && saya) {
    if (role !== "umkm") return err(403, "FORBIDDEN", "Only UMKM.");
    const row = [...state.pendaftaran].reverse().find((item) => item.kegiatan === saya[1] && item.usaha === REGISTRASI_IDS.usaha);
    if (!row) return err(404, "PENDAFTARAN_NOT_FOUND", "Belum ada pendaftaran.");
    return { status: 200, body: { data: toPendaftaranDto(row) } };
  }

  const epass = sisa.match(/^\/kegiatan\/([^/]+)\/epass$/);
  if (method === "GET" && epass) {
    if (role !== "umkm") return err(403, "FORBIDDEN", "Only UMKM.");
    const kegiatan = KEGIATAN_INTERNAL[epass[1]];
    const row = state.pendaftaran.find((item) => item.kegiatan === epass[1] && item.usaha === REGISTRASI_IDS.usaha && item.status === "diterima");
    if (!row || !kegiatan) return err(404, "EPASS_NOT_FOUND", "E-pass hanya untuk peserta diterima.");
    return { status: 200, body: { data: { pendaftaran: row.id, qr: `DISKUK-EPASS:${kegiatan.id}:${row.id}:${row.epassToken}`, jadwal: kegiatan.tanggal_mulai, lokasi: kegiatan.lokasi, tautan: null, metode: kegiatan.metode } } };
  }

  const pendaftarList = sisa.match(/^\/kegiatan\/([^/]+)\/pendaftar$/);
  if (method === "GET" && pendaftarList) {
    if (!["provinsi", "kabkota"].includes(role)) return err(403, "FORBIDDEN", "Staff only.");
    const items = state.pendaftaran
      .filter((row) => row.kegiatan === pendaftarList[1])
      .map((row) => ({ ...toPendaftaranDto(row), usahaNama: "Wawan Leathercraft", usahaSkala: "micro", usahaKota: "Kabupaten Bandung", sertifikatId: state.sertifikat[row.id] ? `sf000000-0000-4000-8000-${String(row.id).slice(-12)}` : null, sertifikatKode: state.sertifikat[row.id] ?? null }));
    return { status: 200, body: { data: items } };
  }

  const xlsx = sisa.match(/^\/kegiatan\/([^/]+)\/pendaftar\/xlsx$/);
  if (method === "GET" && xlsx) {
    if (!["provinsi", "kabkota"].includes(role)) return err(403, "FORBIDDEN", "Staff only.");
    const items = state.pendaftaran.filter((row) => row.kegiatan === xlsx[1]);
    const berkas = renderXlsx(["Usaha", "Skala", "Kota", "Status", "Skor Talent", "Didaftarkan"], items.map((row) => ["Wawan Leathercraft", "micro", "Kabupaten Bandung", row.status, row.skorTalent ?? "", row.dateCreated]));
    return { status: 200, buffer: berkas, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }

  const keputusan = sisa.match(/^\/pendaftar\/([^/]+)\/keputusan$/);
  if (method === "POST" && keputusan) {
    if (!["provinsi", "kabkota"].includes(role)) return err(403, "FORBIDDEN", "Staff only.");
    const row = state.pendaftaran.find((item) => item.id === keputusan[1]);
    if (!row) return err(404, "PENDAFTARAN_NOT_FOUND", "Pendaftaran tidak ditemukan.");
    const keputusanBaru = String(body?.keputusan ?? "");
    if (!["diterima", "ditolak", "daftar_tunggu", "batal"].includes(keputusanBaru)) return err(400, "INVALID_PAYLOAD", "Keputusan tidak valid.");
    if (keputusanBaru === "diterima") {
      const kegiatan = KEGIATAN_INTERNAL[row.kegiatan];
      const diterima = Number(kegiatan?.terisi ?? 0) + state.pendaftaran.filter((item) => item.kegiatan === row.kegiatan && item.status === "diterima" && item.id !== row.id).length;
      if (kegiatan && kegiatan.kuota !== null && diterima >= kegiatan.kuota) return err(409, "KUOTA_PENUH", "Kuota penuh.");
    }
    row.status = keputusanBaru;
    row.diputuskanPada = new Date().toISOString();
    let naik = null;
    if (["batal", "ditolak"].includes(keputusanBaru)) {
      const tunggu = state.pendaftaran.find((item) => item.kegiatan === row.kegiatan && item.status === "daftar_tunggu");
      if (tunggu) {
        tunggu.status = "diterima";
        tunggu.diputuskanPada = new Date().toISOString();
        naik = toPendaftaranDto(tunggu);
      }
    }
    return { status: 200, body: { data: { ...toPendaftaranDto(row), daftarTungguNaik: naik } } };
  }

  const tugas = sisa.match(/^\/pendaftar\/([^/]+)\/tugas$/);
  if (method === "POST" && tugas) {
    if (!["provinsi", "kabkota"].includes(role)) return err(403, "FORBIDDEN", "Staff only.");
    const row = state.pendaftaran.find((item) => item.id === tugas[1]);
    if (!row) return err(404, "PENDAFTARAN_NOT_FOUND", "Pendaftaran tidak ditemukan.");
    row.tugasSelesai = body?.selesai === true;
    return { status: 200, body: { data: { id: row.id, tugasSelesai: row.tugasSelesai } } };
  }

  const terbit = sisa.match(/^\/pendaftar\/([^/]+)\/sertifikat$/);
  if (method === "POST" && terbit) {
    if (!["provinsi", "kabkota"].includes(role)) return err(403, "FORBIDDEN", "Staff only.");
    const row = state.pendaftaran.find((item) => item.id === terbit[1]);
    if (!row || row.status !== "diterima") return err(409, "BELUM_LAYAK", "Hanya peserta diterima.");
    if (state.sertifikat[row.id]) return { status: 200, body: { data: { kode: state.sertifikat[row.id], duplikat: true } } };
    const kode = "SKMOCK" + String(Object.keys(state.sertifikat).length + 1).padStart(4, "0") + "AB";
    state.sertifikat[row.id] = kode;
    return { status: 201, body: { data: { kode, duplikat: false } } };
  }

  const cabut = sisa.match(/^\/sertifikat\/([^/]+)\/cabut$/);
  if (method === "POST" && cabut) {
    if (!["provinsi", "kabkota"].includes(role)) return err(403, "FORBIDDEN", "Staff only.");
    for (const [pendaftaranId, kode] of Object.entries(state.sertifikat)) {
      const idTurunan = `sf000000-0000-4000-8000-${pendaftaranId.slice(-12)}`;
      if (kode === cabut[1] || idTurunan === cabut[1]) {
        delete state.sertifikat[pendaftaranId];
        return { status: 200, body: { data: { kode, status: "dicabut" } } };
      }
    }
    return err(404, "SERTIFIKAT_NOT_FOUND", "Sertifikat aktif tidak ditemukan.");
  }

  if (method === "GET" && sisa.startsWith("/sertifikat/")) {
    const kode = sisa.slice("/sertifikat/".length).toUpperCase();
    const ada = Object.values(state.sertifikat).includes(kode);
    return { status: 200, body: { data: { kode, valid: ada, status: ada ? "aktif" : "dicabut" } } };
  }

  if (method === "POST" && sisa === "/pindai") {
    if (!secretOk) return err(403, "FORBIDDEN", "Scan butuh rahasia internal.");
    const qr = String(body?.qr ?? "");
    const match = qr.match(/^DISKUK-EPASS:([^:]+):([^:]+):([0-9a-f-]{36})$/i);
    if (!match) return err(400, "QR_TIDAK_VALID", "QR tidak valid.");
    const row = state.pendaftaran.find((item) => item.id === match[2] && item.epassToken === match[3] && item.kegiatan === match[1] && item.status === "diterima");
    if (!row) return err(404, "QR_TIDAK_DITEMUKAN", "QR tidak ditemukan untuk peserta ini.");
    const sesiKe = Number(body?.sesiKe);
    const kegiatan = KEGIATAN_INTERNAL[row.kegiatan];
    if (!Number.isInteger(sesiKe) || sesiKe < 1 || sesiKe > Number(kegiatan?.jumlah_sesi ?? 60)) return err(400, "SESI_TIDAK_VALID", "Sesi di luar jumlah sesi.");
    state.presensi[row.id] = new Set(state.presensi[row.id] ?? []);
    state.presensi[row.id].add(sesiKe);
    const hadir = state.presensi[row.id].size;
    return { status: 200, body: { data: { hadir, jumlahSesi: kegiatan.jumlah_sesi, persen: Math.round((hadir / kegiatan.jumlah_sesi) * 1000) / 10 } } };
  }

  return err(404, "NOT_FOUND", "The route was not found.");
}

function kegotaPenuh(kegiatan, diterima) {
  return kegiatan.kuota !== null && kegiatan.kuota !== undefined && diterima >= Number(kegiatan.kuota);
}

const BENTUK_8 = [
  ["penghargaan", "Pemberian Penghargaan", "jasa"],
  ["beasiswa", "Pemberian Beasiswa", "uang"],
  ["operasional", "Bantuan Operasional", "uang"],
  ["sarpras_produksi", "Bantuan Sarpras Produksi", "barang"],
  ["sarpras_pemasaran", "Bantuan Sarpras Pemasaran", "barang"],
  ["revitalisasi_gedung", "Bantuan Revitalisasi Gedung", "barang"],
  ["permodalan", "Bantuan Permodalan", "uang"],
  ["lainnya", "Bantuan Pemerintah Lainnya", "jasa"],
];

/** Stand-in for GET /v1/program/fasilitasi: delapan kartu terbit + countdown server. */
export function fasilitasiApiResponse(pathname, searchParams, now = new Date()) {
  if (pathname !== "/v1/program/fasilitasi" && pathname !== "/v1/program/fasilitasi/") return null;
  const jenis = searchParams.get("jenis");
  if (jenis && !["uang", "barang", "jasa"].includes(jenis)) return err(400, "INVALID_PAYLOAD", "Jenis tidak valid.");
  const HARI_MS = HARI;
  const items = BENTUK_8.map(([bentuk, judul, bentukBantuan], index) => {
    const kuota = index === 6 ? 0 : 25 + index * 5;
    const terisi = index === 6 ? 0 : 10 + index * 3;
    return {
      id: `bf000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      bentuk,
      judul: `${judul} UMKM Jawa Barat`,
      ringkasan: `Ringkasan ${judul.toLowerCase()} untuk UMKM.`,
      bentukBantuan,
      kuota,
      terisi,
      sisaKuota: Math.max(0, kuota - terisi),
      // Permodalan (indeks 6) lewat deadline: kartu jujur "ditutup" tanpa countdown.
      pendaftaranMulai: new Date(now.getTime() - 2 * HARI_MS).toISOString(),
      pendaftaranSelesai: new Date(now.getTime() + (index === 6 ? -1 : index === 0 ? 3 : 10 + index) * HARI_MS).toISOString(),
      serverNow: now.toISOString(),
      statusPendaftaran: index === 6 ? "ditutup" : "dibuka",
      petunjuk: `Ajukan melalui dinas terkait untuk ${judul.toLowerCase()}.`,
      kanalResmi: "https://diskuk.jabarprov.go.id/bantuan",
    };
  }).filter((item) => !jenis || item.bentukBantuan === jenis);
  return { status: 200, body: { data: { items, meta: { serverNow: now.toISOString(), jumlah: items.length } } } };
}

/**
 * Clinic fixtures shared by the browser mock (`mock-program.mjs`) and the SSR mock server
 * (`mock-directus-server.mjs`): the six desks are server-rendered by `GET /v1/program/klinik/poli`,
 * so both sides have to answer with the same content.
 *
 * `klinikMockResponse` stands in for the staff and booking endpoints. It only keeps state: every
 * rule (stage order, scope, claim, audit rows, phone normalisation, dates, slot quota) is imported
 * from the real endpoint's pure rules, like `kegiatan-data.mjs`, so the mock cannot drift. R04 adds the
 * public figures/directory/CSAT and the outcome lifecycle; outcome item validation and the figure
 * definitions come from the endpoint modules themselves, and `state.aktor` picks who is signed in.
 */
import {
  ATRIBUT_OUTCOME,
  LABEL_AFILIASI,
  LABEL_STATUS_OUTCOME,
  NOMOR_TIKET,
  PRIORITAS,
  SLOTS,
  STATUS,
  STATUS_OUTCOME,
  aksiOutcomeUntuk,
  barisAudit,
  bolehUbah,
  bolehVerifikasiOutcome,
  dalamCakupan,
  ketersediaanKonsultan,
  normalisasiTelepon,
  sidikOutcome,
  statusLabel,
  tanggalDapatDipesan,
  tanggalTidakValid,
  transisiSah,
  transisiUntuk,
} from "../../../../services/directus/extensions/program/src/endpoints/klinik/rules.js";
// Validasi isi outcome dan definisi statistik milik endpoint, dipakai apa adanya agar mock tidak menyimpang.
import { DEFINISI_STATISTIK } from "../../../../services/directus/extensions/program/src/endpoints/klinik/direktori.js";
import { parseItemsOutcome } from "../../../../services/directus/extensions/program/src/endpoints/klinik/outcome.js";

export const KLINIK_POLI = [
  { id: 1, kode: "legalitas", nama: "Legalitas & Standardisasi Produk", deskripsi: "Pendampingan NIB, Halal, PIRT/BPOM, PB UMKU, dan HKI.", subtopik: ["NIB", "Halal", "HKI"] },
  { id: 2, kode: "keuangan", nama: "Manajemen & Keuangan", deskripsi: "Rekening terpisah, laporan keuangan, SOP, dan akses KUR/LPDB.", subtopik: ["SOP", "KUR/LPDB"] },
  { id: 3, kode: "pemasaran", nama: "Pemasaran & Transformasi Digital", deskripsi: "Marketplace, promosi, QRIS, dan katalog ekspor.", subtopik: ["QRIS"] },
  { id: 4, kode: "advokasi", nama: "Advokasi & Mediasi PMSE", deskripsi: "Kontrak e-commerce, tarif, sanksi, dan pemulihan akun.", subtopik: ["Sanksi", "Pemulihan akun"] },
  { id: 5, kode: "bantuan", nama: "Akses Bantuan Pemerintah", deskripsi: "Proposal, kelayakan, RAB, serta SPJ/BAST.", subtopik: ["RAB"] },
  { id: 6, kode: "inklusif", nama: "Inklusif & Disabilitas", deskripsi: "Pendampingan alat produksi dan akses pasar.", subtopik: [] },
];

export const KLINIK_SLOTS = SLOTS;

/** The slot every desk has already booked on any day, so the specs can see a disabled radio. */
export const SLOT_SUDAH_PENUH = "09:00";

/** Version a ticket carries until its first PATCH bumps it. */
export const VERSI_AWAL = "2026-09-27T10:00:00.000000Z";

/** The officer the mocked session stands for (the login mock's "Analis Provinsi"). */
export const AKTOR_MOCK = { id: "user-provinsi", admin: false, peran: "provinsi", kotaId: null };

/**
 * Konsultan aktif di direktori (R04). Yang ketiga hanya melayani Jumat pukul 09:00, slot yang sudah penuh
 * di semua poli, sehingga direktori selalu punya satu konsultan tanpa slot bebas.
 */
export const KLINIK_KONSULTAN = [
  { id: 1, nama: "Rina Kusumawardani", poli: 1, afiliasi: "plut", hari: ["senin", "rabu", "jumat"], slot: ["09:00", "10:30", "13:00"], pendamping: null },
  { id: 2, nama: "Bambang Hartono", poli: 2, afiliasi: "dinas", hari: ["senin", "selasa", "rabu", "kamis"], slot: ["10:30", "14:30"], pendamping: null },
  { id: 3, nama: "Lestari Wulandari", poli: 3, afiliasi: "praktisi", hari: ["jumat"], slot: ["09:00"], pendamping: null },
];

/** Riwayat layanan sebelum tes berjalan: tiket selesai dan tiket yang sudah direspons (rata-rata 5,5 jam), tanpa penilaian CSAT. */
export const RIWAYAT_DASAR = { selesai: 12, responsSampel: 9, responsJamRata: 5.5 };

const bulatkan = (nilai, desimal) => Math.round(nilai * 10 ** desimal) / 10 ** desimal;

/** Jam dari tiket dikirim sampai transisi pertama ke status selain `batal`; null bila belum direspons. */
function jamRespons(tiket) {
  const pertama = (tiket.riwayat ?? []).filter((baris) => baris.aksi === "transisi" && baris.statusKe !== "batal").at(-1);
  return pertama ? Math.max((Date.parse(pertama.dateCreated) - Date.parse(tiket.dateCreated)) / 3_600_000, 0) : null;
}

/** `GET /klinik/statistik`: riwayat dasar ditambah tiket dan jawaban CSAT pada `state`; angka kosong `null`, bukan nol. */
export function statistikKlinik(state = {}) {
  const jam = (state.tiket ?? []).map(jamRespons).filter((nilai) => nilai !== null);
  const sampel = RIWAYAT_DASAR.responsSampel + jam.length;
  const totalJam = RIWAYAT_DASAR.responsJamRata * RIWAYAT_DASAR.responsSampel + jam.reduce((total, nilai) => total + nilai, 0);
  const nilaiCsat = (state.csat ?? []).filter((jawaban) => jawaban.consent).map((jawaban) => jawaban.nilai);
  return {
    totalSelesai: RIWAYAT_DASAR.selesai + (state.tiket ?? []).filter((tiket) => tiket.status === "selesai").length,
    respons: { rataRataJam: sampel ? bulatkan(totalJam / sampel, 1) : null, sampel, targetJam: 24 },
    csat: {
      rataRata: nilaiCsat.length ? bulatkan(nilaiCsat.reduce((total, nilai) => total + nilai, 0) / nilaiCsat.length, 2) : null,
      sampel: nilaiCsat.length,
      skalaMaks: 5,
    },
    definisi: DEFINISI_STATISTIK,
    dihitungPada: new Date().toISOString(),
  };
}

/** `GET /klinik/konsultan`: slot bebas = jadwal mingguan dikurangi slot poli yang sudah penuh atau dipesan tiket aktif. */
export function direktoriKlinik(state = {}, hari = 14) {
  const tanggalList = tanggalDapatDipesan(new Date(), hari);
  const terpakaiPoli = new Set(KLINIK_POLI.flatMap((poli) => tanggalList.map((tanggal) => `${poli.id}|${tanggal}|${SLOT_SUDAH_PENUH}`)));
  const terpakaiPendamping = new Set();
  for (const tiket of (state.tiket ?? []).filter((item) => item.status !== "batal")) {
    terpakaiPoli.add(`${tiket.poli}|${tiket.jadwalTanggal}|${tiket.jadwalSlot}`);
    if (tiket.pendamping) terpakaiPendamping.add(`${tiket.pendamping}|${tiket.jadwalTanggal}|${tiket.jadwalSlot}`);
  }
  return {
    rentang: { dari: tanggalList[0] ?? null, sampai: tanggalList.at(-1) ?? null },
    konsultan: KLINIK_KONSULTAN.map((konsultan) => {
      const poli = KLINIK_POLI.find((item) => item.id === konsultan.poli);
      const ketersediaan = ketersediaanKonsultan(konsultan, tanggalList, { terpakaiPoli, terpakaiPendamping });
      return {
        id: konsultan.id,
        nama: konsultan.nama,
        poli: { id: poli.id, kode: poli.kode, nama: poli.nama },
        afiliasi: konsultan.afiliasi,
        afiliasiLabel: LABEL_AFILIASI[konsultan.afiliasi],
        hari: konsultan.hari,
        slot: konsultan.slot,
        ketersediaan,
        totalSlotBebas: ketersediaan.reduce((total, tanggal) => total + tanggal.slot.length, 0),
      };
    }),
  };
}

/** Server-rendered clinic reads, mirroring `GET /v1/program/klinik/{poli,slot,statistik,konsultan}` on an untouched database. */
export function klinikApiResponse({ pathname, searchParams }) {
  if (pathname === "/v1/program/klinik/poli") return { data: KLINIK_POLI };
  if (pathname === "/v1/program/klinik/slot") {
    return { data: KLINIK_SLOTS.map((slot) => ({ slot, tersedia: slot !== SLOT_SUDAH_PENUH })) };
  }
  if (pathname === "/v1/program/klinik/statistik") return { data: statistikKlinik() };
  if (pathname === "/v1/program/klinik/konsultan") return { data: direktoriKlinik({}, Number(searchParams?.get("hari") ?? 14)) };
  return null;
}

const ok = (data, status = 200) => ({ status, data });
const gagal = (status, code) => ({ status, code });
const MAX_LAMPIRAN = 3;
const KOLOM = { linkMeet: "link_meet", actionPlan: "action_plan" };
const KOLOM_UPDATE = ["status", "prioritas", "pendamping", "linkMeet", "actionPlan", "catatan", "diagnosis", "rujukan"];

const NAMA_PERAN = { provinsi: "Analis Provinsi", kabkota: "Analis Daerah", pendamping: "Pendamping" };
/** Nama petugas di jejak outcome: `aktor.nama` bila tes memberinya, selain itu nama akun mock perannya. */
const namaAktor = (actor) => actor.nama ?? NAMA_PERAN[actor.peran] ?? "Petugas";

const labelItems = (items) => items.map((item) => ({ ...item, label: ATRIBUT_OUTCOME[item.atribut] ?? item.atribut }));
const outcomeTiket = (state, tiketId) => (state.outcomes ?? []).filter((baris) => baris.tiket === tiketId).sort((a, b) => b.versi - a.versi)[0] ?? null;

/** DTO outcome untuk petugas: id pengaju tidak ikut terkirim, `aksi` dihitung oleh aturan server. */
function dtoOutcome(actor, baris) {
  return {
    id: baris.id,
    versi: baris.versi,
    status: baris.status,
    statusLabel: LABEL_STATUS_OUTCOME[baris.status] ?? baris.status,
    diajukanNama: baris.diajukanNama,
    diajukanPada: baris.diajukanPada,
    diverifikasiNama: baris.diverifikasiNama,
    diverifikasiPada: baris.diverifikasiPada,
    dicabutNama: baris.dicabutNama,
    dicabutPada: baris.dicabutPada,
    alasanCabut: baris.alasanCabut,
    items: labelItems(baris.items),
    aksi: aksiOutcomeUntuk(actor, { status: baris.status, diajukanOleh: baris.diajukanOleh }, baris.kotaId),
  };
}

/** Staff DTO of a stored ticket: what the endpoint adds on top of the row (`transisi`, `statusLabel`, `versi`, `outcome`). */
function dtoTiket(state, actor, item) {
  const dengan = { ...item, kotaId: item.kotaId ?? null };
  const terbaru = outcomeTiket(state, item.id);
  const outcome = terbaru ? dtoOutcome(actor, terbaru) : null;
  return {
    ...item,
    versi: item.versi ?? VERSI_AWAL,
    statusLabel: statusLabel(item.status),
    transisi: transisiUntuk(actor, dengan),
    outcome,
    // Cermin `toTiketDto`: tiket selesai milik usaha terdaftar tanpa outcome hidup, oleh petugas yang boleh mengubahnya.
    outcomeBisaDicatat: item.status === "selesai" && Boolean(item.usaha) && (!outcome || outcome.status === "dicabut") && bolehUbah(actor, dengan, {}),
  };
}

/** Cermin `catatDalamTransaksi`: penolakan, jawaban retry, atau null bila outcome baru boleh dibuat. */
function periksaOutcome(state, tiket, items) {
  if (!tiket.usaha) return gagal(409, "USAHA_TIDAK_TERTAUT");
  if (tiket.status !== "selesai") return gagal(409, "TIKET_BELUM_SELESAI");
  const terbaru = outcomeTiket(state, tiket.id);
  if (terbaru && terbaru.status !== "dicabut") {
    return sidikOutcome(terbaru.items) === sidikOutcome(items) ? ok({ id: terbaru.id, duplikat: true }) : gagal(409, "OUTCOME_SUDAH_ADA");
  }
  return null;
}

/** Baris outcome baru (versi berikutnya tiket itu); yang sudah terverifikasi langsung membawa verifikatornya. */
function sisipkanOutcome(state, actor, tiket, items, { status = "diajukan", menggantikan = null } = {}) {
  state.outcomes ??= [];
  const sekarang = new Date().toISOString();
  const baris = {
    id: `dddddddd-dddd-4ddd-8ddd-${String(state.outcomes.length + 1).padStart(12, "0")}`,
    tiket: tiket.id,
    usaha: tiket.usaha,
    kotaId: tiket.kotaId ?? null,
    nomorTiket: tiket.nomor,
    namaUsaha: tiket.namaUsaha,
    poli: tiket.poliNama,
    versi: (outcomeTiket(state, tiket.id)?.versi ?? 0) + 1,
    status,
    diajukanOleh: actor.id,
    diajukanNama: namaAktor(actor),
    diajukanPada: sekarang,
    diverifikasiNama: status === "terverifikasi" ? namaAktor(actor) : null,
    diverifikasiPada: status === "terverifikasi" ? sekarang : null,
    dicabutNama: null,
    dicabutPada: null,
    alasanCabut: null,
    items: items.map(({ atribut, jenis }) => ({ atribut, jenis })).sort((a, b) => a.atribut.localeCompare(b.atribut)),
    menggantikan,
  };
  state.outcomes.push(baris);
  return baris;
}

const alasanValid = (alasan) => String(alasan ?? "").trim().length >= 5;
const kolomKeCamel = (atribut) => atribut.replace(/_([a-z])/g, (_, huruf) => huruf.toUpperCase());

/** `hasilKonsultasi` pada profil usaha: hanya outcome terverifikasi, tanpa catatan sesi (cermin `getHasilKonsultasi`). */
export function hasilKonsultasiProfil(state, usahaId) {
  return (state.outcomes ?? [])
    .filter((baris) => baris.usaha === usahaId && baris.status === "terverifikasi")
    .sort((a, b) => b.diverifikasiPada.localeCompare(a.diverifikasiPada) || b.versi - a.versi)
    .map((baris) => ({
      id: baris.id,
      versi: baris.versi,
      nomorTiket: baris.nomorTiket,
      poli: baris.poli,
      diverifikasiOleh: baris.diverifikasiNama,
      diverifikasiPada: baris.diverifikasiPada,
      items: baris.items.map((item) => ({ atribut: kolomKeCamel(item.atribut), jenis: item.jenis })),
    }));
}

const slotTerisi = (state, poli, tanggal) => [
  SLOT_SUDAH_PENUH,
  ...state.tiket.filter((t) => Number(t.poli) === poli && t.jadwalTanggal === tanggal && t.status !== "batal").map((t) => t.jadwalSlot),
];

/**
 * Answers `/v1/program/klinik/*` for the browser mock, or null for a path this stand-in does not own.
 * `form` is the parsed multipart body of `POST /tiket`; `state.aktor` overrides the signed-in officer.
 * Returns `{ status, data }` or `{ status, code }` for an error.
 */
export function klinikMockResponse({ method, path, query = {}, body, form, state }) {
  const actor = state.aktor ?? AKTOR_MOCK;
  let match;

  if (method === "GET" && path === "/klinik/poli") return ok(KLINIK_POLI);
  if (method === "GET" && path === "/klinik/statistik") return ok(statistikKlinik(state));
  if (method === "GET" && path === "/klinik/konsultan") {
    const hari = query.hari === undefined ? 14 : Number(query.hari);
    return Number.isInteger(hari) && hari >= 1 && hari <= 30 ? ok(direktoriKlinik(state, hari)) : gagal(400, "HORIZON_TIDAK_VALID");
  }
  if (method === "GET" && path === "/klinik/prefill") return state.prefill ? ok(state.prefill) : gagal(401, "AUTHENTICATION_REQUIRED");

  if (method === "GET" && path === "/klinik/slot") {
    const poli = Number(query.poli);
    if (!Number.isInteger(poli) || poli < 1) return gagal(400, "POLI_TIDAK_VALID");
    const alasan = tanggalTidakValid(String(query.tanggal ?? ""));
    if (alasan) return gagal(400, alasan);
    const terisi = slotTerisi(state, poli, query.tanggal);
    return ok(KLINIK_SLOTS.map((slot) => ({ slot, tersedia: !terisi.includes(slot) })));
  }

  if (method === "POST" && path === "/klinik/tiket") {
    state.tiketForms.push(form);
    const payload = form.payload ?? {};
    const whatsapp = normalisasiTelepon(payload.whatsapp);
    const poli = KLINIK_POLI.find((item) => item.id === Number(payload.poli));
    const alasan = tanggalTidakValid(String(payload.tanggal ?? ""));
    if (!state.prefill?.usaha && !String(payload.namaUsaha ?? "").trim()) return gagal(400, "INVALID_PAYLOAD");
    if (!String(payload.namaKontak ?? "").trim() || !whatsapp || String(payload.deskripsi ?? "").trim().length < 20) return gagal(400, "INVALID_PAYLOAD");
    if (typeof payload.consent !== "boolean" || !["daring", "luring"].includes(payload.moda) || !SLOTS.includes(payload.slot)) return gagal(400, "INVALID_PAYLOAD");
    if (alasan) return gagal(400, alasan);
    if (form.files.length > MAX_LAMPIRAN) return gagal(400, "LAMPIRAN_TERLALU_BANYAK");
    if (!form.captcha) return gagal(400, "CAPTCHA_INVALID");
    if (!poli) return gagal(400, "POLI_TIDAK_VALID");
    if (slotTerisi(state, poli.id, payload.tanggal).includes(payload.slot)) return gagal(409, "SLOT_PENUH");
    // The outbox only exists when the applicant consented; nothing claims delivery without a gateway.
    const notifikasi = payload.consent ? { status: "pending", label: "Menunggu dikirim" } : { status: "batal", label: "Tidak dikirim" };
    const urutan = state.tiketForms.length - 1;
    const nomor = `KLN-2026-09-${String(42 + urutan).padStart(4, "0")}`;
    const sumberIdentitas = state.prefill?.usaha ? "sidt" : "manual";
    // Keep the booked ticket so the read-back form finds it, exactly like the real table does.
    state.tiket.push({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(42 + urutan).padStart(12, "0")}`,
      nomor,
      usaha: null,
      namaUsaha: state.prefill?.usaha?.nama ?? String(payload.namaUsaha).trim(),
      namaKontak: payload.namaKontak,
      whatsapp,
      email: payload.email ?? null,
      poli: poli.id,
      poliNama: poli.nama,
      deskripsi: payload.deskripsi,
      moda: payload.moda,
      jadwalTanggal: payload.tanggal,
      jadwalSlot: payload.slot,
      prioritas: "normal",
      status: "masuk",
      pendamping: null,
      pendampingNama: null,
      pemohon: null,
      sumberIdentitas,
      waConsent: payload.consent,
      linkMeet: null,
      diagnosis: {},
      actionPlan: null,
      rujukan: [],
      catatan: null,
      lampiran: [],
      notifikasi,
      versi: VERSI_AWAL,
      riwayat: [],
      dateCreated: "2026-09-27T10:00:00Z",
      dateUpdated: "2026-09-27T10:00:00Z",
    });
    return ok({ nomor, poli: poli.nama, moda: payload.moda, tanggal: payload.tanggal, slot: payload.slot, sumberIdentitas, notifikasi }, 201);
  }

  if (method === "POST" && path === "/klinik/tiket/lacak") {
    const nomor = String(body?.nomor ?? "").trim().toUpperCase();
    // A malformed number can never match a ticket, and answers like one that does not exist.
    if (!NOMOR_TIKET.test(nomor)) return gagal(404, "TIKET_TIDAK_DITEMUKAN");
    if (!body?.captcha) return gagal(400, "CAPTCHA_INVALID");
    const whatsapp = normalisasiTelepon(body.whatsapp);
    const tiket = state.tiket.find((item) => item.nomor === nomor && whatsapp && normalisasiTelepon(item.whatsapp) === whatsapp);
    if (!tiket) return gagal(404, "TIKET_TIDAK_DITEMUKAN");
    const sudahMenilai = (state.csat ?? []).some((jawaban) => jawaban.tiket === tiket.id);
    return ok({
      nomor: tiket.nomor,
      namaUsaha: tiket.namaUsaha,
      poli: tiket.poliNama,
      status: tiket.status,
      moda: tiket.moda,
      tanggal: tiket.jadwalTanggal,
      slot: tiket.jadwalSlot,
      sumberIdentitas: tiket.sumberIdentitas ?? "manual",
      notifikasi: tiket.notifikasi ?? { status: "batal", label: "Tidak dikirim" },
      csat: { bisaMenilai: tiket.status === "selesai" && !sudahMenilai, sudahMenilai },
    });
  }

  if (method === "POST" && path === "/klinik/tiket/csat") {
    // Urutan endpoint: nomor, nilai/consent, captcha, lalu tiket (nomor + WhatsApp), status, satu jawaban per tiket.
    const nomor = String(body?.nomor ?? "").trim().toUpperCase();
    if (!NOMOR_TIKET.test(nomor)) return gagal(404, "TIKET_TIDAK_DITEMUKAN");
    const whatsapp = normalisasiTelepon(body.whatsapp);
    const nilai = Number(body.nilai);
    if (!Number.isInteger(nilai) || nilai < 1 || nilai > 5 || typeof body.consent !== "boolean") return gagal(400, "INVALID_PAYLOAD");
    if (!body.captcha) return gagal(400, "CAPTCHA_INVALID");
    const tiket = state.tiket.find((item) => item.nomor === nomor && whatsapp && normalisasiTelepon(item.whatsapp) === whatsapp);
    if (!tiket) return gagal(404, "TIKET_TIDAK_DITEMUKAN");
    if (tiket.status !== "selesai") return gagal(409, "TIKET_BELUM_SELESAI");
    state.csat ??= [];
    if (state.csat.some((jawaban) => jawaban.tiket === tiket.id)) return gagal(409, "CSAT_SUDAH_ADA");
    state.csat.push({ tiket: tiket.id, nilai, consent: body.consent });
    return ok({ nomor, tersimpan: true, dihitung: body.consent }, 201);
  }

  if (method === "GET" && path === "/klinik/tiket") {
    if (query.status !== undefined && !STATUS.includes(query.status)) return gagal(400, "INVALID_PAYLOAD");
    const daftar = state.tiket
      .filter((item) => dalamCakupan(actor, { ...item, kotaId: item.kotaId ?? null }))
      .filter((item) => (query.status ? item.status === query.status : item.status !== "batal"));
    return ok(daftar.map((item) => dtoTiket(state, actor, item)));
  }

  match = path.match(/^\/klinik\/tiket\/([^/]+)$/);
  if (method === "PATCH" && match) {
    const item = state.tiket.find((t) => t.id === match[1]);
    const update = Object.fromEntries(KOLOM_UPDATE.filter((kolom) => body?.[kolom] !== undefined).map((kolom) => [kolom, body[kolom]]));
    if (!Object.keys(update).length) return gagal(400, "INVALID_PAYLOAD");
    // Outcome hanya boleh menyertai penutupan tiket (status selesai); isinya divalidasi oleh aturan endpoint.
    let outcomeItems = null;
    if (body?.outcome !== undefined) {
      try {
        outcomeItems = parseItemsOutcome(body.outcome?.items);
      } catch (error) {
        return gagal(error.statusCode ?? 400, error.code ?? "OUTCOME_TIDAK_VALID");
      }
      if (update.status !== "selesai") return gagal(400, "OUTCOME_TIDAK_VALID");
    }
    if (update.status !== undefined && !STATUS.includes(update.status)) return gagal(400, "INVALID_PAYLOAD");
    if (update.prioritas !== undefined && !PRIORITAS.includes(update.prioritas)) return gagal(400, "INVALID_PAYLOAD");
    if (!item) return gagal(404, "TIKET_TIDAK_DITEMUKAN");
    // Same order as the endpoint: version, officer scope / claim, stage order.
    const versi = item.versi ?? VERSI_AWAL;
    if (body.versi === undefined || body.versi === null) return gagal(400, "INVALID_PAYLOAD");
    if (body.versi !== versi) return gagal(409, "TIKET_BERUBAH");
    if (!bolehUbah(actor, { ...item, kotaId: item.kotaId ?? null }, update)) return gagal(403, "BUKAN_PENUGASAN_ANDA");
    if (update.status !== undefined && !transisiSah(item.status, update.status)) return gagal(409, "TRANSISI_TIDAK_VALID");
    if (update.status === "dijadwalkan" && item.status === "batal" && slotTerisi(state, Number(item.poli), item.jadwalTanggal).includes(item.jadwalSlot)) {
      return gagal(409, "SLOT_PENUH");
    }
    // Outcome dicatat di transaksi yang sama: penolakannya membatalkan seluruh penutupan tiket.
    const periksa = outcomeItems ? periksaOutcome(state, { ...item, status: "selesai" }, outcomeItems) : null;
    if (periksa?.code) return periksa;
    const statusDari = item.status;
    // The audit names the stored columns, exactly like the endpoint does.
    const perubahan = Object.fromEntries(Object.keys(update).map((kolom) => [KOLOM[kolom] ?? kolom, update[kolom]]));
    const jejak = barisAudit({ statusDari, statusKe: update.status, perubahan });
    Object.assign(item, update);
    item.versi = `${versi.slice(0, 17)}${String(state.requests.length % 60).padStart(2, "0")}.000000Z`;
    if (update.pendamping) item.pendampingNama = "Analis Provinsi";
    item.riwayat = [
      ...jejak.reverse().map((baris) => ({ ...baris, aktorNama: "Analis Provinsi", dateCreated: "2026-09-27T10:31:00.000Z" })),
      ...(item.riwayat ?? []),
    ].slice(0, 20);
    if (outcomeItems && !periksa) sisipkanOutcome(state, actor, item, outcomeItems);
    return ok(dtoTiket(state, actor, item));
  }

  // ── Outcome konsultasi (R04): aturan peran, aktor berbeda, dan cakupan wilayah dari rules server ──
  match = path.match(/^\/klinik\/tiket\/([^/]+)\/outcome$/);
  if (method === "POST" && match) {
    let items;
    try {
      items = parseItemsOutcome(body?.items);
    } catch (error) {
      return gagal(error.statusCode ?? 400, error.code ?? "OUTCOME_TIDAK_VALID");
    }
    const item = state.tiket.find((t) => t.id === match[1]);
    // Di luar cakupan sama dengan tidak ada: 404 tidak menjadi oracle keberadaan tiket.
    if (!item || !bolehUbah(actor, { ...item, kotaId: item.kotaId ?? null }, {})) return gagal(404, "TIKET_TIDAK_DITEMUKAN");
    const periksa = periksaOutcome(state, item, items);
    if (periksa) return periksa;
    return ok({ id: sisipkanOutcome(state, actor, item, items).id, duplikat: false }, 201);
  }

  const verifikator = actor.admin || ["provinsi", "kabkota"].includes(actor.peran);
  if (method === "GET" && path === "/klinik/outcome") {
    if (!verifikator) return gagal(403, "FORBIDDEN");
    if (query.status !== undefined && !STATUS_OUTCOME.includes(query.status)) return gagal(400, "INVALID_PAYLOAD");
    if (actor.peran === "kabkota" && !actor.admin && actor.kotaId == null) return gagal(403, "KOTA_NOT_ASSIGNED");
    const daftar = (state.outcomes ?? [])
      .filter((baris) => baris.status === (query.status ?? "diajukan") && bolehVerifikasiOutcome(actor, baris.kotaId))
      .sort((a, b) => a.diajukanPada.localeCompare(b.diajukanPada) || a.id.localeCompare(b.id));
    return ok(daftar.map((baris) => ({ ...dtoOutcome(actor, baris), nomorTiket: baris.nomorTiket, namaUsaha: baris.namaUsaha, poli: baris.poli })));
  }

  match = path.match(/^\/klinik\/outcome\/([^/]+)\/(verifikasi|koreksi|cabut)$/);
  if (method === "POST" && match) {
    const [, id, tindakan] = match;
    if (!verifikator) return gagal(403, "FORBIDDEN");
    let items = null;
    if (tindakan === "koreksi") {
      try {
        items = parseItemsOutcome(body?.items);
      } catch (error) {
        return gagal(error.statusCode ?? 400, error.code ?? "OUTCOME_TIDAK_VALID");
      }
    }
    if (tindakan !== "verifikasi" && !alasanValid(body?.alasan)) return gagal(400, "OUTCOME_TIDAK_VALID");
    const baris = (state.outcomes ?? []).find((item) => item.id === id);
    if (!baris || !bolehVerifikasiOutcome(actor, baris.kotaId)) return gagal(404, "OUTCOME_TIDAK_DITEMUKAN");
    const sekarang = new Date().toISOString();
    const hasil = (row, duplikat) => ok({ id: row.id, versi: row.versi, status: row.status, duplikat });

    if (tindakan === "verifikasi") {
      if (baris.status === "terverifikasi") return hasil(baris, true);
      if (baris.status === "dicabut") return gagal(409, "OUTCOME_DICABUT");
      if (baris.diajukanOleh === actor.id) return gagal(409, "VERIFIKATOR_SAMA");
      Object.assign(baris, { status: "terverifikasi", diverifikasiNama: namaAktor(actor), diverifikasiPada: sekarang });
      return hasil(baris, false);
    }
    if (tindakan === "cabut") {
      if (baris.status === "dicabut") return hasil(baris, true);
      Object.assign(baris, { status: "dicabut", dicabutNama: namaAktor(actor), dicabutPada: sekarang, alasanCabut: String(body.alasan).trim() });
      return hasil(baris, false);
    }
    // koreksi
    if (baris.status === "dicabut") {
      const pengganti = state.outcomes.find((row) => row.menggantikan === baris.id);
      return pengganti && sidikOutcome(pengganti.items) === sidikOutcome(items) ? hasil(pengganti, true) : gagal(409, "OUTCOME_DICABUT");
    }
    if (sidikOutcome(baris.items) === sidikOutcome(items)) return gagal(409, "OUTCOME_TIDAK_BERUBAH");
    const tiket = state.tiket.find((t) => t.id === baris.tiket) ?? { id: baris.tiket, usaha: baris.usaha, kotaId: baris.kotaId, nomor: baris.nomorTiket, namaUsaha: baris.namaUsaha, poliNama: baris.poli };
    // Yang lama keluar dulu (satu outcome hidup per tiket), lalu versi baru langsung terverifikasi oleh pengoreksi.
    const baru = sisipkanOutcome(state, actor, tiket, items, { status: "terverifikasi", menggantikan: baris.id });
    Object.assign(baris, {
      status: "dicabut",
      dicabutNama: namaAktor(actor),
      dicabutPada: sekarang,
      alasanCabut: `Dikoreksi ke versi ${baru.versi}: ${String(body.alasan).trim()}`.slice(0, 500),
    });
    return hasil(baru, false);
  }

  return null;
}

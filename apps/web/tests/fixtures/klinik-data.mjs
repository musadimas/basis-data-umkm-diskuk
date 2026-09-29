/**
 * Clinic fixtures shared by the browser mock (`mock-program.mjs`) and the SSR mock server
 * (`mock-directus-server.mjs`): the six desks are server-rendered by `GET /v1/program/klinik/poli`,
 * so both sides have to answer with the same content.
 *
 * `klinikMockResponse` stands in for the staff and booking endpoints. It only keeps state: every
 * rule (stage order, scope, claim, audit rows, phone normalisation, dates, slot quota) is imported
 * from the real endpoint's pure rules, like `kegiatan-data.mjs`, so the mock cannot drift.
 */
import {
  NOMOR_TIKET,
  PRIORITAS,
  SLOTS,
  STATUS,
  barisAudit,
  bolehUbah,
  dalamCakupan,
  normalisasiTelepon,
  statusLabel,
  tanggalTidakValid,
  transisiSah,
  transisiUntuk,
} from "../../../../services/directus/extensions/program/src/endpoints/klinik/rules.js";

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

/** Server-rendered clinic reads, mirroring `GET /v1/program/klinik/{poli,slot}`. */
export function klinikApiResponse({ pathname }) {
  if (pathname === "/v1/program/klinik/poli") return { data: KLINIK_POLI };
  if (pathname === "/v1/program/klinik/slot") {
    return { data: KLINIK_SLOTS.map((slot) => ({ slot, tersedia: slot !== SLOT_SUDAH_PENUH })) };
  }
  return null;
}

const ok = (data, status = 200) => ({ status, data });
const gagal = (status, code) => ({ status, code });
const MAX_LAMPIRAN = 3;
const KOLOM = { linkMeet: "link_meet", actionPlan: "action_plan" };
const KOLOM_UPDATE = ["status", "prioritas", "pendamping", "linkMeet", "actionPlan", "catatan", "diagnosis", "rujukan"];

/** Staff DTO of a stored ticket: what the endpoint adds on top of the row (`transisi`, `statusLabel`, `versi`). */
function dtoTiket(actor, item) {
  return { ...item, versi: item.versi ?? VERSI_AWAL, statusLabel: statusLabel(item.status), transisi: transisiUntuk(actor, { ...item, kotaId: item.kotaId ?? null }) };
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
    });
  }

  if (method === "GET" && path === "/klinik/tiket") {
    if (query.status !== undefined && !STATUS.includes(query.status)) return gagal(400, "INVALID_PAYLOAD");
    const daftar = state.tiket
      .filter((item) => dalamCakupan(actor, { ...item, kotaId: item.kotaId ?? null }))
      .filter((item) => (query.status ? item.status === query.status : item.status !== "batal"));
    return ok(daftar.map((item) => dtoTiket(actor, item)));
  }

  match = path.match(/^\/klinik\/tiket\/([^/]+)$/);
  if (method === "PATCH" && match) {
    const item = state.tiket.find((t) => t.id === match[1]);
    const update = Object.fromEntries(KOLOM_UPDATE.filter((kolom) => body?.[kolom] !== undefined).map((kolom) => [kolom, body[kolom]]));
    if (!Object.keys(update).length) return gagal(400, "INVALID_PAYLOAD");
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
    return ok(dtoTiket(actor, item));
  }

  return null;
}

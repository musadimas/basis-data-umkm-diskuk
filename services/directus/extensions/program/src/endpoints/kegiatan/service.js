// Public agenda service (Y07/M7-07…M7-10). The list/detail DTOs, the temporal status, the counts
// and the filter options are all computed here, on the server, from the published rows only.
// Reminder opt-ins (WhatsApp/email) are *subscriptions* (`menunggu | dijadwalkan | dibatalkan`):
// when one falls due, jadwalkanPengingatJatuhTempo enqueues the rendered message into the shared
// outbox (lib/outbox), which owns delivery, retries and receipts.
import { requireCaptcha } from "../../lib/captcha.js";
import { ProgramError, rows } from "../../lib/utils/http.js";
import { gabungkanPenyelenggara, opsiPenyelenggaraTetap } from "../../lib/wilayah.js";
import { whatsappConfigured } from "../../lib/whatsapp.js";
import { pesanPengingat } from "./pesan.js";
import {
  KANAL_PENGINGAT,
  KATEGORI_KEGIATAN,
  METODE_KEGIATAN,
  kelompokStatus,
  labelKategori,
  labelMetode,
  labelStatus,
  maskTujuan,
  normalisasiTujuan,
  parseJadwalKirim,
  parseQueryKegiatan,
  rentangWindow,
  sisaKuota,
  statusKegiatan,
  tautanAman,
} from "./rules.js";

const KEGIATAN_COLUMNS = `
  id, judul, ringkasan, kategori, penyelenggara, kota_nama, metode, ramah_disabilitas,
  tanggal_mulai, tanggal_selesai, batas_registrasi, lokasi, link, kuota, terisi,
  silabus, narasumber, fasilitas, syarat, syarat_skala, syarat_wilayah, syarat_nib,
  poster, registration_url, dokumen_url, materi_url, pendaftaran_internal, butuh_pakta_integritas
`;

/** Hard ceiling for one list response; reported as `terpotong` instead of silently truncating. */
export const BATAS_BARIS = 500;

const iso = (value) => {
  if (value === null || value === undefined) return null;
  const time = value instanceof Date ? value : new Date(value);
  return Number.isFinite(time.getTime()) ? time.toISOString() : null;
};

const angka = (value) => (value === null || value === undefined ? null : Number(value));

/** One published event as the public API exposes it — allowlist only, no internal columns. */
export function toKegiatanDto(row, now = new Date()) {
  const kuota = angka(row.kuota);
  const dto = {
    id: row.id,
    judul: row.judul,
    ringkasan: row.ringkasan ?? null,
    kategori: row.kategori,
    kategoriLabel: labelKategori(row.kategori),
    penyelenggara: row.penyelenggara ?? null,
    kotaNama: row.kota_nama ?? null,
    metode: row.metode,
    metodeLabel: labelMetode(row.metode),
    ramahDisabilitas: Boolean(row.ramah_disabilitas),
    tanggalMulai: iso(row.tanggal_mulai),
    tanggalSelesai: iso(row.tanggal_selesai),
    batasRegistrasi: iso(row.batas_registrasi),
    lokasi: row.lokasi ?? null,
    tautanDaring: tautanAman(row.link),
    kuota,
    terisi: Number(row.terisi ?? 0),
    silabus: row.silabus ?? null,
    narasumber: row.narasumber ?? null,
    fasilitas: row.fasilitas ?? null,
    syarat: {
      skala: row.syarat_skala ?? null,
      wilayah: row.syarat_wilayah ?? null,
      nib: Boolean(row.syarat_nib),
      catatan: row.syarat ?? null,
    },
    poster: row.poster ?? null,
    registrationUrl: tautanAman(row.registration_url),
    dokumenUrl: tautanAman(row.dokumen_url),
    materiUrl: tautanAman(row.materi_url),
    pendaftaranInternal: Boolean(row.pendaftaran_internal),
    butuhPaktaIntegritas: Boolean(row.butuh_pakta_integritas),
  };
  dto.sisaKuota = sisaKuota(dto);
  dto.status = statusKegiatan(dto, now);
  dto.statusLabel = labelStatus(dto.status);
  return dto;
}

/** Filter options of the agenda: the five brief categories, the three methods and the 27 dinas. */
export async function opsiKegiatan(database) {
  const hasil = await database.raw(
    `SELECT DISTINCT penyelenggara FROM kegiatan
      WHERE status_publikasi = 'terbit' AND penyelenggara IS NOT NULL AND penyelenggara <> ''
      ORDER BY penyelenggara`,
  );
  return {
    kategori: KATEGORI_KEGIATAN.map((item) => ({ ...item })),
    metode: METODE_KEGIATAN.map((item) => ({ ...item })),
    penyelenggara: gabungkanPenyelenggara(opsiPenyelenggaraTetap(), rows(hasil).map((row) => row.penyelenggara)),
  };
}

/**
 * GET list: bulan/tahun window (or the agenda window), the four filters of M7-08 and the temporal
 * status, all applied on the server. `meta.kelompok` counts what the timeline will show.
 */
export async function listKegiatan(database, query = {}, now = new Date()) {
  const filter = parseQueryKegiatan(query);
  const { dari, sampai } = rentangWindow(filter, now);
  const kondisi = ["status_publikasi = 'terbit'", "tanggal_selesai >= ?", "tanggal_mulai < ?"];
  const params = [dari, sampai];

  if (filter.kategori.length) {
    kondisi.push(`kategori IN (${filter.kategori.map(() => "?").join(", ")})`);
    params.push(...filter.kategori);
  }
  if (filter.penyelenggara.length) {
    kondisi.push(`penyelenggara IN (${filter.penyelenggara.map(() => "?").join(", ")})`);
    params.push(...filter.penyelenggara);
  }
  if (filter.metode) {
    kondisi.push("metode = ?");
    params.push(filter.metode);
  }
  if (filter.ramah) kondisi.push("ramah_disabilitas = TRUE");

  const hasil = await database.raw(
    `SELECT ${KEGIATAN_COLUMNS} FROM kegiatan
      WHERE ${kondisi.join(" AND ")}
      ORDER BY tanggal_mulai, judul
      LIMIT ${BATAS_BARIS + 1}`,
    params,
  );
  const semua = rows(hasil).map((row) => toKegiatanDto(row, now));
  const terpotong = semua.length > BATAS_BARIS;
  const dibatasi = terpotong ? semua.slice(0, BATAS_BARIS) : semua;
  const data = filter.status.length ? dibatasi.filter((item) => filter.status.includes(item.status)) : dibatasi;

  return {
    data,
    meta: {
      serverNow: now.toISOString(),
      jumlah: data.length,
      terpotong,
      kelompok: kelompokStatus(data),
      bulan: filter.bulan,
      tahun: filter.tahun,
      opsi: await opsiKegiatan(database),
    },
  };
}

/** GET detail of one published event; cancelled or draft events are not public. */
export async function detailKegiatan(database, kegiatanId, now = new Date()) {
  const hasil = await database.raw(
    `SELECT ${KEGIATAN_COLUMNS} FROM kegiatan WHERE id = ? AND status_publikasi = 'terbit'`,
    [kegiatanId],
  );
  const row = rows(hasil)[0];
  if (!row) throw new ProgramError(404, "KEGIATAN_NOT_FOUND", "The event was not found.");
  return { data: toKegiatanDto(row, now) };
}

/**
 * Status shown to the visitor. It stays in the vocabulary the web already knows: a WhatsApp
 * subscription without a gateway is reported as `menunggu_gateway` (derived, never stored), so the
 * API does not promise a delivery a channel without an adapter cannot make (Y07).
 */
const statusTampil = (row, env) =>
  row.status === "menunggu" && row.kanal === "whatsapp" && !whatsappConfigured(env) ? "menunggu_gateway" : row.status;

/**
 * POST opt-in: the visitor asks for a WhatsApp/email reminder. The captcha guards the write, the
 * address is normalised (invalid numbers/emails are refused) and the (event, channel, address)
 * index makes a double click or a retry update the same row instead of queueing a second message.
 */
export async function optInPengingat(database, env, kegiatanId, body, now = new Date(), outbox) {
  const kanal = KANAL_PENGINGAT.includes(body?.kanal) ? body.kanal : null;
  if (!kanal) throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "kanal" is not valid.');
  const tujuan = normalisasiTujuan(kanal, body?.tujuan);

  const hasil = await database.raw(
    `SELECT id, judul, tanggal_mulai, tanggal_selesai, batas_registrasi, kuota, terisi, status_publikasi
       FROM kegiatan WHERE id = ?`,
    [kegiatanId],
  );
  const event = rows(hasil)[0];
  if (!event || event.status_publikasi !== "terbit") {
    throw new ProgramError(404, "KEGIATAN_NOT_FOUND", "The event was not found.");
  }
  const status = statusKegiatan(
    { tanggalMulai: event.tanggal_mulai, tanggalSelesai: event.tanggal_selesai, batasRegistrasi: event.batas_registrasi, kuota: event.kuota, terisi: event.terisi },
    now,
  );
  if (status === "selesai") throw new ProgramError(409, "KEGIATAN_SELESAI", "The event has already finished.");
  const jadwal = parseJadwalKirim(body?.jadwalKirim, { tanggalMulai: event.tanggal_mulai, tanggalSelesai: event.tanggal_selesai }, now);

  // The single-use captcha is consumed last: a request refused for the event's state or schedule
  // keeps the visitor's captcha valid for another attempt.
  await requireCaptcha(database, env, body?.captcha);

  // Asking again restarts the subscription: a message still waiting in the outbox for the previous
  // schedule is cancelled in the same transaction, so the new schedule is the only one that fires.
  const tersimpan = await database.transaction(async (trx) => {
    const simpan = await trx.raw(
      `INSERT INTO kegiatan_pengingat (kegiatan, kanal, tujuan, tujuan_masked, jadwal_kirim)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (kegiatan, kanal, tujuan) DO UPDATE
          SET jadwal_kirim = EXCLUDED.jadwal_kirim,
              status = 'menunggu',
              alasan = NULL,
              dibatalkan_at = NULL,
              date_updated = NOW()
        RETURNING kanal, tujuan_masked, jadwal_kirim, status, token, id`,
      [kegiatanId, kanal, tujuan, maskTujuan(kanal, tujuan), jadwal],
    );
    const baris = rows(simpan)[0];
    await outbox.batalkan(trx, { pengingat: baris.id }, "opt_in_ulang");
    return baris;
  });
  return {
    data: {
      id: tersimpan.id,
      kegiatan: { id: event.id, judul: event.judul },
      kanal: tersimpan.kanal,
      tujuanMasked: tersimpan.tujuan_masked,
      jadwalKirim: iso(tersimpan.jadwal_kirim),
      status: statusTampil(tersimpan, env),
      batalToken: tersimpan.token,
    },
  };
}

/** Masked reminder behind a token, for the confirmation page of the e-mail link. */
export async function lihatPengingat(database, token) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(token ?? ""))) {
    throw new ProgramError(400, "INVALID_PAYLOAD", "The token is not valid.");
  }
  const hasil = await database.raw(`SELECT kanal, tujuan_masked, status, jadwal_kirim FROM kegiatan_pengingat WHERE token = ?`, [token]);
  const row = rows(hasil)[0];
  if (!row) throw new ProgramError(404, "TOKEN_TIDAK_DITEMUKAN", "The reminder was not found.");
  return { data: { kanal: row.kanal, tujuanMasked: row.tujuan_masked, status: row.status, jadwalKirim: iso(row.jadwal_kirim) } };
}

/**
 * Unsubscribe by token (e-mail link page and the in-app button). Idempotent: cancelling twice is
 * not an error, and an unknown token answers 404 without revealing whether it ever existed. A
 * message already queued in the outbox for the subscription is cancelled with it.
 */
export async function batalkanPengingat(database, token, outbox) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(token ?? ""))) {
    throw new ProgramError(400, "INVALID_PAYLOAD", "The token is not valid.");
  }
  const row = await database.transaction(async (trx) => {
    const hasil = await trx.raw(
      `UPDATE kegiatan_pengingat
          SET status = 'dibatalkan', dibatalkan_at = NOW(), alasan = 'pengguna', date_updated = NOW()
        WHERE token = ? AND status <> 'dibatalkan'
        RETURNING id, kanal, tujuan_masked, status, tujuan`,
      [token],
    );
    const baris = rows(hasil)[0];
    if (baris) await outbox.batalkan(trx, { pengingat: baris.id }, "pengguna");
    return baris;
  });
  if (row) return { data: { kanal: row.kanal, tujuanMasked: row.tujuan_masked, status: "dibatalkan", sudah: false } };

  const lama = await database.raw(`SELECT kanal, tujuan_masked, status FROM kegiatan_pengingat WHERE token = ?`, [token]);
  const ada = rows(lama)[0];
  if (!ada) throw new ProgramError(404, "TOKEN_TIDAK_DITEMUKAN", "The reminder was not found.");
  return { data: { kanal: ada.kanal, tujuanMasked: ada.tujuan_masked, status: ada.status, sudah: true } };
}

/**
 * The scheduling half of the reminder job (the outbox does the sending). In one transaction:
 *  - subscriptions of an event that already started expire (`kedaluwarsa`), so a backlog never
 *    announces a past event (B18);
 *  - subscriptions of an event pulled from publication are cancelled, together with any message
 *    they still have waiting in the outbox;
 *  - due subscriptions of published, upcoming events are rendered *now* (so a changed title or
 *    venue is picked up) and enqueued with `kedaluwarsaPada` = event start, then marked
 *    `dijadwalkan`. Rows are locked with SKIP LOCKED, so concurrent instances split the work.
 * Channels without an adapter simply stay `pending` in the outbox: no starvation (B17).
 */
export async function jadwalkanPengingatJatuhTempo({ database, outbox, env = {}, now = new Date(), limit = 50 }) {
  const hasil = { dijadwalkan: 0, dibatalkan: 0, kedaluwarsa: 0 };
  await database.transaction(async (trx) => {
    const kedaluwarsa = await trx.raw(
      `UPDATE kegiatan_pengingat p
          SET status = 'dibatalkan', alasan = 'kedaluwarsa', dibatalkan_at = NOW(), date_updated = NOW()
         FROM kegiatan k
        WHERE k.id = p.kegiatan AND k.tanggal_mulai <= ? AND p.status = 'menunggu'`,
      [now],
    );
    hasil.kedaluwarsa = Number(kedaluwarsa.rowCount ?? 0);

    const ditarik = await trx.raw(
      `UPDATE kegiatan_pengingat p
          SET status = 'dibatalkan', alasan = 'kegiatan_dibatalkan', dibatalkan_at = NOW(), date_updated = NOW()
         FROM kegiatan k
        WHERE k.id = p.kegiatan AND k.status_publikasi <> 'terbit' AND p.status IN ('menunggu', 'dijadwalkan')
        RETURNING p.id`,
    );
    for (const { id } of rows(ditarik)) await outbox.batalkan(trx, { pengingat: id }, "kegiatan_dibatalkan");
    hasil.dibatalkan = rows(ditarik).length;

    const kandidat = await trx.raw(
      `SELECT p.id, p.kanal, p.tujuan, p.jadwal_kirim, p.date_updated, p.token,
              k.judul, k.tanggal_mulai, k.lokasi, k.metode
         FROM kegiatan_pengingat p
         JOIN kegiatan k ON k.id = p.kegiatan
        WHERE p.status = 'menunggu' AND p.jadwal_kirim <= ?
          AND k.status_publikasi = 'terbit' AND k.tanggal_mulai > ?
        ORDER BY p.jadwal_kirim
        LIMIT ?
        FOR UPDATE OF p SKIP LOCKED`,
      [now, now, limit],
    );
    for (const row of rows(kandidat)) {
      // The subscription's own version (date_updated) is part of the key: asking again after a
      // cancellation with the same schedule is a new subscription and must not be swallowed.
      await outbox.enqueue(trx, {
        kunci: `pengingat:${row.id}:${iso(row.jadwal_kirim)}:${new Date(row.date_updated).getTime()}`,
        jenis: "pengingat_kegiatan",
        kanal: row.kanal,
        tujuan: row.tujuan,
        template: "pengingat_kegiatan",
        pesan: pesanPengingat(row, env),
        consent: true,
        sumber: { pengingat: row.id },
        kirimPada: now,
        kedaluwarsaPada: row.tanggal_mulai,
      });
      await trx.raw(`UPDATE kegiatan_pengingat SET status = 'dijadwalkan', alasan = NULL, date_updated = NOW() WHERE id = ?`, [row.id]);
      hasil.dijadwalkan += 1;
    }
  });
  return hasil;
}

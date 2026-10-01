import { ProgramError, rows } from "../../lib/utils/http.js";
import { objectBody, oneOf, optionalText, uuidParam, UUID } from "../../lib/validate.js";
import { capaian, currentWeek, hariLapor, latestTargetStreak, PITCHING_STREAK, waktuLaporan } from "./rules.js";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";

const { predikat } = cakupan;

/** Hanya usaha sendiri yang boleh mengirim; admin (provinsi) lewat jalur kurator. */
export function canSubmit(pemanggil, peserta) {
  return pemanggil?.admin === true || (pemanggil?.usahaId != null && pemanggil.usahaId === peserta.usaha);
}

/** Provinsi atau pendamping yang ditugaskan pada peserta (admin selalu boleh). */
export function canReview(pemanggil, peserta) {
  return (
    pemanggil?.admin === true ||
    pemanggil?.peran === "provinsi" ||
    (peserta.pendamping != null && peserta.pendamping === pemanggil?.id)
  );
}

export function forbidden() {
  return new ProgramError(403, "FORBIDDEN", "You do not have access to this participant.");
}

const LAPORAN_STATUS = ["menunggu", "disetujui", "ditolak"];
const MAX_BUKTI = 5;
/** Ukuran halaman antrean review (BUG-012); klien hanya mengirim nomor halaman. */
export const HALAMAN_ANTREAN = 25;

const PESERTA_SELECT = `
  SELECT p.id, p.usaha, p.batch, p.fase, p.pendamping, p.tanggal_mulai::text AS tanggal_mulai, p.jumlah_minggu,
         p.target_mingguan, p.rekomendasi_pitching, p.status,
         u.nama AS usaha_nama, u.nib AS usaha_nib, u.skala AS usaha_skala, t.kota_nama AS usaha_kota,
         NULLIF(TRIM(CONCAT_WS(' ', pd.first_name, pd.last_name)), '') AS pendamping_nama
    FROM program_peserta p
    JOIN usaha u ON u.id = p.usaha
    LEFT JOIN usaha_tabular t ON t.id = p.usaha
    LEFT JOIN directus_users pd ON pd.id = p.pendamping`;

function toPeserta(row, now) {
  return {
    id: row.id,
    usaha: { id: row.usaha, nama: row.usaha_nama, nib: row.usaha_nib, skala: row.usaha_skala, kota: row.usaha_kota },
    batch: row.batch,
    fase: row.fase,
    pendamping: row.pendamping ? { id: row.pendamping, nama: row.pendamping_nama } : null,
    tanggalMulai: row.tanggal_mulai,
    jumlahMinggu: Number(row.jumlah_minggu),
    mingguBerjalan: currentWeek(row.tanggal_mulai, row.jumlah_minggu, now),
    targetMingguan: Number(row.target_mingguan),
    rekomendasiPitching: Boolean(row.rekomendasi_pitching),
    status: row.status,
  };
}

function toLaporan(row) {
  return {
    id: row.id,
    peserta: row.peserta,
    mingguKe: Number(row.minggu_ke),
    target: Number(row.target),
    realisasiOmzet: Number(row.realisasi_omzet),
    jumlahTransaksi: Number(row.jumlah_transaksi),
    capaianPersen: capaian(row.realisasi_omzet, row.target),
    kendala: row.kendala,
    bukti: row.bukti ?? [],
    status: row.status,
    catatanPendamping: row.catatan_pendamping,
    direviewAt: row.direview_at,
    clientUuid: row.client_uuid,
    dibuatPadaKlien: row.dibuat_pada_klien ?? null,
    dateCreated: row.date_created,
    dateUpdated: row.date_updated,
  };
}

const LAPORAN_SELECT = `
  SELECT l.id, l.peserta, l.minggu_ke, l.target, l.realisasi_omzet, l.jumlah_transaksi, l.kendala,
         l.status, l.catatan_pendamping, l.direview_at, l.client_uuid, l.dibuat_pada_klien, l.date_created, l.date_updated,
         COALESCE((SELECT json_agg(b.directus_files_id ORDER BY b.sort, b.id)
                     FROM kpi_laporan_bukti b WHERE b.kpi_laporan_id = l.id), '[]'::json) AS bukti
    FROM kpi_laporan l`;

/** One participant the pemanggil may see; 404 otherwise (no existence leak). */
async function loadPeserta(database, pemanggil, id, { lock = false } = {}) {
  const scope = predikat(pemanggil, "peserta", "p");
  const row = rows(
    await database.raw(`${PESERTA_SELECT} WHERE p.id = ? AND (${scope.sql})${lock ? " FOR UPDATE OF p" : ""}`, [id, ...scope.bindings]),
  )[0];
  if (!row) throw new ProgramError(404, "PESERTA_NOT_FOUND", "The participant was not found.");
  return row;
}

async function loadLaporanList(database, pesertaId) {
  return rows(await database.raw(`${LAPORAN_SELECT} WHERE l.peserta = ? ORDER BY l.minggu_ke`, [pesertaId])).map(toLaporan);
}

function parseLaporan(body) {
  const minggu = Number(body.mingguKe);
  const omzet = Number(body.realisasiOmzet);
  const transaksi = Number(body.jumlahTransaksi);
  const invalid = (field) => new ProgramError(400, "INVALID_PAYLOAD", `The field "${field}" is not valid.`);
  if (!Number.isInteger(minggu) || minggu < 1) throw invalid("mingguKe");
  if (!Number.isInteger(omzet) || omzet < 0 || omzet > 1e13) throw invalid("realisasiOmzet");
  if (!Number.isInteger(transaksi) || transaksi < 0 || transaksi > 1e7) throw invalid("jumlahTransaksi");
  if (typeof body.clientUuid !== "string" || !UUID.test(body.clientUuid)) throw invalid("clientUuid");
  const bukti = body.bukti ?? [];
  if (!Array.isArray(bukti) || bukti.length > MAX_BUKTI || !bukti.every((id) => typeof id === "string" && UUID.test(id))) {
    throw invalid("bukti");
  }
  if (body.dibuatPada != null && typeof body.dibuatPada !== "string") throw invalid("dibuatPada");
  return {
    mingguKe: minggu,
    realisasiOmzet: omzet,
    jumlahTransaksi: transaksi,
    kendala: optionalText(body, "kendala", 2000),
    clientUuid: body.clientUuid,
    bukti: [...new Set(bukti)],
    dibuatPada: body.dibuatPada ?? null,
  };
}

async function replaceBukti(trx, laporanId, bukti) {
  await trx.raw(`DELETE FROM kpi_laporan_bukti WHERE kpi_laporan_id = ?`, [laporanId]);
  for (const [index, fileId] of bukti.entries()) {
    await trx.raw(`INSERT INTO kpi_laporan_bukti (kpi_laporan_id, directus_files_id, sort) VALUES (?, ?, ?)`, [laporanId, fileId, index + 1]);
  }
}

/**
 * Evidence must be the caller's own images (B32): a bare file UUID is not proof of anything, and
 * another account's file must not become someone's evidence. Checked inside the transaction that
 * records the report, before any row is written.
 */
async function assertBukti(trx, bukti, actorId) {
  if (!bukti.length) return;
  const result = await trx.raw(
    `SELECT f.id FROM directus_files f
      WHERE f.id = ANY(ARRAY(SELECT jsonb_array_elements_text(?::jsonb)::uuid))
        AND f.uploaded_by = ?
        AND f.type LIKE 'image/%'`,
    [JSON.stringify(bukti), actorId],
  );
  const ditemukan = new Set(rows(result).map((row) => row.id));
  if (bukti.some((id) => !ditemukan.has(id))) {
    throw new ProgramError(400, "BUKTI_TIDAK_VALID", "Every evidence file must be an image uploaded by you.");
  }
}

/** Nomor halaman 1-based dari query; selain bilangan bulat positif → 400. */
function nomorHalaman(query) {
  const raw = query.page ?? "1";
  if (typeof raw !== "string" || !/^[1-9][0-9]{0,5}$/.test(raw)) {
    throw new ProgramError(400, "INVALID_PAGE", 'The query "page" must be a positive integer.');
  }
  return Number(raw);
}

/**
 * Use case KPI mingguan. Validasi, transaksi, dan urutan aturan dimiliki di sini; adapter HTTP
 * (`index.js`) hanya memetakan request/response. Setiap verb menerima `pemanggil`
 * (`{ id, admin, peran, kotaId, usahaId }`), mengembalikan data, dan gagal dengan `ProgramError`.
 */
export function createKpi({ db, clock = () => new Date() }) {
  return { listPeserta, bacaPeserta, kirimLaporan, listLaporan, reviewLaporan, setPitching };

  /** Peserta aktif yang boleh dilihat pemanggil, dengan status laporan minggu ini. */
  async function listPeserta(pemanggil) {
    const scope = predikat(pemanggil, "peserta", "p");
    const now = clock();
    const result = await db.raw(
      `${PESERTA_SELECT} WHERE p.status = 'aktif' AND (${scope.sql}) ORDER BY u.nama LIMIT 1000`,
      scope.bindings,
    );
    const peserta = rows(result).map((row) => toPeserta(row, now));
    const reports = peserta.length
      ? rows(
          await db.raw(
            `SELECT peserta, minggu_ke, status FROM kpi_laporan
              WHERE peserta IN (SELECT jsonb_array_elements_text(?::jsonb)::uuid)`,
            [JSON.stringify(peserta.map((item) => item.id))],
          ),
        )
      : [];
    return peserta.map((item) => {
      const own = reports.filter((report) => report.peserta === item.id);
      const thisWeek = own.find((report) => Number(report.minggu_ke) === item.mingguBerjalan);
      return {
        ...item,
        laporanTerkirim: own.length,
        statusMingguIni: item.mingguBerjalan === 0 ? null : (thisWeek?.status ?? "belum_mengirim"),
      };
    });
  }

  /** Peserta, seluruh laporan mingguan, dan streak pitching. */
  async function bacaPeserta(pemanggil, pesertaId) {
    const id = uuidParam(pesertaId);
    const row = await loadPeserta(db, pemanggil, id);
    const laporan = await loadLaporanList(db, id);
    const streak = latestTargetStreak(laporan);
    return {
      peserta: toPeserta(row, clock()),
      laporan,
      pitching: { streak, dibutuhkan: PITCHING_STREAK, memenuhi: streak >= PITCHING_STREAK },
      akses: { kirim: canSubmit(pemanggil, row), review: canReview(pemanggil, row) },
    };
  }

  /**
   * Kirim laporan satu minggu. Urutan: validasi -> kunci peserta + scope -> canSubmit -> duplikat
   * client_uuid (setelah kunci) -> bukti -> waktu laporan -> minggu -> Jumat (laporan baru) ->
   * insert atau revisi.
   * Laporan baru hanya dibuat pada Jumat WIB (M5-03). Draf offline membawa `dibuatPada` (jam
   * perangkat) dan sah bila jatuh pada Jumat, tidak di masa depan, dan paling lama 7 hari; waktu itu
   * disimpan sebagai provenance. Replay clientUuid dan revisi laporan ditolak tidak terikat hari.
   * Keluaran `{ hasil: "dibuat" | "diulang" | "direvisi", laporan }`. Mengirim ulang clientUuid yang
   * sama mengembalikan laporan tersimpan ("diulang"); laporan ditolak diperbaiki di tempat ("direvisi").
   */
  async function kirimLaporan(pemanggil, pesertaId, body) {
    const id = uuidParam(pesertaId);
    const input = parseLaporan(objectBody({ body }));
    try {
      return await db.transaction(async (trx) => {
        // Kunci peserta dan cek scope lebih dulu (B21): replay tidak boleh dikembalikan
        // sebelum pemanggil terbukti boleh melihat peserta, dan retry paralel menyerialkan
        // diri pada baris peserta sebelum mencari duplikat clientUuid.
        const peserta = await loadPeserta(trx, pemanggil, id, { lock: true });
        if (!canSubmit(pemanggil, peserta)) throw forbidden();
        if (peserta.status !== "aktif") throw new ProgramError(409, "PESERTA_TIDAK_AKTIF", "The participant is no longer active.");
        const duplicate = rows(await trx.raw(`${LAPORAN_SELECT} WHERE l.client_uuid = ?`, [input.clientUuid]))[0];
        if (duplicate) {
          if (duplicate.peserta !== id) throw new ProgramError(409, "CLIENT_UUID_CONFLICT", "This report id belongs to another participant.");
          return { hasil: "diulang", laporan: toLaporan(duplicate) };
        }
        await assertBukti(trx, input.bukti, pemanggil.id);
        const waktu = waktuLaporan(input.dibuatPada, clock());
        if (!waktu) {
          throw new ProgramError(400, "DIBUAT_PADA_TIDAK_VALID", "The report's creation time is in the future or too old to sync.");
        }
        const week = currentWeek(peserta.tanggal_mulai, peserta.jumlah_minggu, waktu.waktu);
        if (input.mingguKe > Number(peserta.jumlah_minggu) || input.mingguKe > week) {
          throw new ProgramError(400, "MINGGU_TIDAK_VALID", "Reports can only be sent for weeks that have started.");
        }
        const existing = rows(
          await trx.raw(`SELECT id, status FROM kpi_laporan WHERE peserta = ? AND minggu_ke = ? FOR UPDATE`, [id, input.mingguKe]),
        )[0];
        let laporanId;
        if (existing) {
          if (existing.status !== "ditolak") {
            throw new ProgramError(409, "LAPORAN_SUDAH_ADA", "A report for this week has already been sent.");
          }
          await trx.raw(
            `UPDATE kpi_laporan
                SET realisasi_omzet = ?, jumlah_transaksi = ?, kendala = ?, client_uuid = ?, target = ?,
                    status = 'menunggu', dikirim_oleh = ?, dibuat_pada_klien = ?, date_updated = NOW()
              WHERE id = ?`,
            [input.realisasiOmzet, input.jumlahTransaksi, input.kendala, input.clientUuid, peserta.target_mingguan, pemanggil.id, waktu.klien, existing.id],
          );
          laporanId = existing.id;
        } else {
          if (!hariLapor(waktu.waktu)) {
            throw new ProgramError(409, "BUKAN_HARI_LAPOR", "Weekly reports can only be made on Friday (Asia/Jakarta).");
          }
          laporanId = rows(
            await trx.raw(
              `INSERT INTO kpi_laporan
                 (peserta, minggu_ke, target, realisasi_omzet, jumlah_transaksi, kendala, client_uuid, dikirim_oleh, dibuat_pada_klien)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
              [id, input.mingguKe, peserta.target_mingguan, input.realisasiOmzet, input.jumlahTransaksi, input.kendala, input.clientUuid, pemanggil.id, waktu.klien],
            ),
          )[0].id;
        }
        await replaceBukti(trx, laporanId, input.bukti);
        const saved = rows(await trx.raw(`${LAPORAN_SELECT} WHERE l.id = ?`, [laporanId]))[0];
        return { hasil: existing ? "direvisi" : "dibuat", laporan: toLaporan(saved) };
      });
    } catch (error) {
      // Cadangan untuk balapan lintas peserta: unique client_uuid yang menangkapnya,
      // lalu baca ulang dan balas replay (bukan 500).
      if (error?.code !== "23505" || error?.constraint !== "kpi_laporan_client_uuid_key") throw error;
      const row = rows(await db.raw(`${LAPORAN_SELECT} WHERE l.client_uuid = ?`, [input.clientUuid]))[0];
      if (!row || row.peserta !== id) {
        throw new ProgramError(409, "CLIENT_UUID_CONFLICT", "This report id belongs to another participant.");
      }
      return { hasil: "diulang", laporan: toLaporan(row) };
    }
  }

  /** Antrean review per halaman (BUG-012): `{ items, meta: { page, limit, total } }`. */
  async function listLaporan(pemanggil, query = {}) {
    const status = oneOf(query, "status", LAPORAN_STATUS, "menunggu");
    const page = nomorHalaman(query);
    const scope = predikat(pemanggil, "peserta", "p");
    const arah = status === "menunggu" ? "ASC" : "DESC";
    const where = `WHERE l.status = ? AND (${scope.sql})`;
    const bindings = [status, ...scope.bindings];
    const total = Number(
      rows(await db.raw(`SELECT COUNT(*)::integer AS total FROM kpi_laporan l JOIN program_peserta p ON p.id = l.peserta ${where}`, bindings))[0]?.total ?? 0,
    );
    const result = await db.raw(
      `${LAPORAN_SELECT}
         JOIN program_peserta p ON p.id = l.peserta
        ${where}
        ORDER BY l.date_updated ${arah}, l.id ${arah}
        LIMIT ? OFFSET ?`,
      [...bindings, HALAMAN_ANTREAN, (page - 1) * HALAMAN_ANTREAN],
    );
    const laporan = rows(result).map(toLaporan);
    const pesertaIds = [...new Set(laporan.map((item) => item.peserta))];
    const peserta = pesertaIds.length
      ? rows(
          await db.raw(`${PESERTA_SELECT} WHERE p.id IN (SELECT jsonb_array_elements_text(?::jsonb)::uuid)`, [
            JSON.stringify(pesertaIds),
          ]),
        )
      : [];
    const now = clock();
    const byId = new Map(peserta.map((row) => [row.id, toPeserta(row, now)]));
    return {
      items: laporan.map((item) => ({ ...item, pesertaInfo: byId.get(item.peserta) ?? null })),
      meta: { page, limit: HALAMAN_ANTREAN, total },
    };
  }

  /** Setujui, atau tolak dengan catatan yang meminta bukti lebih baik. */
  async function reviewLaporan(pemanggil, laporanId, body) {
    const id = uuidParam(laporanId);
    const data = objectBody({ body });
    const keputusan = oneOf(data, "keputusan", ["disetujui", "ditolak"]);
    const catatan = optionalText(data, "catatan", 2000);
    if (keputusan === "ditolak" && !catatan) {
      throw new ProgramError(400, "CATATAN_WAJIB", "A note is required when rejecting a report.");
    }
    return db.transaction(async (trx) => {
      const current = rows(await trx.raw(`SELECT id, peserta, status FROM kpi_laporan WHERE id = ? FOR UPDATE`, [id]))[0];
      if (!current) throw new ProgramError(404, "LAPORAN_NOT_FOUND", "The report was not found.");
      const peserta = await loadPeserta(trx, pemanggil, current.peserta);
      if (!canReview(pemanggil, peserta)) throw forbidden();
      if (current.status !== "menunggu") throw new ProgramError(409, "LAPORAN_SUDAH_DIREVIEW", "The report has already been reviewed.");
      await trx.raw(
        `UPDATE kpi_laporan
            SET status = ?, catatan_pendamping = ?, direview_oleh = ?, direview_at = NOW(), date_updated = NOW()
          WHERE id = ?`,
        [keputusan, catatan, pemanggil.id, id],
      );
      return toLaporan(rows(await trx.raw(`${LAPORAN_SELECT} WHERE l.id = ?`, [id]))[0]);
    });
  }

  /** Rekomendasi pitching: menyalakannya butuh 4 minggu berturut-turut disetujui dan mencapai target. */
  async function setPitching(pemanggil, pesertaId, body) {
    const id = uuidParam(pesertaId);
    const data = objectBody({ body });
    if (typeof data.rekomendasi !== "boolean") {
      throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "rekomendasi" must be a boolean.');
    }
    return db.transaction(async (trx) => {
      const peserta = await loadPeserta(trx, pemanggil, id, { lock: true });
      if (!canReview(pemanggil, peserta)) throw forbidden();
      if (data.rekomendasi) {
        const streak = latestTargetStreak(await loadLaporanList(trx, id));
        if (streak < PITCHING_STREAK) {
          throw new ProgramError(
            409,
            "PITCHING_BELUM_MEMENUHI",
            `Needs ${PITCHING_STREAK} consecutive approved on-target weeks ending at the latest reviewed week; the latest run is ${streak}.`,
          );
        }
      }
      await trx.raw(`UPDATE program_peserta SET rekomendasi_pitching = ?, date_updated = NOW() WHERE id = ?`, [data.rekomendasi, id]);
      return toPeserta(await loadPeserta(trx, pemanggil, id), clock());
    });
  }
}

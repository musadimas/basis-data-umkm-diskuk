import { ProgramError, noStore, rows, sendError } from "../../lib/utils/http.js";
import { canReview, canSubmit, forbidden, loadActor, pesertaScope } from "../../lib/access.js";
import { objectBody, oneOf, optionalText, uuidParam, UUID } from "../../lib/validate.js";
import { capaian, currentWeek, longestTargetStreak, PITCHING_STREAK } from "./rules.js";

const LAPORAN_STATUS = ["menunggu", "disetujui", "ditolak"];
const MAX_BUKTI = 5;

const handle = (logger, res, fn) => fn().catch((error) => sendError(res, logger, error));

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
    dateCreated: row.date_created,
    dateUpdated: row.date_updated,
  };
}

const LAPORAN_SELECT = `
  SELECT l.id, l.peserta, l.minggu_ke, l.target, l.realisasi_omzet, l.jumlah_transaksi, l.kendala,
         l.status, l.catatan_pendamping, l.direview_at, l.client_uuid, l.date_created, l.date_updated,
         COALESCE((SELECT json_agg(b.directus_files_id ORDER BY b.sort, b.id)
                     FROM kpi_laporan_bukti b WHERE b.kpi_laporan_id = l.id), '[]'::json) AS bukti
    FROM kpi_laporan l`;

/** One participant the actor may see; 404 otherwise (no existence leak). */
async function loadPeserta(database, actor, id, { lock = false } = {}) {
  const scope = pesertaScope(actor);
  const row = rows(
    await database.raw(`${PESERTA_SELECT} WHERE p.id = ? AND (${scope.sql})${lock ? " FOR UPDATE OF p" : ""}`, [id, ...scope.bindings]),
  )[0];
  if (!row) throw new ProgramError(404, "PESERTA_NOT_FOUND", "The participant was not found.");
  return row;
}

async function loadLaporanList(database, pesertaId) {
  return rows(await database.raw(`${LAPORAN_SELECT} WHERE l.peserta = ? ORDER BY l.minggu_ke`, [pesertaId])).map(toLaporan);
}

/** GET /peserta — participants visible to the actor, with this week's report status. */
export const listPeserta =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const actor = await loadActor(database, req.accountability);
      const scope = pesertaScope(actor);
      const now = new Date();
      const result = await database.raw(
        `${PESERTA_SELECT} WHERE p.status = 'aktif' AND (${scope.sql}) ORDER BY u.nama LIMIT 1000`,
        scope.bindings,
      );
      const peserta = rows(result).map((row) => toPeserta(row, now));
      const reports = peserta.length
        ? rows(
            await database.raw(
              `SELECT peserta, minggu_ke, status FROM kpi_laporan
                WHERE peserta IN (SELECT jsonb_array_elements_text(?::jsonb)::uuid)`,
              [JSON.stringify(peserta.map((item) => item.id))],
            ),
          )
        : [];
      noStore(res);
      res.json({
        data: peserta.map((item) => {
          const own = reports.filter((report) => report.peserta === item.id);
          const thisWeek = own.find((report) => Number(report.minggu_ke) === item.mingguBerjalan);
          return {
            ...item,
            laporanTerkirim: own.length,
            statusMingguIni: item.mingguBerjalan === 0 ? null : (thisWeek?.status ?? "belum_mengirim"),
          };
        }),
      });
    });

/** GET /peserta/:id — participant, all weekly reports, and the pitching streak. */
export const readPeserta =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const id = uuidParam(req.params?.id);
      const actor = await loadActor(database, req.accountability);
      const row = await loadPeserta(database, actor, id);
      const laporan = await loadLaporanList(database, id);
      const streak = longestTargetStreak(laporan);
      noStore(res);
      res.json({
        data: {
          peserta: toPeserta(row, new Date()),
          laporan,
          pitching: { streak, dibutuhkan: PITCHING_STREAK, memenuhi: streak >= PITCHING_STREAK },
          akses: { kirim: canSubmit(actor, row), review: canReview(actor, row) },
        },
      });
    });

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
  return {
    mingguKe: minggu,
    realisasiOmzet: omzet,
    jumlahTransaksi: transaksi,
    kendala: optionalText(body, "kendala", 2000),
    clientUuid: body.clientUuid,
    bukti: [...new Set(bukti)],
  };
}

async function replaceBukti(trx, laporanId, bukti) {
  await trx.raw(`DELETE FROM kpi_laporan_bukti WHERE kpi_laporan_id = ?`, [laporanId]);
  for (const [index, fileId] of bukti.entries()) {
    await trx.raw(`INSERT INTO kpi_laporan_bukti (kpi_laporan_id, directus_files_id, sort) VALUES (?, ?, ?)`, [laporanId, fileId, index + 1]);
  }
}

/**
 * POST /peserta/:id/laporan — submit a week's report. Re-sending the same clientUuid returns the
 * stored report unchanged (offline outbox retries). A rejected report is corrected in place.
 */
export const submitLaporan =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const id = uuidParam(req.params?.id);
      const input = parseLaporan(objectBody(req));
      const actor = await loadActor(database, req.accountability);
      const outcome = await database.transaction(async (trx) => {
        const duplicate = rows(await trx.raw(`${LAPORAN_SELECT} WHERE l.client_uuid = ?`, [input.clientUuid]))[0];
        if (duplicate) {
          if (duplicate.peserta !== id) throw new ProgramError(409, "CLIENT_UUID_CONFLICT", "This report id belongs to another participant.");
          return { status: 200, laporan: toLaporan(duplicate) };
        }
        const peserta = await loadPeserta(trx, actor, id, { lock: true });
        if (!canSubmit(actor, peserta)) throw forbidden();
        if (peserta.status !== "aktif") throw new ProgramError(409, "PESERTA_TIDAK_AKTIF", "The participant is no longer active.");
        const week = currentWeek(peserta.tanggal_mulai, peserta.jumlah_minggu);
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
                    status = 'menunggu', dikirim_oleh = ?, date_updated = NOW()
              WHERE id = ?`,
            [input.realisasiOmzet, input.jumlahTransaksi, input.kendala, input.clientUuid, peserta.target_mingguan, actor.id, existing.id],
          );
          laporanId = existing.id;
        } else {
          laporanId = rows(
            await trx.raw(
              `INSERT INTO kpi_laporan
                 (peserta, minggu_ke, target, realisasi_omzet, jumlah_transaksi, kendala, client_uuid, dikirim_oleh)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
              [id, input.mingguKe, peserta.target_mingguan, input.realisasiOmzet, input.jumlahTransaksi, input.kendala, input.clientUuid, actor.id],
            ),
          )[0].id;
        }
        await replaceBukti(trx, laporanId, input.bukti);
        const saved = rows(await trx.raw(`${LAPORAN_SELECT} WHERE l.id = ?`, [laporanId]))[0];
        return { status: existing ? 200 : 201, laporan: toLaporan(saved) };
      });
      noStore(res);
      res.status(outcome.status).json({ data: outcome.laporan });
    });

/** GET /laporan?status=menunggu — review queue across the participants the actor may review. */
export const listLaporan =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const status = oneOf(req.query ?? {}, "status", LAPORAN_STATUS, "menunggu");
      const actor = await loadActor(database, req.accountability);
      const scope = pesertaScope(actor);
      const result = await database.raw(
        `${LAPORAN_SELECT}
           JOIN program_peserta p ON p.id = l.peserta
          WHERE l.status = ? AND (${scope.sql})
          ORDER BY l.date_updated ${status === "menunggu" ? "ASC" : "DESC"}
          LIMIT 500`,
        [status, ...scope.bindings],
      );
      const laporan = rows(result).map(toLaporan);
      const pesertaIds = [...new Set(laporan.map((item) => item.peserta))];
      const peserta = pesertaIds.length
        ? rows(
            await database.raw(`${PESERTA_SELECT} WHERE p.id IN (SELECT jsonb_array_elements_text(?::jsonb)::uuid)`, [
              JSON.stringify(pesertaIds),
            ]),
          )
        : [];
      const now = new Date();
      const byId = new Map(peserta.map((row) => [row.id, toPeserta(row, now)]));
      noStore(res);
      res.json({ data: laporan.map((item) => ({ ...item, pesertaInfo: byId.get(item.peserta) ?? null })) });
    });

/** POST /laporan/:id/review — approve, or reject with a note asking for better evidence. */
export const reviewLaporan =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const id = uuidParam(req.params?.id);
      const body = objectBody(req);
      const keputusan = oneOf(body, "keputusan", ["disetujui", "ditolak"]);
      const catatan = optionalText(body, "catatan", 2000);
      if (keputusan === "ditolak" && !catatan) {
        throw new ProgramError(400, "CATATAN_WAJIB", "A note is required when rejecting a report.");
      }
      const actor = await loadActor(database, req.accountability);
      const reviewed = await database.transaction(async (trx) => {
        const current = rows(await trx.raw(`SELECT id, peserta, status FROM kpi_laporan WHERE id = ? FOR UPDATE`, [id]))[0];
        if (!current) throw new ProgramError(404, "LAPORAN_NOT_FOUND", "The report was not found.");
        const peserta = await loadPeserta(trx, actor, current.peserta);
        if (!canReview(actor, peserta)) throw forbidden();
        if (current.status !== "menunggu") throw new ProgramError(409, "LAPORAN_SUDAH_DIREVIEW", "The report has already been reviewed.");
        await trx.raw(
          `UPDATE kpi_laporan
              SET status = ?, catatan_pendamping = ?, direview_oleh = ?, direview_at = NOW(), date_updated = NOW()
            WHERE id = ?`,
          [keputusan, catatan, actor.id, id],
        );
        return toLaporan(rows(await trx.raw(`${LAPORAN_SELECT} WHERE l.id = ?`, [id]))[0]);
      });
      noStore(res);
      res.json({ data: reviewed });
    });

/** PATCH /peserta/:id/pitching — the pitching recommendation needs 4 consecutive weeks on target. */
export const setPitching =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const id = uuidParam(req.params?.id);
      const body = objectBody(req);
      if (typeof body.rekomendasi !== "boolean") {
        throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "rekomendasi" must be a boolean.');
      }
      const actor = await loadActor(database, req.accountability);
      const updated = await database.transaction(async (trx) => {
        const peserta = await loadPeserta(trx, actor, id, { lock: true });
        if (!canReview(actor, peserta)) throw forbidden();
        if (body.rekomendasi) {
          const streak = longestTargetStreak(await loadLaporanList(trx, id));
          if (streak < PITCHING_STREAK) {
            throw new ProgramError(
              409,
              "PITCHING_BELUM_MEMENUHI",
              `Needs ${PITCHING_STREAK} consecutive approved weeks on target; the longest run is ${streak}.`,
            );
          }
        }
        await trx.raw(`UPDATE program_peserta SET rekomendasi_pitching = ?, date_updated = NOW() WHERE id = ?`, [body.rekomendasi, id]);
        return toPeserta(await loadPeserta(trx, actor, id), new Date());
      });
      noStore(res);
      res.json({ data: updated });
    });

import { ProgramError, noStore, rows, sendError } from "../../lib/utils/http.js";
import { loadActor } from "../../lib/access.js";
import { loadLegalitas, loadUsahaSummary } from "../../lib/usaha.js";
import { objectBody, uuidParam } from "../../lib/validate.js";
import { currentWeek } from "../kpi/rules.js";
import { KODE_PATTERN, hashPayload, newKode, sign, verify } from "./signing.js";

/** Talent statuses that can hold a passport, with the badge printed on it. */
export const BADGE = { talent_pool: "Talent Pool Jawa Barat", accelerator: "Akselerator Jawa Barat", champion: "Champion Jawa Barat" };
/** The brief names five radar dimensions without a rubric; the fifth reuses the weekly KPI record. */
export const RADAR_RUBRIK = "placeholder-v0";

const handle = (logger, res, fn) => fn().catch((error) => sendError(res, logger, error));
const isCurator = (actor) => actor.admin || actor.appRole === "provinsi";
const canView = (actor, usahaId) => isCurator(actor) || (actor.usaha !== null && actor.usaha === usahaId);
const num = (value) => Math.round(Number(value) * 100) / 100;

function toPassport(row) {
  return {
    id: row.id,
    kode: row.kode,
    status: row.status,
    statusBadge: row.status_badge,
    skor: {
      finansial: num(row.skor_finansial),
      pasar: num(row.skor_pasar),
      legalitas: num(row.skor_legalitas),
      sdm: num(row.skor_sdm),
      kinerja: num(row.skor_kinerja),
    },
    payload: row.payload,
    diterbitkanAt: row.diterbitkan_at,
  };
}

/**
 * Programme performance: the share of started weeks whose approved report met the target, for
 * the business's most recent participation. 0 when it never joined a programme.
 */
async function skorKinerja(database, usahaId) {
  const peserta = rows(
    await database.raw(
      `SELECT id, tanggal_mulai::text AS tanggal_mulai, jumlah_minggu FROM program_peserta
        WHERE usaha = ? ORDER BY tanggal_mulai DESC LIMIT 1`,
      [usahaId],
    ),
  )[0];
  if (!peserta) return 0;
  const weeks = currentWeek(peserta.tanggal_mulai, peserta.jumlah_minggu);
  if (!weeks) return 0;
  const met = rows(
    await database.raw(
      `SELECT COUNT(*)::integer AS n FROM kpi_laporan
        WHERE peserta = ? AND status = 'disetujui' AND realisasi_omzet >= target AND minggu_ke <= ?`,
      [peserta.id, weeks],
    ),
  )[0].n;
  return num((met / weeks) * 100);
}

async function eligibility(database, usaha) {
  const scored = rows(
    await database.raw(
      `SELECT skor_finansial, skor_pasar, skor_legalitas, skor_sdm, rubrik_versi FROM talent_pengajuan
        WHERE usaha = ? AND status = 'disetujui' AND skor_total IS NOT NULL
        ORDER BY date_updated DESC LIMIT 1`,
      [usaha.id],
    ),
  )[0];
  if (!BADGE[usaha.talentStatus]) return { eligible: false, alasan: "Usaha belum masuk Talent Pool.", scored: null };
  if (!scored) return { eligible: false, alasan: "Belum ada pengajuan Talent Scouting yang disetujui.", scored: null };
  return { eligible: true, alasan: null, scored };
}

async function activePassport(database, usahaId) {
  return rows(await database.raw(`SELECT * FROM talent_passport WHERE usaha = ? AND status = 'aktif'`, [usahaId]))[0] ?? null;
}

/** GET /?usaha= — the business's active passport and whether one can be issued. */
export const readPassport =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const usahaId = uuidParam(req.query?.usaha, "INVALID_USAHA_ID");
      const actor = await loadActor(database, req.accountability);
      if (!canView(actor, usahaId)) throw new ProgramError(403, "FORBIDDEN", "You cannot view this business.");
      const usaha = await loadUsahaSummary(database, usahaId);
      const { eligible, alasan } = await eligibility(database, usaha);
      const passport = await activePassport(database, usahaId);
      noStore(res);
      res.json({
        data: {
          usaha: { id: usaha.id, nama: usaha.nama, talentStatus: usaha.talentStatus },
          eligible,
          alasan,
          bisaMenerbitkan: isCurator(actor),
          passport: passport ? toPassport(passport) : null,
        },
      });
    });

/** POST / — issue (or re-issue) a signed passport; the previous one is revoked. */
export const issuePassport =
  ({ database, logger, env }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const usahaId = uuidParam(objectBody(req).usaha, "INVALID_USAHA_ID");
      const actor = await loadActor(database, req.accountability);
      if (!isCurator(actor)) throw new ProgramError(403, "FORBIDDEN", "Only curators can issue passports.");
      const issued = await database.transaction(async (trx) => {
        await trx.raw(`SELECT id FROM usaha WHERE id = ? FOR UPDATE`, [usahaId]);
        const usaha = await loadUsahaSummary(trx, usahaId);
        const { eligible, alasan, scored } = await eligibility(trx, usaha);
        if (!eligible) throw new ProgramError(409, "PASSPORT_BELUM_MEMENUHI", alasan);
        const sertifikasi = (await loadLegalitas(trx, usahaId)).filter((item) => item.status === "terbit").map((item) => item.jenis);
        const skor = {
          finansial: num(scored.skor_finansial),
          pasar: num(scored.skor_pasar),
          legalitas: num(scored.skor_legalitas),
          sdm: num(scored.skor_sdm),
          kinerja: await skorKinerja(trx, usahaId),
        };
        const kode = newKode();
        const diterbitkanAt = new Date().toISOString();
        // Only non-personal business facts go into the signed, public payload.
        const payload = {
          versi: 1,
          kode,
          usaha: { nama: usaha.nama, skala: usaha.skala, kota: usaha.kota, kbli: usaha.kodeKbli },
          statusBadge: BADGE[usaha.talentStatus],
          skor,
          rubrikVersi: RADAR_RUBRIK,
          sertifikasi: [...new Set(sertifikasi)].sort(),
          pdnTerverifikasi: usaha.pdnTerverifikasi,
          diterbitkanAt,
        };
        const payloadHash = hashPayload(payload);
        await trx.raw(`UPDATE talent_passport SET status = 'dicabut', dicabut_at = NOW() WHERE usaha = ? AND status = 'aktif'`, [usahaId]);
        const row = rows(
          await trx.raw(
            `INSERT INTO talent_passport
               (usaha, kode, payload, payload_hash, signature, skor_finansial, skor_pasar, skor_legalitas, skor_sdm,
                skor_kinerja, status_badge, diterbitkan_oleh, diterbitkan_at)
             VALUES (?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
            [
              usahaId, kode, JSON.stringify(payload), payloadHash, sign(env, kode, payloadHash),
              skor.finansial, skor.pasar, skor.legalitas, skor.sdm, skor.kinerja, payload.statusBadge, actor.id, diterbitkanAt,
            ],
          ),
        )[0];
        return toPassport(row);
      });
      noStore(res);
      res.status(201).json({ data: issued });
    });

/** POST /:id/cabut — revoke a passport; verification then reports it as revoked. */
export const revokePassport =
  ({ database, logger }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const id = uuidParam(req.params?.id);
      const actor = await loadActor(database, req.accountability);
      if (!isCurator(actor)) throw new ProgramError(403, "FORBIDDEN", "Only curators can revoke passports.");
      const row = rows(
        await database.raw(
          `UPDATE talent_passport SET status = 'dicabut', dicabut_at = NOW() WHERE id = ? AND status = 'aktif' RETURNING *`,
          [id],
        ),
      )[0];
      if (!row) throw new ProgramError(404, "PASSPORT_NOT_FOUND", "No active passport with this id.");
      noStore(res);
      res.json({ data: toPassport(row) });
    });

/**
 * GET /verify/:kode — PUBLIC. Recomputes the signature. Only a valid, active passport returns its
 * payload and the business's published catalogue products (already public under ADR-006).
 */
export const verifyPassport =
  ({ database, logger, env }) =>
  (req, res) =>
    handle(logger, res, async () => {
      const kode = String(req.params?.kode ?? "").toUpperCase();
      if (!KODE_PATTERN.test(kode)) throw new ProgramError(404, "PASSPORT_NOT_FOUND", "Passport not found.");
      const row = rows(await database.raw(`SELECT * FROM talent_passport WHERE kode = ?`, [kode]))[0];
      if (!row) throw new ProgramError(404, "PASSPORT_NOT_FOUND", "Passport not found.");
      res.setHeader("Cache-Control", "no-store");
      if (!verify(env, row)) {
        logger.warn?.({ kode }, "Talent passport failed signature verification");
        res.json({ data: { kode, valid: false, status: "tidak_valid" } });
        return;
      }
      if (row.status !== "aktif") {
        res.json({ data: { kode, valid: false, status: "dicabut", dicabutAt: row.dicabut_at } });
        return;
      }
      const portfolio = rows(
        await database.raw(
          `SELECT p.id, p.nama, p.deskripsi, p.video_url AS "videoUrl", p.dimensi, p.berat, p.shelf_life AS "shelfLife",
                  p.bahan_baku AS "bahanBaku", p.tkdn_persen AS "tkdnPersen", p.kapasitas_bulanan AS "kapasitasBulanan",
                  p.lead_time AS "leadTime",
                  COALESCE((SELECT json_agg(f.directus_files_id ORDER BY f.sort, f.id) FROM produk_foto f WHERE f.produk_id = p.id), '[]'::json) AS foto
             FROM produk p
            WHERE p.usaha = ? AND p.status_kurasi IN ('tayang', 'rekomendasi_marketplace')
            ORDER BY p.date_created DESC LIMIT 12`,
          [row.usaha],
        ),
      );
      res.json({ data: { kode, valid: true, status: "aktif", passport: row.payload, portfolio } });
    });

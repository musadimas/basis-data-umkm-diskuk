import { ProgramError, noStore, rows, sendError } from "../../lib/utils/http.js";
import { loadLegalitas, loadUsahaSummary } from "../../lib/usaha.js";
import { objectBody, uuidParam } from "../../lib/validate.js";
import { currentWeek } from "../kpi/rules.js";
import { KODE_PATTERN, hashPayload, newKode, publicKeyInfo, sign, verify } from "./signing.js";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";

const { pastikanUsaha } = cakupan;

/** Talent statuses that can hold a passport, with the badge printed on it. */
export const BADGE = { talent_pool: "Talent Pool Jawa Barat", accelerator: "Akselerator Jawa Barat", champion: "Champion Jawa Barat" };
/** The brief names five radar dimensions without a rubric; the fifth reuses the weekly KPI record. */
export const RADAR_RUBRIK = "placeholder-v0";
/** "Siap Naik Kelas" shares the Talent Scouting recommendation threshold, so the bar is consistent. */
export const NAIK_KELAS_AMBANG = 75;

const handle = (logger, res, fn) => fn().catch((error) => sendError(res, logger, error));
const isCurator = (pemanggil) => pemanggil?.admin === true || pemanggil?.peran === "provinsi";
const num = (value) => Math.round(Number(value) * 100) / 100;

/** The Talent Index is the four Scouting pillars (weights 25% each); kinerja is programme
 * performance and stays out of the "Siap Naik Kelas" bar. Satu definisi untuk badge dan PDF (B27). */
export const talentIndexOf = (skor) =>
  num(
    ((Number(skor.finansial) || 0) + (Number(skor.pasar) || 0) + (Number(skor.legalitas) || 0) + (Number(skor.sdm) || 0)) / 4,
  );

function toPassport(row) {
  return {
    id: row.id,
    kode: row.kode,
    // Brief contract `qr_talent_passport_code` (legacy plan column: `passport_kode`): the SAME
    // value as `kode`, never a second code.
    qrTalentPassportCode: row.kode,
    kid: row.kid ?? null,
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
 * the business's most recent participation. 0 when it never joined a programme; the score source
 * then says so, because an empty record must not read as a perfect one.
 */
async function skorKinerja(database, usahaId) {
  const peserta = rows(
    await database.raw(
      `SELECT id, tanggal_mulai::text AS tanggal_mulai, jumlah_minggu FROM program_peserta
        WHERE usaha = ? ORDER BY tanggal_mulai DESC LIMIT 1`,
      [usahaId],
    ),
  )[0];
  if (!peserta) return { nilai: 0, sumber: "Belum ada data program (kinerja belum diukur)." };
  const weeks = currentWeek(peserta.tanggal_mulai, peserta.jumlah_minggu);
  if (!weeks) return { nilai: 0, sumber: "Belum ada data program (kinerja belum diukur)." };
  const met = rows(
    await database.raw(
      `SELECT COUNT(*)::integer AS n FROM kpi_laporan
        WHERE peserta = ? AND status = 'disetujui' AND realisasi_omzet >= target AND minggu_ke <= ?`,
      [peserta.id, weeks],
    ),
  )[0].n;
  return { nilai: num((met / weeks) * 100), sumber: `KPI mingguan disetujui: ${met}/${weeks} minggu memenuhi target.` };
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

const JENIS_LABEL = { halal: "Sertifikat Halal", pirt: "PIRT", bpom: "BPOM", hki: "Hak Merek (HKI)", sni: "SNI", umku: "UMKU" };

/**
 * Badges at issue time. "Terverifikasi" requires recorded evidence: a dinas-set flag for PDN, a
 * certificate file for legalitas, a computed score for Siap Naik Kelas. The owner's own PDN
 * declaration stays clearly separate (terverifikasi: false).
 */
async function bangunBadges(database, { usahaId, legalitas, pdnTerverifikasi, talentIndex, rubrik }) {
  const badges = [];
  if (pdnTerverifikasi) {
    badges.push({ key: "pdn", label: "100% Produk Dalam Negeri (PDN)", terverifikasi: true, sumber: "Diverifikasi dinas (pdn_terverifikasi)" });
  } else {
    const adaDeklarasi = rows(
      await database.raw(
        `SELECT EXISTS(SELECT 1 FROM produk WHERE usaha = ? AND status_kurasi IN ('tayang', 'rekomendasi_marketplace') AND pdn_deklarasi) AS ada`,
        [usahaId],
      ),
    )[0].ada;
    if (adaDeklarasi) {
      badges.push({ key: "pdn_deklarasi", label: "PDN — deklarasi mandiri pelaku usaha", terverifikasi: false, sumber: "Deklarasi mandiri UMKM, belum diverifikasi dinas" });
    }
  }
  if (talentIndex >= NAIK_KELAS_AMBANG) {
    badges.push({ key: "naik_kelas", label: "Siap Naik Kelas", terverifikasi: true, sumber: `Skor Talent Index ${talentIndex} ≥ ${NAIK_KELAS_AMBANG} (rubrik ${rubrik})` });
  }
  for (const item of legalitas) {
    if (item.status !== "terbit") continue;
    badges.push({
      key: `legalitas_${item.jenis}`,
      label: `${JENIS_LABEL[item.jenis] ?? item.jenis} aktif`,
      terverifikasi: Boolean(item.berkas),
      sumber: item.berkas ? "Tercatat dinas dengan berkas sertifikat" : "Tercatat dinas tanpa berkas — belum terverifikasi penuh",
    });
  }
  return badges;
}

async function activePassport(database, usahaId) {
  return rows(await database.raw(`SELECT * FROM talent_passport WHERE usaha = ? AND status = 'aktif'`, [usahaId]))[0] ?? null;
}

/** GET /?usaha= — the business's active passport and whether one can be issued. */
export const readPassport =
  ({ database, logger }) =>
  (req, res, pemanggil) =>
    handle(logger, res, async () => {
      const usahaId = uuidParam(req.query?.usaha, "INVALID_USAHA_ID");
      await pastikanUsaha(database, pemanggil, usahaId);
      const usaha = await loadUsahaSummary(database, usahaId);
      const { eligible, alasan } = await eligibility(database, usaha);
      const passport = await activePassport(database, usahaId);
      noStore(res);
      res.json({
        data: {
          usaha: { id: usaha.id, nama: usaha.nama, talentStatus: usaha.talentStatus },
          eligible,
          alasan,
          bisaMenerbitkan: isCurator(pemanggil),
          passport: passport ? toPassport(passport) : null,
        },
      });
    });

/** POST / — issue (or re-issue) a signed passport; the previous one is revoked. */
export const issuePassport =
  ({ database, logger, env }) =>
  (req, res, pemanggil) =>
    handle(logger, res, async () => {
      const usahaId = uuidParam(objectBody(req).usaha, "INVALID_USAHA_ID");
        const issued = await database.transaction(async (trx) => {
          await trx.raw(`SELECT id FROM usaha WHERE id = ? FOR UPDATE`, [usahaId]);
          const usaha = await loadUsahaSummary(trx, usahaId);
          const { eligible, alasan, scored } = await eligibility(trx, usaha);
          if (!eligible) throw new ProgramError(409, "PASSPORT_BELUM_MEMENUHI", alasan);
          const legalitas = await loadLegalitas(trx, usahaId);
          const sertifikasi = legalitas.filter((item) => item.status === "terbit").map((item) => item.jenis);
          const kinerja = await skorKinerja(trx, usahaId);
          const skor = {
            finansial: num(scored.skor_finansial),
            pasar: num(scored.skor_pasar),
            legalitas: num(scored.skor_legalitas),
            sdm: num(scored.skor_sdm),
            kinerja: kinerja.nilai,
          };
          const talentIndex = talentIndexOf(skor);
          const sumberSkor = [
            { dimensi: "finansial", sumber: `Talent Scouting (rubrik ${scored.rubrik_versi})` },
            { dimensi: "pasar", sumber: `Talent Scouting (rubrik ${scored.rubrik_versi})` },
            { dimensi: "legalitas", sumber: `Talent Scouting (rubrik ${scored.rubrik_versi})` },
            { dimensi: "sdm", sumber: `Talent Scouting (rubrik ${scored.rubrik_versi})` },
            { dimensi: "kinerja", sumber: kinerja.sumber },
          ];
          const badges = await bangunBadges(trx, { usahaId, legalitas, pdnTerverifikasi: usaha.pdnTerverifikasi, talentIndex, rubrik: scored.rubrik_versi });
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
            sumberSkor,
            badges,
            sertifikasi: [...new Set(sertifikasi)].sort(),
            pdnTerverifikasi: usaha.pdnTerverifikasi,
            diterbitkanAt,
          };
          const payloadHash = hashPayload(payload);
          const { kid, signature } = sign(env, kode, payloadHash);
          await trx.raw(`UPDATE talent_passport SET status = 'dicabut', dicabut_at = NOW() WHERE usaha = ? AND status = 'aktif'`, [usahaId]);
          const row = rows(
            await trx.raw(
              `INSERT INTO talent_passport
                 (usaha, kode, payload, payload_hash, signature, kid, skor_finansial, skor_pasar, skor_legalitas, skor_sdm,
                  skor_kinerja, status_badge, diterbitkan_oleh, diterbitkan_at)
               VALUES (?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
              [
                usahaId, kode, JSON.stringify(payload), payloadHash, signature, kid,
                skor.finansial, skor.pasar, skor.legalitas, skor.sdm, skor.kinerja, payload.statusBadge, pemanggil.id, diterbitkanAt,
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
 * GET /verify/:kode — PUBLIC. Recomputes the Ed25519 signature. Only a valid, active passport
 * returns its payload, the public key (for independent verification) and the business's published
 * catalogue products (already public under ADR-006). No PII: the payload only carries business
 * facts, and the portfolio only carries published catalogue fields.
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
        res.json({ data: { kode, qrTalentPassportCode: kode, valid: false, status: "tidak_valid" } });
        return;
      }
      if (row.status !== "aktif") {
        res.json({ data: { kode, qrTalentPassportCode: kode, valid: false, status: "dicabut", dicabutAt: row.dicabut_at } });
        return;
      }
      const portfolio = rows(
        await database.raw(
          `SELECT p.id, p.nama, p.deskripsi, p.video_url AS "videoUrl", p.dimensi, p.berat, p.shelf_life AS "shelfLife",
                  p.bahan_baku AS "bahanBaku", p.persen_bahan_lokal AS "persenBahanLokal", p.tkdn_persen AS "tkdnPersen",
                  p.kapasitas_bulanan AS "kapasitasBulanan", p.lead_time AS "leadTime", p.uji_lab AS "ujiLab",
                  COALESCE((SELECT json_agg(f.directus_files_id ORDER BY f.sort, f.id) FROM produk_foto f WHERE f.produk_id = p.id), '[]'::json) AS foto
             FROM produk p
            WHERE p.usaha = ? AND p.status_kurasi IN ('tayang', 'rekomendasi_marketplace')
            ORDER BY p.date_created DESC LIMIT 12`,
          [row.usaha],
        ),
      );
      res.json({
        data: {
          kode,
          qrTalentPassportCode: kode,
          valid: true,
          status: "aktif",
          passport: row.payload,
          portfolio,
          publicKey: publicKeyInfo(env),
        },
      });
    });

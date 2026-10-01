import { ProgramError, noStore, rows, sendError } from "../../lib/utils/http.js";
import { uuidParam, UUID } from "../../lib/validate.js";
import dokumen from "../../../../../analytics-shared/dokumen.cjs";
import { aggregateProgram } from "./rules.js";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";

const { terjaga, publik, predikat } = cakupan;
const INVESTOR_ROLE_ID = "5e5d15ec-b985-4cc4-a92d-783b7b7806bb";
const SCHEMES = new Set(["kur", "lpdb", "offtaker", "penyertaan_modal", "konsinyasi", "ekspor"]);
const handle = (ctx, res, fn) => fn().catch((error) => sendError(res, ctx.logger, error));
const fail = (code = "NOT_FOUND") => new ProgramError(404, code, "Data tidak ditemukan atau tidak dapat diakses.");

async function monitoring(ctx, actor, now = new Date()) {
  const scope = predikat(actor, "peserta", "p");
  const participants = rows(await ctx.database.raw(
    `SELECT p.id, p.usaha, p.pendamping, p.tanggal_mulai::text AS tanggal_mulai,
            p.jumlah_minggu, p.target_mingguan, u.nama, u.omzet_tahunan,
            t.kota_nama, t.latitude, t.longitude,
            NULLIF(TRIM(CONCAT_WS(' ', du.first_name, du.last_name)), '') AS pendamping_nama
       FROM program_peserta p JOIN usaha u ON u.id = p.usaha
       LEFT JOIN usaha_tabular t ON t.id = u.id
       LEFT JOIN directus_users du ON du.id = p.pendamping
      WHERE p.fase = 'akselerasi' AND p.status IN ('aktif','selesai') AND (${scope.sql})
      ORDER BY p.id`, scope.bindings,
  ));
  const reports = participants.length ? rows(await ctx.database.raw(
    `SELECT peserta, minggu_ke, status, realisasi_omzet FROM kpi_laporan
      WHERE peserta = ANY(?::uuid[]) AND minggu_ke BETWEEN 1 AND 12 AND status = 'disetujui'`,
    [participants.map((p) => p.id)],
  )) : [];
  const grouped = new Map();
  for (const report of reports) {
    const list = grouped.get(report.peserta) ?? [];
    list.push(report);
    grouped.set(report.peserta, list);
  }
  return aggregateProgram(participants.map((p) => ({ ...p, laporan: grouped.get(p.id) ?? [] })), now);
}

async function requireInvestor(ctx, req) {
  const user = req.accountability?.user;
  if (!user) throw new ProgramError(401, "AUTHENTICATION_REQUIRED", "Authentication required.");
  const row = rows(await ctx.database.raw(
    `SELECT iv.pengguna FROM investor_verifikasi iv
       JOIN directus_users du ON du.id = iv.pengguna
      WHERE iv.pengguna = ? AND iv.dicabut_pada IS NULL
        AND du.app_role IS NULL AND du.role = ? AND du.status = 'active'`, [user, INVESTOR_ROLE_ID],
  ))[0];
  if (!row) throw new ProgramError(403, "INVESTOR_NOT_VERIFIED", "Investor belum diverifikasi.");
  return user;
}

function filters(query = {}) {
  const clauses = [];
  const bindings = [];
  if (query.modal) {
    const ranges = {
      kecil: ["ip.kebutuhan_modal < ?", 50_000_000],
      menengah: ["ip.kebutuhan_modal BETWEEN ? AND ?", 50_000_000, 500_000_000],
      besar: ["ip.kebutuhan_modal > ?", 500_000_000],
    };
    if (!ranges[query.modal]) throw new ProgramError(400, "INVALID_MODAL", "Rentang modal tidak valid.");
    clauses.push(ranges[query.modal][0]);
    bindings.push(...ranges[query.modal].slice(1));
  }
  if (query.skema) {
    if (!SCHEMES.has(query.skema)) throw new ProgramError(400, "INVALID_SCHEME", "Skema tidak valid.");
    clauses.push("? = ANY(ip.skema)");
    bindings.push(query.skema);
  }
  if (query.kbli) {
    if (typeof query.kbli !== "string" || !/^\d{2,5}$/.test(query.kbli)) throw new ProgramError(400, "INVALID_KBLI", "Kode KBLI tidak valid.");
    clauses.push("t.kode_kbli LIKE ?");
    bindings.push(`${query.kbli}%`);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", bindings };
}

const DIRECTORY_FROM = `FROM investor_profil ip JOIN usaha u ON u.id = ip.usaha
  JOIN usaha_tabular t ON t.id = u.id
 WHERE ip.disetujui_berbagi_pada IS NOT NULL AND ip.disetujui_kurator_pada IS NOT NULL
   AND ip.dicabut_pada IS NULL`;

async function detail(ctx, user, usahaId, action) {
  const record = rows(await ctx.database.raw(
    `SELECT ip.usaha, ip.jenama, ip.kebutuhan_modal, ip.skema, ip.kapasitas_pasok,
            ip.margin_persen, ip.margin_sumber, ip.pitch_deck,
            u.nama, u.talent_status, t.kota_nama, t.kode_kbli,
            (SELECT tp.skor_total FROM talent_pengajuan tp WHERE tp.usaha = u.id
              AND tp.status = 'disetujui' ORDER BY tp.date_updated DESC LIMIT 1) AS talent_index,
            (SELECT p.id FROM produk p WHERE p.usaha = u.id
              AND p.status_kurasi IN ('tayang','rekomendasi_marketplace') ORDER BY p.date_created DESC LIMIT 1) AS produk_id
      ${DIRECTORY_FROM} AND ip.usaha = ?`, [usahaId],
  ))[0];
  if (!record) throw fail();
  await ctx.database.raw(`INSERT INTO investor_akses_audit (pengguna, usaha, aksi) VALUES (?, ?, ?)`, [user, usahaId, action]);
  const reports = rows(await ctx.database.raw(
    `SELECT l.minggu_ke, l.realisasi_omzet FROM kpi_laporan l
       JOIN program_peserta p ON p.id = l.peserta
      WHERE p.usaha = ? AND l.status = 'disetujui' AND p.fase = 'akselerasi'
      ORDER BY p.tanggal_mulai DESC, l.minggu_ke DESC LIMIT 2`, [usahaId],
  ));
  const growth = reports.length === 2 && Number(reports[1].realisasi_omzet) > 0 && Number(reports[0].minggu_ke) === Number(reports[1].minggu_ke) + 1
    ? Math.round(((Number(reports[0].realisasi_omzet) / Number(reports[1].realisasi_omzet)) - 1) * 1000) / 10 : null;
  return {
    id: record.usaha, nama: record.nama, jenama: record.jenama, domisili: record.kota_nama,
    kbli: record.kode_kbli, talentIndex: record.talent_index == null ? null : Number(record.talent_index),
    talentIndexSumber: record.talent_index == null ? null : "Talent Scouting disetujui",
    pertumbuhanOmzetMingguan: growth, pertumbuhanSumber: growth == null ? null : "Laporan KPI disetujui",
    marginPersen: record.margin_persen == null ? null : Number(record.margin_persen),
    marginSumber: record.margin_sumber, kebutuhanModal: record.kebutuhan_modal == null ? null : Number(record.kebutuhan_modal),
    kapasitasPasok: record.kapasitas_pasok, skema: record.skema, produkId: record.produk_id,
    pitchDeckTersedia: Boolean(record.pitch_deck),
  };
}

const KURASI_INVESTOR_STATUS = ["menunggu", "disetujui", "belum_disetujui", "dicabut"];
// Presedensi mengikat (BUG-017): persetujuan usaha > cabut kurator > setuju kurator > menunggu.
const STATUS_PROFIL_SQL = `CASE
    WHEN ip.disetujui_berbagi_pada IS NULL OR ip.dicabut_pada IS NOT NULL THEN 'belum_disetujui'
    WHEN ip.kurator_dicabut_pada IS NOT NULL THEN 'dicabut'
    WHEN ip.disetujui_kurator_pada IS NOT NULL THEN 'disetujui'
    ELSE 'menunggu' END`;

export default (router, ctx) => {
  router.get("/monitoring", terjaga({ peran: ["provinsi", "kabkota"] }, (inner) => (req, res, actor) =>
    handle(inner, res, async () => { noStore(res); res.json({ data: await monitoring(inner, actor) }); }))(ctx));
  router.post("/monitoring/recompute", terjaga({ peran: ["provinsi", "kabkota"] }, (inner) => (req, res, actor) =>
    handle(inner, res, async () => {
      const data = await monitoring(inner, actor);
      let dibuat = 0;
      for (const risk of data.atRisk) {
        if (!risk.pendampingId) continue;
        const result = rows(await inner.database.raw(
          `INSERT INTO pendamping_tugas_risiko (peserta, pendamping, minggu_akhir)
            VALUES (?, ?, ?) ON CONFLICT (peserta, minggu_akhir) DO NOTHING RETURNING id`,
          [risk.pesertaId, risk.pendampingId, risk.mingguAkhir],
        ));
        dibuat += result.length;
      }
      noStore(res); res.json({ data: { dibuat, totalRisiko: data.atRisk.length } });
    }))(ctx));
  router.get("/monitoring/tugas", terjaga({ peran: ["provinsi", "kabkota", "pendamping"] }, (inner) => (req, res, actor) =>
    handle(inner, res, async () => {
      const scope = predikat(actor, "peserta", "p");
      const items = rows(await inner.database.raw(
        `SELECT r.id, r.peserta, r.minggu_akhir, r.status, r.date_created, u.nama
           FROM pendamping_tugas_risiko r JOIN program_peserta p ON p.id = r.peserta JOIN usaha u ON u.id = p.usaha
          WHERE (${scope.sql}) ORDER BY r.date_created DESC LIMIT 100`, scope.bindings,
      ));
      noStore(res); res.json({ data: items });
    }))(ctx));
  router.post("/investor/verifikasi/:id", terjaga({ peran: ["provinsi"] }, (inner) => (req, res, actor) =>
    handle(inner, res, async () => {
      const id = uuidParam(req.params.id);
      if (req.body?.aktif !== true && req.body?.aktif !== false) throw new ProgramError(400, "INVALID_PAYLOAD", "Status aktif wajib diisi.");
      const target = rows(await inner.database.raw(`SELECT id FROM directus_users
        WHERE id = ? AND app_role IS NULL AND role = ? AND status = 'active'`,
        [id, INVESTOR_ROLE_ID]))[0];
      if (!target) throw new ProgramError(400, "INVALID_INVESTOR", "Akun investor harus beridentitas terpisah dari petugas dan UMKM.");
      await inner.database.raw(`INSERT INTO investor_verifikasi (pengguna, diverifikasi_oleh, dicabut_pada)
        VALUES (?, ?, CASE WHEN ? THEN NULL ELSE NOW() END)
        ON CONFLICT (pengguna) DO UPDATE SET diverifikasi_oleh = EXCLUDED.diverifikasi_oleh,
          diverifikasi_pada = NOW(), dicabut_pada = EXCLUDED.dicabut_pada`, [id, actor.id, req.body.aktif]);
      noStore(res); res.json({ data: { aktif: req.body.aktif } });
    }))(ctx));
  router.get("/investor/kurasi", terjaga({ peran: ["provinsi"] }, (inner) => (req, res) =>
    handle(inner, res, async () => {
      const status = req.query?.status ?? null;
      if (status !== null && !KURASI_INVESTOR_STATUS.includes(status)) {
        throw new ProgramError(400, "INVALID_STATUS", "Status kurasi tidak valid.");
      }
      const items = rows(await inner.database.raw(`SELECT * FROM (
        SELECT ip.usaha AS id, u.nama, ip.jenama, ip.disetujui_kurator_pada, ip.kurator_dicabut_pada,
               ip.date_updated, ${STATUS_PROFIL_SQL} AS status
          FROM investor_profil ip JOIN usaha u ON u.id = ip.usaha
      ) s WHERE (?::text IS NULL OR s.status = ?) ORDER BY s.date_updated DESC LIMIT 200`, [status, status]));
      const counts = rows(await inner.database.raw(`SELECT COUNT(*) FILTER (WHERE s.status = 'menunggu')::int AS menunggu,
        COUNT(*) FILTER (WHERE s.status = 'disetujui')::int AS disetujui,
        COUNT(*) FILTER (WHERE s.status = 'belum_disetujui')::int AS belum_disetujui,
        COUNT(*) FILTER (WHERE s.status = 'dicabut')::int AS dicabut
        FROM (SELECT ${STATUS_PROFIL_SQL} AS status FROM investor_profil ip) s`))[0] ?? {};
      noStore(res); res.json({ data: {
        items: items.map((r) => ({ id: r.id, nama: r.nama, jenama: r.jenama, status: r.status,
          disetujuiKuratorPada: r.disetujui_kurator_pada, kuratorDicabutPada: r.kurator_dicabut_pada,
          dateUpdated: r.date_updated })),
        meta: { counts: {
          menunggu: Number(counts.menunggu ?? 0), disetujui: Number(counts.disetujui ?? 0),
          belum_disetujui: Number(counts.belum_disetujui ?? 0), dicabut: Number(counts.dicabut ?? 0),
        } },
      } });
    }))(ctx));
  router.get("/investor/profil-saya", terjaga({ peran: ["umkm"] }, (inner) => (req, res, actor) =>
    handle(inner, res, async () => {
      const item = actor.usahaId ? rows(await inner.database.raw(`SELECT jenama, kebutuhan_modal,
        skema, kapasitas_pasok, margin_persen, pitch_deck, disetujui_berbagi_pada,
        disetujui_kurator_pada, kurator_dicabut_pada, dicabut_pada FROM investor_profil WHERE usaha = ?`, [actor.usahaId]))[0] : null;
      noStore(res); res.json({ data: item ?? null });
    }))(ctx));
  router.post("/investor/profil", terjaga({ peran: ["umkm"] }, (inner) => (req, res, actor) =>
    handle(inner, res, async () => {
      if (!actor.usahaId) throw new ProgramError(403, "FORBIDDEN", "Usaha tidak terhubung.");
      const b = req.body ?? {};
      if (typeof b.jenama !== "string" || !b.jenama.trim() || b.jenama.length > 160 ||
          !Array.isArray(b.skema) || !b.skema.every((s) => SCHEMES.has(s)) ||
          !Number.isSafeInteger(b.kebutuhanModal) || b.kebutuhanModal <= 0 ||
          (b.marginPersen != null && (!Number.isFinite(b.marginPersen) || b.marginPersen < 0 || b.marginPersen > 100)) ||
          (b.kapasitasPasok != null && (typeof b.kapasitasPasok !== "string" || b.kapasitasPasok.length > 300))) {
        throw new ProgramError(400, "INVALID_PAYLOAD", "Profil investor tidak valid.");
      }
      if (b.setuju !== true && b.setuju !== false) throw new ProgramError(400, "INVALID_CONSENT", "Persetujuan harus eksplisit.");
      const pitchDeck = b.pitchDeck == null ? null : uuidParam(b.pitchDeck);
      if (pitchDeck) {
        const file = rows(await inner.database.raw(
          `SELECT id FROM directus_files WHERE id = ? AND uploaded_by = ? AND type = 'application/pdf'`,
          [pitchDeck, actor.id],
        ))[0];
        if (!file) throw new ProgramError(400, "INVALID_PITCH_DECK", "Pitch deck harus PDF milik akun usaha.");
      }
      await inner.database.raw(`INSERT INTO investor_profil
        (usaha, jenama, kebutuhan_modal, skema, kapasitas_pasok, margin_persen,
         pitch_deck, disetujui_berbagi_oleh, disetujui_berbagi_pada, dicabut_pada)
        VALUES (?, ?, ?, ?::text[], ?, ?, ?, CASE WHEN ? THEN ?::uuid ELSE NULL END,
                CASE WHEN ? THEN NOW() ELSE NULL END, CASE WHEN ? THEN NULL ELSE NOW() END)
        ON CONFLICT (usaha) DO UPDATE SET jenama = EXCLUDED.jenama, kebutuhan_modal = EXCLUDED.kebutuhan_modal,
          skema = EXCLUDED.skema, kapasitas_pasok = EXCLUDED.kapasitas_pasok, margin_persen = EXCLUDED.margin_persen,
          pitch_deck = EXCLUDED.pitch_deck, margin_sumber = 'deklarasi', disetujui_berbagi_oleh = EXCLUDED.disetujui_berbagi_oleh,
          disetujui_berbagi_pada = EXCLUDED.disetujui_berbagi_pada, dicabut_pada = EXCLUDED.dicabut_pada,
          disetujui_kurator_oleh = NULL, disetujui_kurator_pada = NULL,
          kurator_dicabut_oleh = NULL, kurator_dicabut_pada = NULL, date_updated = NOW()`,
        [actor.usahaId, b.jenama.trim(), b.kebutuhanModal, [...new Set(b.skema)], b.kapasitasPasok ?? null,
          b.marginPersen ?? null, pitchDeck, b.setuju, actor.id, b.setuju, b.setuju]);
      noStore(res); res.json({ data: { disetujuiBerbagi: b.setuju, menungguKurasi: b.setuju } });
    }))(ctx));
  router.post("/investor/profil/:id/kurasi", terjaga({ peran: ["provinsi"] }, (inner) => (req, res, actor) =>
    handle(inner, res, async () => {
      const id = uuidParam(req.params.id);
      const approve = req.body?.setuju;
      if (approve !== true && approve !== false) throw new ProgramError(400, "INVALID_PAYLOAD", "Keputusan wajib diisi.");
      // R2: satu penulis dengan syarat di dalam WHERE; 0 baris berarti status sudah berubah.
      const result = rows(await inner.database.raw(approve
        ? `UPDATE investor_profil SET disetujui_kurator_oleh = ?, disetujui_kurator_pada = NOW(),
             kurator_dicabut_oleh = NULL, kurator_dicabut_pada = NULL, date_updated = NOW()
           WHERE usaha = ? AND disetujui_berbagi_pada IS NOT NULL AND dicabut_pada IS NULL
             AND disetujui_kurator_pada IS NULL RETURNING usaha`
        : `UPDATE investor_profil SET disetujui_kurator_oleh = NULL, disetujui_kurator_pada = NULL,
             kurator_dicabut_oleh = ?, kurator_dicabut_pada = NOW(), date_updated = NOW()
           WHERE usaha = ? AND disetujui_berbagi_pada IS NOT NULL AND dicabut_pada IS NULL
             AND disetujui_kurator_pada IS NOT NULL RETURNING usaha`,
      [actor.id, id]));
      if (!result.length) {
        // Klasifikasi saja: profil dengan persetujuan valid ada → status sudah berubah (409), selain itu 404.
        const ada = rows(await inner.database.raw(`SELECT 1 FROM investor_profil
          WHERE usaha = ? AND disetujui_berbagi_pada IS NOT NULL AND dicabut_pada IS NULL`, [id]))[0];
        if (ada) throw new ProgramError(409, "STATUS_BERUBAH", "Status profil sudah berubah. Muat ulang daftar.");
        throw fail();
      }
      noStore(res); res.json({ data: { disetujui: approve } });
    }))(ctx));
  router.get("/investor", publik((inner) => (req, res) => handle(inner, res, async () => {
    const user = await requireInvestor(inner, req);
    const filter = filters(req.query);
    const items = rows(await inner.database.raw(`SELECT ip.usaha AS id, ip.jenama, ip.kebutuhan_modal,
      ip.skema, u.nama, t.kota_nama, t.kode_kbli ${DIRECTORY_FROM}${filter.sql}
      ORDER BY ip.date_updated DESC LIMIT 100`, filter.bindings));
    if (items.length) await inner.database.raw(`INSERT INTO investor_akses_audit (pengguna, usaha, aksi)
      SELECT ?::uuid, ids.usaha_id::uuid, 'list' FROM jsonb_array_elements_text(?::jsonb) AS ids(usaha_id)`,
      [user, JSON.stringify(items.map((r) => r.id))]);
    noStore(res); res.json({ data: items.map((r) => ({ id: r.id, jenama: r.jenama, nama: r.nama,
      domisili: r.kota_nama, kbli: r.kode_kbli, kebutuhanModal: Number(r.kebutuhan_modal), skema: r.skema })) });
  }))(ctx));
  router.get("/investor/:id", publik((inner) => (req, res) => handle(inner, res, async () => {
    const user = await requireInvestor(inner, req);
    const item = await detail(inner, user, uuidParam(req.params.id), "detail");
    noStore(res); res.json({ data: item });
  }))(ctx));
  router.get("/investor/:id/pdf", publik((inner) => (req, res) => handle(inner, res, async () => {
    const user = await requireInvestor(inner, req);
    const item = await detail(inner, user, uuidParam(req.params.id), "pdf");
    const pdf = dokumen.renderDokumen({ judul: "Executive Summary Investor", subjudul: item.jenama,
      bagian: [
        { judul: "Profil dan sumber", baris: [`Usaha: ${item.nama}`, `Domisili: ${item.domisili ?? "-"}`,
          `KBLI: ${item.kbli ?? "-"}`, `Talent Index: ${item.talentIndex ?? "-"} (${item.talentIndexSumber ?? "belum terverifikasi"})`] },
        { judul: "Kinerja dan kebutuhan", baris: [`Pertumbuhan omzet mingguan: ${item.pertumbuhanOmzetMingguan == null ? "-" : `${item.pertumbuhanOmzetMingguan}%`} (laporan KPI disetujui)`,
          `Margin: ${item.marginPersen == null ? "-" : `${item.marginPersen}%`} (${item.marginSumber})`, `Kebutuhan modal: Rp${item.kebutuhanModal ?? "-"}`,
          `Kapasitas pasok: ${item.kapasitasPasok ?? "-"}`, `Skema: ${item.skema.join(", ")}`] },
      ] });
    noStore(res); res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="investor-${item.id}.pdf"`); res.end(pdf);
  }))(ctx));
  router.get("/investor/:id/pitch-deck", publik((inner) => (req, res) => handle(inner, res, async () => {
    const user = await requireInvestor(inner, req);
    const id = uuidParam(req.params.id);
    await detail(inner, user, id, "pitch_deck");
    const file = rows(await inner.database.raw(`SELECT ip.pitch_deck AS id FROM investor_profil ip
      WHERE ip.usaha = ? AND ip.disetujui_berbagi_pada IS NOT NULL
        AND ip.disetujui_kurator_pada IS NOT NULL AND ip.dicabut_pada IS NULL`, [id]))[0];
    if (!file?.id) throw fail();
    const asset = await new inner.services.AssetsService({ accountability: null, schema: await inner.getSchema() }).getAsset(file.id);
    if (asset.file.type !== "application/pdf") throw fail();
    noStore(res); res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="pitch-deck-${id}.pdf"`);
    res.setHeader("X-Content-Type-Options", "nosniff"); asset.stream.pipe(res);
  }))(ctx));
  router.post("/investor/:id/loi", publik((inner) => (req, res) => handle(inner, res, async () => {
    const user = await requireInvestor(inner, req);
    const id = uuidParam(req.params.id);
    const item = await detail(inner, user, id, "loi");
    if (!item.produkId) throw new ProgramError(409, "NO_PUBLISHED_PRODUCT", "Belum ada produk tayang untuk LOI.");
    const key = req.body?.idempotencyKey;
    if (typeof key !== "string" || !UUID.test(key) || typeof req.body?.pesan !== "string" ||
        !req.body.pesan.trim() || req.body.pesan.length > 2000) throw new ProgramError(400, "INVALID_PAYLOAD", "LOI tidak valid.");
    const identity = rows(await inner.database.raw(`SELECT first_name, last_name, email FROM directus_users WHERE id = ?`, [user]))[0];
    if (!identity?.email) throw new ProgramError(403, "INVESTOR_EMAIL_REQUIRED", "Email akun investor diperlukan.");
    const existing = rows(await inner.database.raw(`SELECT id, produk FROM produk_loi WHERE idempotency_key = ? AND investor_pengguna = ?`, [key, user]))[0];
    if (existing && existing.produk !== item.produkId) throw new ProgramError(409, "LOI_KEY_REUSED", "Kunci LOI dipakai untuk produk lain.");
    const saved = existing ?? rows(await inner.database.raw(`INSERT INTO produk_loi
      (produk, nama, email, pesan, persetujuan_kontak, idempotency_key, investor_pengguna)
      VALUES (?, ?, ?, ?, TRUE, ?, ?) ON CONFLICT DO NOTHING RETURNING id, produk`,
      [item.produkId, [identity.first_name, identity.last_name].filter(Boolean).join(" ") || "Investor terverifikasi",
        identity.email, req.body.pesan.trim(), key, user]))[0];
    const record = saved ?? rows(await inner.database.raw(`SELECT id, produk FROM produk_loi WHERE idempotency_key = ? AND investor_pengguna = ?`, [key, user]))[0];
    if (!record) throw new ProgramError(409, "LOI_KEY_REUSED", "Kunci LOI sudah dipakai.");
    if (record?.produk !== item.produkId) throw new ProgramError(409, "LOI_KEY_REUSED", "Kunci LOI dipakai untuk produk lain.");
    noStore(res); res.json({ data: { id: record.id, duplikat: Boolean(existing || !saved) } });
  }))(ctx));
};

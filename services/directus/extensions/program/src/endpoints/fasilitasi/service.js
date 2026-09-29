// Facilitation cards (R03/N7-03): eight fixed bentuk, uang/barang/jasa filter,
// remaining quota from approved source, server-time countdown. No fake forms:
// without an application flow the CTA points at petunjuk/kanal resmi.
import { ProgramError, noStore, rows, sendError } from "../../lib/utils/http.js";
import { objectBody, uuidParam } from "../../lib/validate.js";
const handle = (logger, res, fn) => fn().catch((error) => sendError(res, logger, error));
const iso = (v) => {
  if (v === null || v === undefined) return null;
  const t = v instanceof Date ? v : new Date(v);
  return Number.isFinite(t.getTime()) ? t.toISOString() : null;
};
export const BENTUK = ["penghargaan", "beasiswa", "operasional", "sarpras_produksi", "sarpras_pemasaran", "revitalisasi_gedung", "permodalan", "lainnya"];
export const BENTUK_BANTUAN = ["uang", "barang", "jasa"];
export function sisaKuota(row) {
  if (row.kuota === null || row.kuota === undefined) return null;
  return Math.max(0, Number(row.kuota) - Number(row.terisi ?? 0));
}
export function statusPendaftaran(row, now = new Date()) {
  const time = now.getTime();
  if (row.pendaftaran_selesai && new Date(row.pendaftaran_selesai).getTime() < time) return "ditutup";
  if (row.pendaftaran_mulai && new Date(row.pendaftaran_mulai).getTime() > time) return "segera";
  if (row.kuota !== null && row.kuota !== undefined && sisaKuota(row) === 0) return "penuh";
  return "dibuka";
}
function toKartu(row, now) {
  return { id: row.id, bentuk: row.bentuk, judul: row.judul, ringkasan: row.ringkasan ?? null, bentukBantuan: row.bentuk_bantuan, kuota: row.kuota === null ? null : Number(row.kuota), terisi: Number(row.terisi ?? 0), sisaKuota: sisaKuota({ kuota: row.kuota === null ? null : Number(row.kuota), terisi: Number(row.terisi ?? 0) }), pendaftaranMulai: iso(row.pendaftaran_mulai), pendaftaranSelesai: iso(row.pendaftaran_selesai), serverNow: now.toISOString(), statusPendaftaran: statusPendaftaran(row, now), petunjuk: row.petunjuk ?? null, kanalResmi: row.kanal_resmi ?? null };
}
export const listFasilitasi = ({ database, logger }) => (req, res) =>
  handle(logger, res, async () => {
    const bentuk = req.query?.bentuk ? String(req.query.bentuk) : null;
    const jenis = req.query?.jenis ? String(req.query.jenis) : null;
    if (bentuk && !BENTUK.includes(bentuk)) throw new ProgramError(400, "INVALID_PAYLOAD", "Bentuk tidak valid.");
    if (jenis && !BENTUK_BANTUAN.includes(jenis)) throw new ProgramError(400, "INVALID_PAYLOAD", "Jenis tidak valid.");
    const now = new Date();
    const kondisi = ["status_publikasi = 'terbit'"];
    const params = [];
    if (bentuk) { kondisi.push("bentuk = ?"); params.push(bentuk); }
    if (jenis) { kondisi.push("bentuk_bantuan = ?"); params.push(jenis); }
    const items = rows(await database.raw(`SELECT * FROM bantuan_fasilitasi WHERE ${kondisi.join(" AND ")} ORDER BY date_created`, params));
    noStore(res);
    res.json({ data: { items: items.map((r) => toKartu(r, now)), meta: { serverNow: now.toISOString(), jumlah: items.length } } });
  });
/** Staff curation of the filled quota counter (R03): integer, never above kuota. */
export const perbaruiTerisi = ({ database, logger }) => (req, res) =>
  handle(logger, res, async () => {
    const id = uuidParam(req.params?.id, "INVALID_BANTUAN_ID");
    const body = objectBody(req);
    const terisi = body.terisi;
    if (!Number.isInteger(terisi) || terisi < 0) throw new ProgramError(400, "INVALID_PAYLOAD", "Nilai terisi wajib bilangan bulat >= 0.");
    const row = await database.transaction(async (trx) => {
      const cur = rows(await trx.raw(`SELECT id, kuota FROM bantuan_fasilitasi WHERE id = ? FOR UPDATE`, [id]))[0];
      if (!cur) throw new ProgramError(404, "BANTUAN_NOT_FOUND", "Bantuan tidak ditemukan.");
      if (cur.kuota !== null && terisi > Number(cur.kuota)) throw new ProgramError(400, "TERISI_MELEBIHI_KUOTA", "Terisi tidak boleh melebihi kuota.");
      return rows(await trx.raw(`UPDATE bantuan_fasilitasi SET terisi = ?, date_updated = NOW() WHERE id = ? RETURNING *`, [terisi, id]))[0];
    });
    noStore(res);
    res.json({ data: { id: row.id, terisi: Number(row.terisi), kuota: row.kuota === null ? null : Number(row.kuota), sisaKuota: sisaKuota({ kuota: row.kuota === null ? null : Number(row.kuota), terisi: Number(row.terisi) }) } });
  });

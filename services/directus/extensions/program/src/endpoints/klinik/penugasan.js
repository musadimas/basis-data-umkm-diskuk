/**
 * Staff scope, status transitions and the audit trail of the clinic (Y09, M7-13): the
 * ProgramError + SQL wrappers around the pure rules in `rules.js` (which the Playwright mock
 * imports as well).
 *
 * A ticket is worked by clinic staff only, and "staff" is narrower here than the logged-in role:
 * provincial staff and Directus admins see every ticket, kab/kota staff see only tickets whose
 * business is registered in their own kota, and a pendamping sees the tickets assigned to them plus
 * the unassigned pool — where the first write has to be the claim itself, nothing else.
 *
 * Every accepted change leaves one audit row per kind of change, so a status or a note always
 * carries its actor and time; re-sending the unchanged status is not a transition and leaves no row.
 * The `versi` the client echoes back is the microsecond timestamp it last saw, so two officers
 * editing one ticket cannot silently overwrite each other.
 */
import { ProgramError } from "../../lib/utils/http.js";
import { VERSI, barisAudit, transisiSah } from "./rules.js";

/**
 * SQL condition (on alias t = konsultasi_tiket) limiting the kanban to the pemanggil's own work.
 * A ticket whose applicant typed the business name by hand has no `usaha` row, so it never matches
 * a kota: those are province-level triage and stay invisible to kab/kota staff.
 *
 * Bentuk pemanggil mengikuti module Cakupan Pemanggil (01): { admin, peran, kotaId, id }.
 * Daftar umum di `predikat(pemanggil, "tiket", "t")` menghasilkan klausa yang sama;
 * fungsi ini dipertahankan sebagai alias agar aturan kanal tetap dibaca di satu tempat.
 */
export function cakupanPetugas(pemanggil) {
  if (pemanggil?.admin || pemanggil?.peran === "provinsi") return { sql: "TRUE", bindings: [] };
  if (pemanggil?.peran === "kabkota") {
    if (pemanggil.kotaId == null) throw new ProgramError(403, "KOTA_NOT_ASSIGNED", "Petugas kab/kota belum memiliki penugasan kota.");
    return {
      sql: "EXISTS (SELECT 1 FROM usaha_tabular ut WHERE ut.id = t.usaha AND ut.kota_id = ?)",
      bindings: [pemanggil.kotaId],
    };
  }
  if (pemanggil?.peran === "pendamping") {
    return { sql: "(t.pendamping = ? OR t.pendamping IS NULL)", bindings: [pemanggil.id] };
  }
  return { sql: "FALSE", bindings: [] };
}

/** Rejects a status jump before anything is written; returns the changed status, if any. */
export function assertTransisi(update, statusSekarang) {
  if (update.status === undefined || update.status === statusSekarang) return;
  if (!transisiSah(statusSekarang, update.status)) {
    throw new ProgramError(409, "TRANSISI_TIDAK_VALID", `Status ${statusSekarang} cannot become ${update.status}.`);
  }
}

/** A write is stale when the client wrote against a version older than the stored one, and the
 * version is required (B24): without it the optimistic lock is optional, so two officers editing
 * one ticket can silently overwrite each other. */
export function assertVersi(versi, versiSekarang) {
  if (versi === undefined || versi === null) throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "versi" is required.');
  if (!VERSI.test(String(versi))) throw new ProgramError(400, "INVALID_PAYLOAD", 'The field "versi" is not valid.');
  if (String(versi) !== versiSekarang) {
    throw new ProgramError(409, "TIKET_BERUBAH", "This ticket changed after you opened it. Reload and try again.");
  }
}

/** One INSERT per row `barisAudit` decides on, in the same transaction as the update it describes. */
export async function catatAudit(trx, { tiket, aktor, aktorNama, statusDari, statusKe, perubahan }) {
  const nama = aktorNama ? String(aktorNama).slice(0, 160) : null;
  for (const baris of barisAudit({ statusDari, statusKe, perubahan })) {
    await trx.raw(
      `INSERT INTO konsultasi_tiket_audit (tiket, aktor, aktor_nama, aksi, status_dari, status_ke, perubahan)
       VALUES (?, ?, ?, ?, ?, ?, ?::jsonb)`,
      [tiket, aktor ?? null, nama, baris.aksi, baris.statusDari, baris.statusKe, JSON.stringify(baris.perubahan)],
    );
  }
}

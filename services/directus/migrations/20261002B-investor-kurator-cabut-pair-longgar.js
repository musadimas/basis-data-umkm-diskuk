/**
 * Review QC 2026-10-02: `kurator_dicabut_oleh … ON DELETE SET NULL` (20261001B) bertentangan
 * dengan CHECK pasangan `(oleh IS NULL) = (pada IS NULL)`, sehingga menghapus akun kurator yang
 * pernah mencabut persetujuan gagal. Status "Persetujuan dicabut" hanya membaca
 * `kurator_dicabut_pada`, jadi pelaku boleh hilang selama waktunya tetap ada.
 */
export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE investor_profil DROP CONSTRAINT IF EXISTS investor_profil_kurator_cabut_pair;
    ALTER TABLE investor_profil ADD CONSTRAINT investor_profil_kurator_cabut_pair
      CHECK (kurator_dicabut_oleh IS NULL OR kurator_dicabut_pada IS NOT NULL);
  `);
};

export const down = async (knex) => {
  // Gagal bila sudah ada baris dicabut yang pelakunya terhapus; itu memang keadaan yang
  // tidak bisa dinyatakan oleh constraint lama.
  await knex.raw(`
    ALTER TABLE investor_profil DROP CONSTRAINT IF EXISTS investor_profil_kurator_cabut_pair;
    ALTER TABLE investor_profil ADD CONSTRAINT investor_profil_kurator_cabut_pair
      CHECK ((kurator_dicabut_oleh IS NULL) = (kurator_dicabut_pada IS NULL));
  `);
};

import crypto from "node:crypto";
import { createRequire } from "node:module";
import { buatKota, buatUsaha, buatUser, uuid } from "../../../../test-support/fixtures.mjs";

const require = createRequire(import.meta.url);
const { APPLICATION_ROLE_ID } = require("../../../../analytics-shared/cakupan.cjs");

export const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });

/** Env dengan kunci Ed25519 baru, seperti secret runtime PASSPORT_SIGNING_PRIVATE_KEY_B64. */
export function envPassport() {
  const { privateKey } = crypto.generateKeyPairSync("ed25519");
  return {
    PASSPORT_SIGNING_PRIVATE_KEY_B64: Buffer.from(privateKey.export({ type: "pkcs8", format: "pem" })).toString("base64"),
    PUBLIC_WEB_URL: "http://127.0.0.1:3000",
  };
}

/** Dua kota, satu petugas per peran, dan satu usaha di tiap kota. */
export async function siapkanTalent(db) {
  await buatKota(db, { id: 7, nama: "KABUPATEN SUBANG" });
  await buatKota(db, { id: 9, nama: "KOTA BANDUNG" });
  const subang = await buatUsaha(db, { nama: "Usaha Subang", kotaId: 7, kotaNama: "KABUPATEN SUBANG", kegiatanUtama: "Kerajinan Kulit" });
  const bandung = await buatUsaha(db, { nama: "Usaha Bandung", kotaId: 9, kotaNama: "KOTA BANDUNG" });
  const provinsi = await buatUser(db, { appRole: "provinsi" });
  const kabkotaSubang = await buatUser(db, { appRole: "kabkota", kotaScope: 7 });
  const kabkotaTanpaKota = await buatUser(db, { appRole: "kabkota" });
  const pendamping = await buatUser(db, { appRole: "pendamping" });
  const umkm = await buatUser(db, { appRole: "umkm", usahaId: subang.id });
  return { subang, bandung, provinsi, kabkotaSubang, kabkotaTanpaKota, pendamping, umkm };
}

/** Pengajuan langsung di tabel; `skor` mengisi kolom skor dan status `dinilai`/`disetujui`. */
export async function buatPengajuan(db, { usahaId, status = "draft", skor = null, kapasitas = null, satuan = null, dateCreated = null, catatan = null } = {}) {
  const id = uuid();
  const row = { id, usaha: usahaId, status, kapasitas_produksi: kapasitas, satuan, catatan };
  if (dateCreated) row.date_created = dateCreated;
  if (skor) {
    Object.assign(row, {
      skor_finansial: skor.finansial,
      skor_pasar: skor.pasar,
      skor_legalitas: skor.legalitas,
      skor_sdm: skor.sdm,
      skor_total: (skor.finansial + skor.pasar + skor.legalitas + skor.sdm) / 4,
      rubrik_versi: "placeholder-v0",
      dinilai_at: new Date(),
    });
  }
  await db("talent_pengajuan").insert(row);
  return id;
}

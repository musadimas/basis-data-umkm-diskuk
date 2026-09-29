import crypto from "node:crypto";
import { Readable } from "node:stream";
import { createChallenge, pbkdf2, solveChallenge } from "altcha/lib";
import { createRequire } from "node:module";
import { createDirectusFakes } from "../../../../test-support/directus-fakes.mjs";
import { poliTersedia, uuid } from "../../../../test-support/fixtures.mjs";
import { jakartaDate } from "../../src/endpoints/kpi/rules.js";

const require = createRequire(import.meta.url);
export const { APPLICATION_ROLE_ID } = require("../../../../analytics-shared/cakupan.cjs");

export const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });
export const ENV = { SECRET: "unit-test-directus-secret" };
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

/** Captcha ALTCHA yang benar-benar terpecahkan (kunci sama dengan lib/captcha.js). */
export async function captchaSah(env = ENV) {
  const secret = crypto.createHmac("sha256", env.SECRET).update("diskuk-auth-captcha-v1").digest("hex");
  const challenge = await createChallenge({
    algorithm: "PBKDF2/SHA-256",
    cost: 10,
    deriveKey: pbkdf2.deriveKey,
    hmacSignatureSecret: secret,
    expiresAt: new Date(Date.now() + 300_000),
  });
  const solution = await solveChallenge({ challenge, deriveKey: pbkdf2.deriveKey });
  return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
}

/** Hari kerja Jakarta ke-`ke` (1 = yang pertama sesudah hari ini), format YYYY-MM-DD. */
export function hariKerja(ke = 1) {
  let ditemukan = 0;
  for (let hari = 1; hari <= 30; hari += 1) {
    const tanggal = jakartaDate(new Date(Date.now() + hari * 86_400_000));
    const weekday = new Date(`${tanggal}T00:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    ditemukan += 1;
    if (ditemukan === ke) return tanggal;
  }
  throw new Error("tidak ada hari kerja dalam rentang");
}

export async function payloadTiket(db, patch = {}) {
  return {
    namaUsaha: "Kedai Uji",
    namaKontak: "Wawan",
    whatsapp: "0812-3456-7890",
    deskripsi: "Saya butuh pendampingan legalitas usaha.",
    poli: await poliTersedia(db),
    moda: "daring",
    slot: "09:00",
    tanggal: hariKerja(1),
    consent: true,
    ...patch,
  };
}

/** Request multipart siap pakai untuk `mountEndpoint#call` (`pipe` dimiliki sendiri karena spread menghilangkan prototype). */
export function formMultipart({ payload, captcha, lampiran = [], fileField = "lampiran" }) {
  const batas = `----uji${uuid()}`;
  const bagian = [];
  const isi = (nama, nilai) => bagian.push(Buffer.from(`--${batas}\r\nContent-Disposition: form-data; name="${nama}"\r\n\r\n${nilai}\r\n`));
  if (payload !== undefined) isi("payload", typeof payload === "string" ? payload : JSON.stringify(payload));
  if (captcha !== undefined) isi("captcha", captcha);
  lampiran.forEach((buffer, index) => {
    bagian.push(
      Buffer.from(`--${batas}\r\nContent-Disposition: form-data; name="${fileField}"; filename="berkas${index}.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`),
      buffer,
      Buffer.from("\r\n"),
    );
  });
  bagian.push(Buffer.from(`--${batas}--\r\n`));
  const badan = Buffer.concat(bagian);
  return {
    headers: { "content-type": `multipart/form-data; boundary=${batas}` },
    pipe: (tujuan) => Readable.from([badan]).pipe(tujuan),
  };
}

/** Fake Directus di seam + `deleteMany` (kompensasi hapus file) yang belum ada di `directus-fakes.mjs`. */
export function fakeDirectus(db) {
  const fakes = createDirectusFakes({ db });
  fakes.services.FilesService.prototype.deleteMany = async function deleteMany(ids) {
    await db("directus_files").whereIn("id", ids).del();
    for (const id of ids) fakes.files.delete(id);
    return ids;
  };
  return fakes;
}

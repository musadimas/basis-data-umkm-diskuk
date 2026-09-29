import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { createDirectusFakes } from "../../../../test-support/directus-fakes.mjs";
import {
  buatFile,
  buatKota,
  buatLegalitas,
  buatPeserta,
  buatProduk,
  buatTiket,
  buatUsaha,
  buatUser,
  pasangFoto,
  poliTersedia,
} from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { KURASI_FOLDER_ID } from "../../src/endpoints/katalog/service.js";

test("template Postgres memuat skema ter-migrasi, ekstensi, dan fixture nyata", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);

  // Skema hasil migrasi: tabel-tabel kunci ada, dibaca lewat katalog.
  const schema = await db.raw(
    "SELECT to_regclass('public.konsultasi_tiket') AS tiket, to_regclass('public.usaha_tabular') AS tabular, to_regclass('public.analitik_usaha_current') AS analitik",
  );
  assert.equal(schema.rows[0].tiket, "konsultasi_tiket");
  assert.equal(schema.rows[0].tabular, "usaha_tabular");
  assert.equal(schema.rows[0].analitik, "analitik_usaha_current");

  const ext = await db.raw(
    "SELECT extname FROM pg_extension WHERE extname IN ('postgis','pg_trgm') ORDER BY extname",
  );
  assert.deepEqual(ext.rows.map((row) => row.extname), ["pg_trgm", "postgis"]);

  // Fixture menulis baris nyata ke semua entitas inti.
  await buatKota(db, { id: 7, nama: "KABUPATEN SUBANG" });
  const usaha = await buatUsaha(db, {
    nama: "Keripik Uji",
    kotaId: 7,
    kotaNama: "KABUPATEN SUBANG",
    nib: "1234567890123",
  });
  const user = await buatUser(db, { appRole: "kabkota", kotaScope: 7 });
  const peserta = await buatPeserta(db, { usahaId: usaha.id, pendampingId: user.id });
  const produk = await buatProduk(db, { usahaId: usaha.id });
  const foto = await buatFile(db, { folder: KURASI_FOLDER_ID, uploadedBy: user.id });
  await pasangFoto(db, { produkId: produk.id, fileId: foto.id });
  const legalitas = await buatLegalitas(db, { usahaId: usaha.id, berlakuHingga: "2030-01-01" });
  const poliId = await poliTersedia(db);
  assert.ok(poliId, "migrasi harus menyemai konsultasi_poli");
  const tiket = await buatTiket(db, { usahaId: usaha.id, pemohonId: user.id, poliId });

  const tabular = await db("usaha_tabular").where({ id: usaha.id }).first();
  assert.equal(tabular.kota_id, 7);
  assert.equal((await db("program_peserta").where({ id: peserta.id })).length, 1);
  assert.equal((await db("produk_foto").where({ produk_id: produk.id })).length, 1);
  assert.equal((await db("usaha_legalitas").where({ id: legalitas.id })).length, 1);
  assert.equal((await db("konsultasi_tiket").where({ id: tiket.id })).length, 1);

  // Fake Directus: upload menulis baris directus_files nyata, getAsset mengembalikan bentuk asli.
  const fakes = createDirectusFakes({ db });
  const uploaded = await new fakes.services.FilesService({ schema: {}, accountability: null }).uploadOne(
    Readable.from([Buffer.from("halo")]),
    { storage: "local", folder: KURASI_FOLDER_ID, filename_download: "uji.png", type: "image/png" },
  );
  const row = await db("directus_files").where({ id: uploaded }).first();
  assert.equal(row.type, "image/png");
  assert.equal(Number(row.filesize), 4);
  const asset = await new fakes.services.AssetsService({ schema: {}, accountability: null }).getAsset(uploaded);
  assert.equal(asset.file.type, "image/png");
  const chunks = [];
  for await (const chunk of asset.stream) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString(), "halo");
  await new fakes.services.MailService({}).send({ to: "uji@contoh.test", subject: "Uji", text: "Isi" });
  assert.equal(fakes.mails.length, 1);
});

import assert from "node:assert/strict";
import test from "node:test";
import registerPeta from "../../src/endpoints/peta/index.js";
import { loadLegalitas } from "../../src/lib/usaha.js";
import { buatLegalitas, buatUsaha } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";
import { akun, siapkanTalent } from "./talent-support.mjs";

async function siap(t) {
  const { db } = await withDatabase(t);
  const dunia = await siapkanTalent(db);
  const { call } = mountEndpoint(registerPeta, { database: db });
  const kartu = (pemanggil, usahaId) => call("GET", `/${usahaId}`, { accountability: akun(pemanggil.id) });
  return { db, kartu, ...dunia };
}

const tanggalWib = async (db, hari = 0) =>
  (await db.raw("SELECT ((now() AT TIME ZONE 'Asia/Jakarta')::date + ?::integer)::text AS d", [hari])).rows[0].d;

test("provinsi melihat kartu usaha mana pun tanpa NIK; kolom kartu terisi dari SIDT", { skip: pgSkipReason() }, async (t) => {
  const { db, kartu, subang, bandung, provinsi } = await siap(t);
  await db("usaha").where({ id: subang.id }).update({ skala: "small", kegiatan_utama: "Kerajinan Kulit", omzet_tahunan: 250_000_000, talent_status: "accelerator", talent_batch: "Batch 1" });
  const nik = (await db("pelaku_usaha").where({ id: subang.pelakuId }).first()).nik;

  const hasil = await kartu(provinsi, subang.id);
  assert.equal(hasil.res.statusCode, 200, JSON.stringify(hasil.res.body));
  const data = hasil.res.body.data;
  assert.equal(data.nama, "Usaha Subang");
  assert.equal(data.pemilik, "Pelaku Uji");
  assert.equal(data.skala, "small");
  assert.equal(data.kegiatanUtama, "Kerajinan Kulit");
  assert.equal(data.omzetTahunan, 250_000_000);
  assert.equal(data.talentStatus, "accelerator");
  assert.equal(data.talentBatch, "Batch 1");
  assert.ok(!JSON.stringify(hasil.res.body).includes(nik), "NIK tidak boleh terkirim");
  assert.equal((await kartu(provinsi, bandung.id)).res.statusCode, 200);
});

test("kabkota: kota sendiri boleh, kota lain 404 seragam, tanpa penugasan 403", { skip: pgSkipReason() }, async (t) => {
  const { kartu, subang, bandung, kabkotaSubang, kabkotaTanpaKota } = await siap(t);
  assert.equal((await kartu(kabkotaSubang, subang.id)).res.statusCode, 200);

  const luar = await kartu(kabkotaSubang, bandung.id);
  assert.equal(luar.res.statusCode, 404);
  assert.equal(luar.res.body.errors[0].extensions.code, "NOT_FOUND");

  const tanpa = await kartu(kabkotaTanpaKota, subang.id);
  assert.equal(tanpa.res.statusCode, 403);
  assert.equal(tanpa.res.body.errors[0].extensions.code, "KOTA_NOT_ASSIGNED");
});

test("umkm hanya kartu usahanya sendiri; pendamping ditolak", { skip: pgSkipReason() }, async (t) => {
  const { kartu, subang, bandung, umkm, pendamping } = await siap(t);
  assert.equal((await kartu(umkm, subang.id)).res.statusCode, 200);
  assert.equal((await kartu(umkm, bandung.id)).res.statusCode, 404);
  const ditolak = await kartu(pendamping, subang.id);
  assert.equal(ditolak.nextError?.statusCode ?? ditolak.res.statusCode, 403);
});

test("usaha tanpa kota: provinsi 200 dengan kartu utuh, kabkota 404", { skip: pgSkipReason() }, async (t) => {
  const { db, kartu, provinsi, kabkotaSubang } = await siap(t);
  const tanpaKota = await buatUsaha(db, { nama: "Usaha Tanpa Kota", kotaId: null });
  const prov = await kartu(provinsi, tanpaKota.id);
  assert.equal(prov.res.statusCode, 200, JSON.stringify(prov.res.body));
  assert.equal(prov.res.body.data.nama, "Usaha Tanpa Kota");
  assert.deepEqual(prov.res.body.data.sertifikasi, []);
  assert.equal((await kartu(kabkotaSubang, tanpaKota.id)).res.statusCode, 404);
});

test("id tak valid 400, usaha tak dikenal 404", { skip: pgSkipReason() }, async (t) => {
  const { kartu, provinsi } = await siap(t);
  assert.equal((await kartu(provinsi, "bukan-uuid")).res.statusCode, 400);
  assert.equal((await kartu(provinsi, "5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a99")).res.statusCode, 404);
});

test("sertifikasi: hanya status terbit, kedaluwarsa menurut tanggal WIB, tanpa duplikat, terurut", { skip: pgSkipReason() }, async (t) => {
  const { db, kartu, subang, provinsi } = await siap(t);
  const hariIni = await tanggalWib(db);
  const kemarin = await tanggalWib(db, -1);
  const besok = await tanggalWib(db, 1);
  await buatLegalitas(db, { usahaId: subang.id, jenis: "pirt", status: "terbit", berlakuHingga: besok });
  await buatLegalitas(db, { usahaId: subang.id, jenis: "pirt", status: "terbit", berlakuHingga: null }); // duplikat jenis
  await buatLegalitas(db, { usahaId: subang.id, jenis: "halal", status: "terbit", berlakuHingga: hariIni }); // masih berlaku sampai akhir hari WIB
  await buatLegalitas(db, { usahaId: subang.id, jenis: "bpom", status: "terbit", berlakuHingga: kemarin }); // kedaluwarsa
  await buatLegalitas(db, { usahaId: subang.id, jenis: "sni", status: "dalam_proses" });
  await buatLegalitas(db, { usahaId: subang.id, jenis: "hki", status: "kedaluwarsa" });

  const hasil = await kartu(provinsi, subang.id);
  assert.deepEqual(hasil.res.body.data.sertifikasi, ["halal", "pirt"]);

  const status = Object.fromEntries((await loadLegalitas(db, subang.id)).map((item) => [item.jenis, item.status]));
  assert.equal(status.bpom, "kedaluwarsa");
  assert.equal(status.halal, "terbit");
  assert.equal(status.sni, "dalam_proses");
});

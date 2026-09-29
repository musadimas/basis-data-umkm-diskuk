import assert from "node:assert/strict";
import test from "node:test";
import registerPassport from "../../src/endpoints/passport/index.js";
import { buatLegalitas, buatProduk, uuid } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";
import { akun, buatPengajuan, envPassport, siapkanTalent } from "./talent-support.mjs";

const SKOR = { finansial: 90, pasar: 80, legalitas: 70, sdm: 60 };
const kode = (hasil) => hasil.res.body?.errors?.[0]?.extensions?.code;

/** Usaha Subang sudah disetujui BA dan berada di Talent Pool, jadi layak terbit. */
async function siap(t, { layak = true } = {}) {
  const { db } = await withDatabase(t);
  const dunia = await siapkanTalent(db);
  if (layak) {
    await buatPengajuan(db, { usahaId: dunia.subang.id, status: "disetujui", skor: SKOR });
    await db("usaha").where({ id: dunia.subang.id }).update({ talent_status: "talent_pool" });
  }
  const env = envPassport();
  const { call } = mountEndpoint(registerPassport, { database: db, env });
  return { db, call, env, ...dunia };
}

const terbitkan = (call, provinsi, usahaId) =>
  call("POST", "/", { accountability: akun(provinsi.id), body: { usaha: usahaId } });
const verifikasi = (call, kodePassport) => call("GET", `/verify/${kodePassport}`, { accountability: null });

test("terbit -> verifikasi publik -> tamper -> cabut -> terbit ulang", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, provinsi } = await siap(t);
  await buatLegalitas(db, { usahaId: subang.id, jenis: "halal", status: "terbit" });
  const layak = await buatProduk(db, { usahaId: subang.id, nama: "Tayang", statusKurasi: "tayang" });
  await buatProduk(db, { usahaId: subang.id, nama: "Menunggu", statusKurasi: "menunggu" });

  const terbit = await terbitkan(call, provinsi, subang.id);
  assert.equal(terbit.res.statusCode, 201, JSON.stringify(terbit.res.body));
  const pertama = terbit.res.body.data;
  assert.equal(pertama.status, "aktif");
  assert.equal(pertama.qrTalentPassportCode, pertama.kode);
  assert.equal(pertama.skor.kinerja, 0);
  assert.equal(pertama.payload.badges.some((b) => b.key === "naik_kelas"), true); // (90+80+70+60)/4 = 75
  assert.deepEqual(pertama.payload.sertifikasi, ["halal"]);

  // Publik, tanpa sesi: payload, kunci publik, dan hanya produk tayang; tanpa NIK.
  const publik = await verifikasi(call, pertama.kode.toLowerCase());
  assert.equal(publik.res.statusCode, 200);
  assert.equal(publik.res.body.data.valid, true);
  assert.deepEqual(publik.res.body.data.portfolio.map((p) => p.id), [layak.id]);
  assert.ok(publik.res.body.data.publicKey.jwk);
  assert.doesNotMatch(JSON.stringify(publik.res.body), /nik/i);

  // Tamper: payload diubah langsung di DB -> tanda tangan tak cocok.
  const payload = { ...pertama.payload, skor: { ...pertama.payload.skor, finansial: 100 } };
  await db("talent_passport").where({ id: pertama.id }).update({ payload: JSON.stringify(payload) });
  const rusak = await verifikasi(call, pertama.kode);
  assert.deepEqual(rusak.res.body.data, { kode: pertama.kode, qrTalentPassportCode: pertama.kode, valid: false, status: "tidak_valid" });
  await db("talent_passport").where({ id: pertama.id }).update({ payload: JSON.stringify(pertama.payload) });
  assert.equal((await verifikasi(call, pertama.kode)).res.body.data.valid, true);

  // Cabut: verifikasi melaporkan dicabut; mencabut lagi 404.
  const cabut = await call("POST", `/${pertama.id}/cabut`, { accountability: akun(provinsi.id) });
  assert.equal(cabut.res.statusCode, 200, JSON.stringify(cabut.res.body));
  assert.equal(cabut.res.body.data.status, "dicabut");
  const dicabut = await verifikasi(call, pertama.kode);
  assert.equal(dicabut.res.body.data.valid, false);
  assert.equal(dicabut.res.body.data.status, "dicabut");
  const lagi = await call("POST", `/${pertama.id}/cabut`, { accountability: akun(provinsi.id) });
  assert.equal(lagi.res.statusCode, 404);
  assert.equal(kode(lagi), "PASSPORT_NOT_FOUND");

  // Terbit ulang: kode baru, satu passport aktif.
  const ulang = await terbitkan(call, provinsi, subang.id);
  assert.equal(ulang.res.statusCode, 201);
  assert.notEqual(ulang.res.body.data.kode, pertama.kode);
  assert.equal((await verifikasi(call, ulang.res.body.data.kode)).res.body.data.valid, true);
  assert.equal((await db("talent_passport").where({ usaha: subang.id, status: "aktif" })).length, 1);
  assert.equal((await db("talent_passport").where({ usaha: subang.id })).length, 2);
});

test("terbit ulang mencabut passport aktif sebelumnya; dua terbit paralel tetap menyisakan satu aktif", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, provinsi } = await siap(t);
  const hasil = await Promise.all([terbitkan(call, provinsi, subang.id), terbitkan(call, provinsi, subang.id), terbitkan(call, provinsi, subang.id)]);
  assert.deepEqual(hasil.map((item) => item.res.statusCode), [201, 201, 201], JSON.stringify(hasil.map((item) => item.res.body)));
  assert.equal((await db("talent_passport").where({ usaha: subang.id, status: "aktif" })).length, 1);
  assert.equal((await db("talent_passport").where({ usaha: subang.id })).length, 3);
});

test("usaha yang belum layak tidak bisa terbit (409) dan tidak meninggalkan baris", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, bandung, provinsi } = await siap(t);

  // Bandung belum masuk Talent Pool.
  const belumPool = await terbitkan(call, provinsi, bandung.id);
  assert.equal(belumPool.res.statusCode, 409);
  assert.equal(kode(belumPool), "PASSPORT_BELUM_MEMENUHI");

  // Di pool tetapi tanpa pengajuan yang disetujui.
  await db("talent_pengajuan").where({ usaha: subang.id }).delete();
  const tanpaPengajuan = await terbitkan(call, provinsi, subang.id);
  assert.equal(tanpaPengajuan.res.statusCode, 409);
  assert.equal((await db("talent_passport")).length, 0);
});

test("terbit hanya provinsi; kabkota dan umkm 403; usaha tak dikenal 404", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, provinsi, kabkotaSubang, umkm } = await siap(t);
  for (const pemanggil of [kabkotaSubang, umkm]) {
    const hasil = await terbitkan(call, pemanggil, subang.id);
    assert.equal(hasil.nextError?.statusCode ?? hasil.res.statusCode, 403);
  }
  const asing = await terbitkan(call, provinsi, uuid());
  assert.equal(asing.res.statusCode, 404);
  assert.equal((await db("talent_passport")).length, 0);
});

test("badge legalitas: hanya yang terbit menurut WIB; kedaluwarsa hari ini tidak masuk", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, provinsi } = await siap(t);
  const wib = (await db.raw("SELECT (now() AT TIME ZONE 'Asia/Jakarta')::date::text AS d")).rows[0].d;
  const kemarin = (await db.raw("SELECT ((now() AT TIME ZONE 'Asia/Jakarta')::date - 1)::text AS d")).rows[0].d;
  await buatLegalitas(db, { usahaId: subang.id, jenis: "halal", status: "terbit", berlakuHingga: wib }); // berlaku sampai hari ini WIB
  await buatLegalitas(db, { usahaId: subang.id, jenis: "pirt", status: "terbit", berlakuHingga: kemarin });
  const terbit = await terbitkan(call, provinsi, subang.id);
  assert.equal(terbit.res.statusCode, 201, JSON.stringify(terbit.res.body));
  assert.deepEqual(terbit.res.body.data.payload.sertifikasi, ["halal"]);
});

test("baca passport: scope usaha, eligibilitas, dan hak menerbitkan", { skip: pgSkipReason() }, async (t) => {
  const { call, subang, bandung, provinsi, kabkotaSubang, umkm } = await siap(t);
  const baca = (pemanggil, usahaId) => call("GET", "/", { accountability: akun(pemanggil.id), query: { usaha: usahaId } });

  const prov = await baca(provinsi, subang.id);
  assert.equal(prov.res.statusCode, 200);
  assert.equal(prov.res.body.data.eligible, true);
  assert.equal(prov.res.body.data.bisaMenerbitkan, true);
  assert.equal(prov.res.body.data.passport, null);

  const kabkota = await baca(kabkotaSubang, subang.id);
  assert.equal(kabkota.res.body.data.bisaMenerbitkan, false);
  assert.equal((await baca(kabkotaSubang, bandung.id)).res.statusCode, 404);

  const belum = await baca(provinsi, bandung.id);
  assert.equal(belum.res.body.data.eligible, false);
  assert.equal((await baca(umkm, subang.id)).res.statusCode, 200);
  assert.equal((await baca(umkm, bandung.id)).res.statusCode, 404);

  const rusak = await call("GET", "/", { accountability: akun(provinsi.id), query: { usaha: "bukan-uuid" } });
  assert.equal(rusak.res.statusCode, 400);
});

test("verifikasi: kode yang tidak dikenal 404", { skip: pgSkipReason() }, async (t) => {
  const { call } = await siap(t);
  const asing = await verifikasi(call, "TP0000000000");
  assert.equal(asing.res.statusCode, 404);
  assert.equal(kode(asing), "PASSPORT_NOT_FOUND");
});

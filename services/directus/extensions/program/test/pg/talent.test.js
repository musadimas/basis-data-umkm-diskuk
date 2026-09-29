import assert from "node:assert/strict";
import test from "node:test";
import registerTalent from "../../src/endpoints/talent/index.js";
import { buatFile, buatLegalitas, uuid } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";
import { akun, buatPengajuan, siapkanTalent } from "./talent-support.mjs";

const SKOR = { finansial: 80, pasar: 80, legalitas: 80, sdm: 80 };
const kode = (hasil) => hasil.res.body?.errors?.[0]?.extensions?.code;

async function siap(t) {
  const { db } = await withDatabase(t);
  const dunia = await siapkanTalent(db);
  const { call } = mountEndpoint(registerTalent, { database: db });
  return { db, call, ...dunia };
}

test("scope usaha: kabkota hanya kotanya (404 seragam di luar), tanpa penugasan 403, NIK tersamar", { skip: pgSkipReason() }, async (t) => {
  const { call, subang, bandung, kabkotaSubang, kabkotaTanpaKota, provinsi } = await siap(t);

  const dalam = await call("GET", `/usaha/${subang.id}`, { accountability: akun(kabkotaSubang.id) });
  assert.equal(dalam.res.statusCode, 200, JSON.stringify(dalam.res.body));
  assert.match(dalam.res.body.data.usaha.pemilik.nikMasked, /^\*+\d{4}$/);
  assert.equal(dalam.res.body.data.pengajuan, null);

  const luar = await call("GET", `/usaha/${bandung.id}`, { accountability: akun(kabkotaSubang.id) });
  assert.equal(luar.res.statusCode, 404);
  assert.equal(kode(luar), "NOT_FOUND");

  const tanpa = await call("GET", `/usaha/${subang.id}`, { accountability: akun(kabkotaTanpaKota.id) });
  assert.equal(tanpa.res.statusCode, 403);
  assert.equal(kode(tanpa), "KOTA_NOT_ASSIGNED");

  const prov = await call("GET", `/usaha/${bandung.id}`, { accountability: akun(provinsi.id) });
  assert.equal(prov.res.statusCode, 200);
});

test("daftar pengajuan: kabkota melihat kotanya saja, provinsi semuanya, urut skor tertinggi", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, bandung, kabkotaSubang, kabkotaTanpaKota, provinsi } = await siap(t);
  await buatPengajuan(db, { usahaId: subang.id, status: "dinilai", skor: { ...SKOR, pasar: 40 } });
  await buatPengajuan(db, { usahaId: bandung.id, status: "dinilai", skor: SKOR });

  const kabkota = await call("GET", "/pengajuan", { accountability: akun(kabkotaSubang.id) });
  assert.equal(kabkota.res.statusCode, 200);
  assert.deepEqual(kabkota.res.body.data.map((p) => p.usahaInfo.kota), ["KABUPATEN SUBANG"]);

  const semua = await call("GET", "/pengajuan", { accountability: akun(provinsi.id) });
  assert.deepEqual(semua.res.body.data.map((p) => p.usahaInfo.nama), ["Usaha Bandung", "Usaha Subang"]);

  const filter = await call("GET", "/pengajuan", { accountability: akun(provinsi.id), query: { status: "disetujui" } });
  assert.deepEqual(filter.res.body.data, []);

  const tanpa = await call("GET", "/pengajuan", { accountability: akun(kabkotaTanpaKota.id) });
  assert.equal(kode(tanpa), "KOTA_NOT_ASSIGNED");
});

test("membuka pengajuan: 201, usaha menjadi nominated, duplikat terbuka 409, kolom SIDT tak tersentuh", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, bandung, kabkotaSubang } = await siap(t);
  const body = { usaha: subang.id, kapasitasProduksi: 200, satuan: "unit", kesiapanLegalitas: { halal: "terbit" }, nama: "Disusupkan", omzetTahunan: 9e9 };

  const dibuat = await call("POST", "/pengajuan", { accountability: akun(kabkotaSubang.id), body });
  assert.equal(dibuat.res.statusCode, 201, JSON.stringify(dibuat.res.body));
  assert.equal(dibuat.res.body.data.status, "draft");
  assert.deepEqual(dibuat.res.body.data.kesiapanLegalitas, { halal: "terbit" });
  const usaha = await db("usaha").where({ id: subang.id }).first();
  assert.equal(usaha.talent_status, "nominated");
  assert.equal(usaha.nama, "Usaha Subang");
  assert.notEqual(Number(usaha.omzet_tahunan), 9e9);

  const ganda = await call("POST", "/pengajuan", { accountability: akun(kabkotaSubang.id), body });
  assert.equal(ganda.res.statusCode, 409);
  assert.equal(kode(ganda), "PENGAJUAN_SUDAH_ADA");
  assert.equal((await db("talent_pengajuan").where({ usaha: subang.id })).length, 1);

  // Usaha di luar kota petugas: 404 seragam dan tanpa baris baru (transaksi dibatalkan).
  const luar = await call("POST", "/pengajuan", { accountability: akun(kabkotaSubang.id), body: { usaha: bandung.id } });
  assert.equal(luar.res.statusCode, 404);
  assert.equal((await db("talent_pengajuan").where({ usaha: bandung.id })).length, 0);
});

test("berkas komitmen yang tak ada menjadi 400 INVALID_REFERENCE dan tidak menyisakan baris", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, provinsi } = await siap(t);
  const hasil = await call("POST", "/pengajuan", {
    accountability: akun(provinsi.id),
    body: { usaha: subang.id, suratKomitmen: uuid() },
  });
  assert.equal(hasil.res.statusCode, 400);
  assert.equal(kode(hasil), "INVALID_REFERENCE");
  assert.equal((await db("talent_pengajuan").where({ usaha: subang.id })).length, 0);
});

test("payload tidak valid ditolak 400 tanpa menulis apa pun", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, provinsi } = await siap(t);
  const kasus = [
    { usaha: "bukan-uuid" },
    { usaha: subang.id, kesiapanLegalitas: { halal: "mungkin" } },
    { usaha: subang.id, kesiapanLegalitas: { nib: "terbit" } },
    { usaha: subang.id, kapasitasProduksi: -1 },
    { usaha: subang.id, literasiQris: "ya" },
    { usaha: subang.id, suratKomitmen: "berkas.pdf" },
    { usaha: subang.id, satuan: "x".repeat(33) },
  ];
  for (const body of kasus) {
    const hasil = await call("POST", "/pengajuan", { accountability: akun(provinsi.id), body });
    assert.equal(hasil.res.statusCode, 400, JSON.stringify(body));
  }
  const array = await call("POST", "/pengajuan", { accountability: akun(provinsi.id), body: [] });
  assert.equal(array.res.statusCode, 400);
  assert.equal((await db("talent_pengajuan")).length, 0);
});

test("ubah pengajuan menghapus skor lama; pengajuan tertutup 409; petugas kota lain 404", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, kabkotaSubang, provinsi } = await siap(t);
  const id = await buatPengajuan(db, { usahaId: subang.id, status: "dinilai", skor: SKOR });

  const ubah = await call("PATCH", `/pengajuan/${id}`, { accountability: akun(kabkotaSubang.id), body: { kapasitasProduksi: 5 } });
  assert.equal(ubah.res.statusCode, 200, JSON.stringify(ubah.res.body));
  assert.equal(ubah.res.body.data.status, "draft");
  assert.equal(ubah.res.body.data.skor, null);

  const tutup = await buatPengajuan(db, { usahaId: subang.id, status: "ditolak" });
  const tertutup = await call("PATCH", `/pengajuan/${tutup}`, { accountability: akun(provinsi.id), body: {} });
  assert.equal(tertutup.res.statusCode, 409);
  assert.equal(kode(tertutup), "PENGAJUAN_CLOSED");

  const hilang = await call("PATCH", `/pengajuan/${uuid()}`, { accountability: akun(provinsi.id), body: {} });
  assert.equal(kode(hilang), "PENGAJUAN_NOT_FOUND");
});

test("hitung-skor: skor tersimpan di server, status dinilai, usaha menjadi scouting", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, kabkotaSubang } = await siap(t);
  await buatLegalitas(db, { usahaId: subang.id, jenis: "halal", status: "terbit" });
  const surat = await buatFile(db);
  const dibuat = await call("POST", "/pengajuan", {
    accountability: akun(kabkotaSubang.id),
    body: { usaha: subang.id, kapasitasProduksi: 10, literasiQris: true, literasiPembukuanDigital: true, suratKomitmen: surat.id },
  });
  const id = dibuat.res.body.data.id;

  const hasil = await call("POST", `/pengajuan/${id}/hitung-skor`, { accountability: akun(kabkotaSubang.id) });
  assert.equal(hasil.res.statusCode, 200, JSON.stringify(hasil.res.body));
  assert.equal(hasil.res.body.data.status, "dinilai");
  assert.equal(hasil.res.body.data.skor.rubrikVersi, "placeholder-v0");
  assert.equal(hasil.res.body.data.skor.pasar, 100);
  assert.equal((await db("usaha").where({ id: subang.id }).first()).talent_status, "scouting");
});

test("tolak: pengajuan ditolak dan usaha kembali none; menolak dua kali 409", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, kabkotaSubang } = await siap(t);
  const dibuat = await call("POST", "/pengajuan", { accountability: akun(kabkotaSubang.id), body: { usaha: subang.id } });
  const id = dibuat.res.body.data.id;

  const tolak = await call("POST", `/pengajuan/${id}/tolak`, { accountability: akun(kabkotaSubang.id), body: { catatan: "belum siap" } });
  assert.equal(tolak.res.statusCode, 200, JSON.stringify(tolak.res.body));
  assert.equal(tolak.res.body.data.status, "ditolak");
  assert.equal(tolak.res.body.data.catatan, "belum siap");
  assert.equal((await db("usaha").where({ id: subang.id }).first()).talent_status, "none");

  const lagi = await call("POST", `/pengajuan/${id}/tolak`, { accountability: akun(kabkotaSubang.id), body: {} });
  assert.equal(kode(lagi), "PENGAJUAN_CLOSED");
});

test("Berita Acara: hanya provinsi, id duplikat dilipat, satu BA memuat semua pengajuan dan memindahkan usaha ke talent_pool", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, bandung, provinsi, kabkotaSubang } = await siap(t);
  const a = await buatPengajuan(db, { usahaId: subang.id, status: "dinilai", skor: SKOR });
  const b = await buatPengajuan(db, { usahaId: bandung.id, status: "dinilai", skor: SKOR });

  const ditolak = await call("POST", "/berita-acara", { accountability: akun(kabkotaSubang.id), body: { pengajuan: [a] } });
  assert.equal(ditolak.nextError?.statusCode ?? ditolak.res.statusCode, 403);
  assert.equal((await db("talent_berita_acara")).length, 0);

  const dibuat = await call("POST", "/berita-acara", { accountability: akun(provinsi.id), body: { pengajuan: [a, b, a], catatan: "batch 1" } });
  assert.equal(dibuat.res.statusCode, 201, JSON.stringify(dibuat.res.body));
  assert.equal(dibuat.res.body.data.jumlahPengajuan, 2);
  assert.match(dibuat.res.body.data.nomor, /^BA-TS\/\d{4}\/0001$/);

  const baris = await db("talent_pengajuan").whereIn("id", [a, b]);
  assert.ok(baris.every((row) => row.status === "disetujui" && row.berita_acara === dibuat.res.body.data.id));
  const status = await db("usaha").whereIn("id", [subang.id, bandung.id]).pluck("talent_status");
  assert.deepEqual(status, ["talent_pool", "talent_pool"]);

  const daftar = await call("GET", "/berita-acara", { accountability: akun(kabkotaSubang.id) });
  assert.equal(daftar.res.body.data[0].jumlahPengajuan, 2);
});

test("Berita Acara: pengajuan belum dinilai atau sudah disetujui 409, id tak dikenal 404, tanpa BA tersisa", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, bandung, provinsi } = await siap(t);
  const draft = await buatPengajuan(db, { usahaId: subang.id });
  const disetujui = await buatPengajuan(db, { usahaId: bandung.id, status: "disetujui", skor: SKOR });

  for (const pengajuan of [[draft], [disetujui]]) {
    const hasil = await call("POST", "/berita-acara", { accountability: akun(provinsi.id), body: { pengajuan } });
    assert.equal(hasil.res.statusCode, 409);
    assert.equal(kode(hasil), "PENGAJUAN_BELUM_DINILAI");
  }
  const asing = await call("POST", "/berita-acara", { accountability: akun(provinsi.id), body: { pengajuan: [uuid()] } });
  assert.equal(asing.res.statusCode, 404);
  assert.equal(kode(asing), "PENGAJUAN_NOT_FOUND");
  assert.equal((await db("talent_berita_acara")).length, 0);
  assert.equal((await db("talent_pengajuan").where({ id: draft }).first()).status, "draft");
});

test("Berita Acara: payload harus 1-200 id valid", { skip: pgSkipReason() }, async (t) => {
  const { db, call, provinsi } = await siap(t);
  for (const pengajuan of [undefined, [], ["x"], Array.from({ length: 201 }, () => uuid())]) {
    const hasil = await call("POST", "/berita-acara", { accountability: akun(provinsi.id), body: { pengajuan } });
    assert.equal(hasil.res.statusCode, 400);
  }
  assert.equal((await db("talent_berita_acara")).length, 0);
});

test("dua klik Berita Acara paralel untuk pengajuan yang sama menghasilkan satu BA (201 + 409)", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, provinsi } = await siap(t);
  const id = await buatPengajuan(db, { usahaId: subang.id, status: "dinilai", skor: SKOR });
  const klik = () => call("POST", "/berita-acara", { accountability: akun(provinsi.id), body: { pengajuan: [id] } });

  const hasil = await Promise.all([klik(), klik(), klik()]);
  const status = hasil.map((item) => item.res.statusCode).sort();
  assert.deepEqual(status, [201, 409, 409], JSON.stringify(hasil.map((item) => item.res.body)));
  assert.equal((await db("talent_berita_acara")).length, 1);
  assert.equal((await db("talent_pengajuan").where({ berita_acara: (await db("talent_berita_acara").first()).id })).length, 1);
});

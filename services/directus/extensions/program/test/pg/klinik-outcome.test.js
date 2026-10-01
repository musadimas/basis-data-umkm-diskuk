import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import registerKlinik from "../../src/endpoints/klinik/index.js";
import { buatKota, buatTiket, buatUsaha, buatUser } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";
import { akun } from "./klinik-support.js";

const require = createRequire(import.meta.url);
const { getUsahaLapangan } = require("../../../directus-extension-operasional/src/usaha-service.js");
const { getAspekPerkembangan } = require("../../../directus-extension-operasional/src/permen-aspek.js");

const kode = (hasil) => hasil.res.body?.errors?.[0]?.extensions?.code;
const status = (hasil) => hasil.nextError?.statusCode ?? hasil.res.statusCode;
const hitung = async (db, tabel, where = {}) => Number((await db(tabel).where(where).count("* as n").first()).n);
const pasang = (db) => mountEndpoint(registerKlinik, { database: db, env: {} }).call;

const ITEMS = [
  { atribut: "npwp_usaha", jenis: "kepatuhan" },
  { atribut: "sop_tertulis", jenis: "perbaikan" },
];

async function versiTiket(db, id) {
  const result = await db.raw(
    `SELECT to_char(date_updated AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS versi FROM konsultasi_tiket WHERE id = ?`,
    [id],
  );
  return (result.rows ?? result)[0].versi;
}

/**
 * Dunia uji: dua kota, dua usaha (U1 Subang punya atribut lapangan, U2 Sumedang), petugas tiap peran, dan
 * pemilik UMKM. Setiap tiket memakai slot sendiri supaya indeks unik slot poli tidak menghalangi fixture.
 */
async function dunia(db) {
  await buatKota(db, { id: 7, nama: "KABUPATEN SUBANG" });
  await buatKota(db, { id: 8, nama: "KABUPATEN SUMEDANG" });
  const u1 = await buatUsaha(db, { nama: "Usaha Subang", kotaId: 7, kotaNama: "KABUPATEN SUBANG" });
  const u2 = await buatUsaha(db, { nama: "Usaha Sumedang", kotaId: 8, kotaNama: "KABUPATEN SUMEDANG" });
  // U1 belum patuh NPWP (false) dan belum ada data SOP (null); U2 sudah punya NPWP dari lapangan.
  await db("usaha_atribut_jabar").insert([
    { usaha: u1.id, npwp_usaha: false, sop_tertulis: null },
    { usaha: u2.id, npwp_usaha: true, sop_tertulis: null },
  ]);
  const w = {
    u1, u2,
    p1: await buatUser(db, { appRole: "provinsi" }),
    p2: await buatUser(db, { appRole: "provinsi" }),
    subang: await buatUser(db, { appRole: "kabkota", kotaScope: 7 }),
    sumedang: await buatUser(db, { appRole: "kabkota", kotaScope: 8 }),
    d1: await buatUser(db, { appRole: "pendamping" }),
    d2: await buatUser(db, { appRole: "pendamping" }),
    umkm: await buatUser(db, { appRole: "umkm", usahaId: u1.id }),
  };
  await db("directus_users").where({ id: w.p1.id }).update({ first_name: "Provinsi", last_name: "Satu" });
  await db("directus_users").where({ id: w.d1.id }).update({ first_name: "Pendamping", last_name: "Satu" });
  let slot = 0;
  const SLOTS = ["09:00", "10:30", "13:00", "14:30", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
  w.tiket = (patch = {}) =>
    buatTiket(db, { usahaId: u1.id, namaUsaha: "Usaha Subang", pendampingId: w.d1.id, status: "tindak_lanjut", jadwalSlot: SLOTS[slot++], ...patch });
  return w;
}

/** Sisi profil dan indikator dibaca lewat kode produksi extension operasional terhadap Postgres yang sama. */
const profil = async (db, usahaId) =>
  (await getUsahaLapangan(db, usahaId, { id: "x", admin: false, peran: "provinsi", kotaId: null, usahaId: null })).data;
async function indikator(db, id, operator = { role: "provinsi", kotaId: null }) {
  const { aspek } = (await getAspekPerkembangan(db, {}, operator)).data;
  const { ya, tidak, diketahui, belumAdaData } = aspek.flatMap((a) => a.indikator).find((item) => item.id === id);
  return { ya, tidak, diketahui, belumAdaData };
}

const tutupDenganOutcome = async (db, call, pengguna, tiket, items = ITEMS) =>
  call("PATCH", `/tiket/${tiket.id}`, {
    accountability: akun(pengguna.id),
    body: { status: "selesai", versi: await versiTiket(db, tiket.id), outcome: { items } },
  });

test("tutup tiket dengan outcome: atomik; profil dan indikator baru berubah setelah verifikasi, tepat sekali", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const w = await dunia(db);
  const t1 = await w.tiket();

  const npwpSebelum = await indikator(db, "npwp_usaha");
  const sopSebelum = await indikator(db, "sop_tertulis");
  assert.deepEqual([npwpSebelum.ya, npwpSebelum.tidak], [1, 1]);
  assert.deepEqual([sopSebelum.ya, sopSebelum.tidak, sopSebelum.belumAdaData], [0, 0, 2]);

  const tutup = await tutupDenganOutcome(db, call, w.d1, t1);
  assert.equal(tutup.res.statusCode, 200, JSON.stringify(tutup.res.body));
  const dto = tutup.res.body.data;
  assert.equal(dto.status, "selesai");
  assert.equal(dto.outcome.status, "diajukan");
  assert.equal(dto.outcome.statusLabel, "Menunggu verifikasi");
  assert.equal(dto.outcome.versi, 1);
  assert.deepEqual(dto.outcome.items.map((item) => [item.atribut, item.jenis, item.label]), [
    ["npwp_usaha", "kepatuhan", "NPWP Usaha"],
    ["sop_tertulis", "perbaikan", "SOP Tertulis"],
  ]);
  assert.deepEqual(dto.outcome.aksi, [], "pendamping hanya mengajukan; tombol verifikasi tidak ditawarkan");
  assert.equal(dto.outcomeBisaDicatat, false, "sudah punya outcome hidup");
  assert.equal("diajukanOleh" in dto.outcome, false, "id pengaju tidak dikirim ke klien");
  assert.equal(await hitung(db, "konsultasi_outcome", { tiket: t1.id, status: "diajukan", versi: 1 }), 1);
  assert.equal(await hitung(db, "konsultasi_outcome_item"), 2);
  assert.deepEqual((await db("konsultasi_outcome_audit").orderBy("id")).map((baris) => [baris.aksi, baris.status_ke]), [["ajukan", "diajukan"]]);

  // Belum diverifikasi: profil dan indikator tidak berubah.
  assert.deepEqual((await profil(db, w.u1.id)).hasilKonsultasi, []);
  assert.deepEqual(await indikator(db, "npwp_usaha"), npwpSebelum);
  assert.deepEqual(await indikator(db, "sop_tertulis"), sopSebelum);

  // Provinsi lain memverifikasi: efek muncul tepat sekali.
  const outcomeId = dto.outcome.id;
  const verifikasi = await call("POST", `/outcome/${outcomeId}/verifikasi`, { accountability: akun(w.p1.id) });
  assert.equal(verifikasi.res.statusCode, 200, JSON.stringify(verifikasi.res.body));
  assert.deepEqual(verifikasi.res.body.data, { id: outcomeId, versi: 1, status: "terverifikasi", duplikat: false });

  const hasil = (await profil(db, w.u1.id)).hasilKonsultasi;
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].nomorTiket, t1.nomor);
  assert.equal(hasil[0].diverifikasiOleh, "Provinsi Satu");
  assert.deepEqual(hasil[0].items, [
    { atribut: "npwpUsaha", jenis: "kepatuhan" },
    { atribut: "sopTertulis", jenis: "perbaikan" },
  ]);
  const npwp = await indikator(db, "npwp_usaha");
  assert.deepEqual([npwp.ya, npwp.tidak], [2, 0], "false dari lapangan menjadi ya karena outcome terverifikasi; U2 tetap ya dari lapangan");
  const sop = await indikator(db, "sop_tertulis");
  assert.deepEqual([sop.ya, sop.tidak, sop.belumAdaData], [1, 0, 1], "null menjadi ya");
  // Kab/kota lain tidak melihat perubahan usaha di luar wilayahnya.
  assert.deepEqual(await indikator(db, "sop_tertulis", { role: "kabkota", kotaId: 8 }), { ya: 0, tidak: 0, diketahui: 0, belumAdaData: 1 });

  // Retry dan verifikator lain yang terlambat: tanpa perubahan, tanpa audit baru.
  for (const pengguna of [w.p1, w.p2, w.subang]) {
    const ulang = await call("POST", `/outcome/${outcomeId}/verifikasi`, { accountability: akun(pengguna.id) });
    assert.equal(ulang.res.statusCode, 200, JSON.stringify(ulang.res.body));
    assert.equal(ulang.res.body.data.duplikat, true);
  }
  assert.equal(await hitung(db, "konsultasi_outcome_audit", { aksi: "verifikasi" }), 1);
  assert.deepEqual(await indikator(db, "npwp_usaha"), { ...npwp });

  // Tiket kedua dari usaha yang sama dengan atribut yang sama: indikator dihitung per usaha, bukan per outcome.
  const t2 = await w.tiket();
  const kedua = await tutupDenganOutcome(db, call, w.d1, t2, [{ atribut: "npwp_usaha", jenis: "perbaikan" }]);
  assert.equal(kedua.res.statusCode, 200, JSON.stringify(kedua.res.body));
  await call("POST", `/outcome/${kedua.res.body.data.outcome.id}/verifikasi`, { accountability: akun(w.p2.id) });
  assert.equal((await profil(db, w.u1.id)).hasilKonsultasi.length, 2);
  assert.deepEqual(await indikator(db, "npwp_usaha"), npwp, "usaha yang sama tidak dihitung dua kali");
});

test("verifikasi: pengaju tidak boleh, peran/wilayah lain ditolak, outcome dicabut tidak bisa diverifikasi", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const w = await dunia(db);
  const t1 = await w.tiket();
  const dto = (await tutupDenganOutcome(db, call, w.p1, t1)).res.body.data; // provinsi menutup dan mengajukan sendiri
  assert.deepEqual(dto.outcome.aksi, ["koreksi", "cabut"], "pengaju provinsi tidak ditawari verifikasi atas pengajuannya sendiri");
  const id = dto.outcome.id;

  const sama = await call("POST", `/outcome/${id}/verifikasi`, { accountability: akun(w.p1.id) });
  assert.equal(sama.res.statusCode, 409);
  assert.equal(kode(sama), "VERIFIKATOR_SAMA");
  assert.equal((await db("konsultasi_outcome").where({ id }).first()).status, "diajukan");

  // Pendamping dan umkm: peran tidak boleh (403); anonim 401; kab/kota wilayah lain 404 (bukan 403: tidak menjadi oracle).
  assert.equal(status(await call("POST", `/outcome/${id}/verifikasi`, { accountability: akun(w.d1.id) })), 403);
  assert.equal(status(await call("POST", `/outcome/${id}/verifikasi`, { accountability: akun(w.umkm.id) })), 403);
  assert.equal(status(await call("POST", `/outcome/${id}/verifikasi`, { accountability: null })), 401);
  const kotaLain = await call("POST", `/outcome/${id}/verifikasi`, { accountability: akun(w.sumedang.id) });
  assert.equal(kotaLain.res.statusCode, 404);
  assert.equal(kode(kotaLain), "OUTCOME_TIDAK_DITEMUKAN");
  const idAcak = await call("POST", `/outcome/${w.p1.id}/verifikasi`, { accountability: akun(w.p2.id) });
  assert.equal(idAcak.res.statusCode, 404);
  assert.equal(kode(await call("POST", `/outcome/bukan-uuid/verifikasi`, { accountability: akun(w.p2.id) })), "OUTCOME_TIDAK_DITEMUKAN");
  assert.equal(await hitung(db, "konsultasi_outcome_audit"), 1, "semua penolakan tidak meninggalkan jejak tulis");

  // Kab/kota pemilik wilayah boleh memverifikasi pengajuan provinsi.
  const oleh = await call("POST", `/outcome/${id}/verifikasi`, { accountability: akun(w.subang.id) });
  assert.equal(oleh.res.statusCode, 200, JSON.stringify(oleh.res.body));

  // Outcome yang dicabut tidak dapat diverifikasi.
  const t2 = await w.tiket();
  const dicabut = (await tutupDenganOutcome(db, call, w.d1, t2)).res.body.data.outcome.id;
  assert.equal((await call("POST", `/outcome/${dicabut}/cabut`, { accountability: akun(w.p1.id), body: { alasan: "Salah usaha" } })).res.statusCode, 200);
  assert.equal(kode(await call("POST", `/outcome/${dicabut}/verifikasi`, { accountability: akun(w.p2.id) })), "OUTCOME_DICABUT");
});

test("koreksi membuat versi baru dan mencabut yang lama; retry idempoten; efek berganti dalam satu langkah", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const w = await dunia(db);
  const t1 = await w.tiket();
  const awal = (await tutupDenganOutcome(db, call, w.d1, t1)).res.body.data.outcome.id;
  await call("POST", `/outcome/${awal}/verifikasi`, { accountability: akun(w.p1.id) });
  const koreksiItems = [{ atribut: "ecommerce", jenis: "perbaikan" }];

  // Alasan wajib; item tetap divalidasi; identik = tidak ada yang dikoreksi.
  assert.equal(kode(await call("POST", `/outcome/${awal}/koreksi`, { accountability: akun(w.p1.id), body: { items: koreksiItems } })), "OUTCOME_TIDAK_VALID");
  assert.equal(kode(await call("POST", `/outcome/${awal}/koreksi`, { accountability: akun(w.p1.id), body: { items: koreksiItems, alasan: "x" } })), "OUTCOME_TIDAK_VALID");
  assert.equal(kode(await call("POST", `/outcome/${awal}/koreksi`, { accountability: akun(w.p1.id), body: { items: ITEMS, alasan: "Tidak ada yang berubah" } })), "OUTCOME_TIDAK_BERUBAH");
  assert.equal(await hitung(db, "konsultasi_outcome"), 1);

  // Kab/kota wilayah lain dan pendamping tidak boleh mengoreksi.
  assert.equal((await call("POST", `/outcome/${awal}/koreksi`, { accountability: akun(w.sumedang.id), body: { items: koreksiItems, alasan: "Coba koreksi" } })).res.statusCode, 404);
  assert.equal(status(await call("POST", `/outcome/${awal}/koreksi`, { accountability: akun(w.d1.id), body: { items: koreksiItems, alasan: "Coba koreksi" } })), 403);

  const koreksi = await call("POST", `/outcome/${awal}/koreksi`, {
    accountability: akun(w.subang.id),
    body: { items: koreksiItems, alasan: "Bukti NPWP ternyata belum ada" },
  });
  assert.equal(koreksi.res.statusCode, 200, JSON.stringify(koreksi.res.body));
  const { id: baru, versi, status: statusBaru, duplikat } = koreksi.res.body.data;
  assert.deepEqual([versi, statusBaru, duplikat], [2, "terverifikasi", false]);

  const lama = await db("konsultasi_outcome").where({ id: awal }).first();
  assert.equal(lama.status, "dicabut");
  assert.equal(lama.alasan_cabut, "Dikoreksi ke versi 2: Bukti NPWP ternyata belum ada");
  assert.equal(lama.dicabut_oleh, w.subang.id);
  const versiBaru = await db("konsultasi_outcome").where({ id: baru }).first();
  assert.equal(versiBaru.menggantikan, awal);
  assert.equal(versiBaru.diverifikasi_oleh, w.subang.id, "pengoreksi adalah verifikator versi baru");
  assert.equal(await hitung(db, "konsultasi_outcome", { tiket: t1.id }), 2);
  const hidup = await db("konsultasi_outcome").where({ tiket: t1.id }).whereIn("status", ["diajukan", "terverifikasi"]);
  assert.deepEqual(hidup.map((baris) => baris.id), [baru], "tepat satu outcome hidup per tiket");

  // Efek pada profil/indikator berganti: NPWP/SOP hilang, e-commerce masuk.
  const hasil = (await profil(db, w.u1.id)).hasilKonsultasi;
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].versi, 2);
  assert.deepEqual(hasil[0].items, [{ atribut: "ecommerce", jenis: "perbaikan" }]);
  assert.deepEqual([(await indikator(db, "npwp_usaha")).ya, (await indikator(db, "npwp_usaha")).tidak], [1, 1], "kembali ke nilai lapangan");
  assert.equal((await indikator(db, "sop_tertulis")).ya, 0);
  assert.equal((await indikator(db, "ecommerce")).ya, 1);

  // Retry koreksi yang sama (id lama): mengembalikan versi baru, tanpa versi ketiga dan tanpa audit ganda.
  const ulang = await call("POST", `/outcome/${awal}/koreksi`, {
    accountability: akun(w.subang.id),
    body: { items: koreksiItems, alasan: "Bukti NPWP ternyata belum ada" },
  });
  assert.equal(ulang.res.statusCode, 200);
  assert.deepEqual(ulang.res.body.data, { id: baru, versi: 2, status: "terverifikasi", duplikat: true });
  assert.equal(await hitung(db, "konsultasi_outcome", { tiket: t1.id }), 2);
  // Koreksi lain atas versi yang sudah dicabut ditolak.
  assert.equal(
    kode(await call("POST", `/outcome/${awal}/koreksi`, { accountability: akun(w.p1.id), body: { items: [{ atribut: "qris", jenis: "kepatuhan" }], alasan: "Koreksi lain" } })),
    "OUTCOME_DICABUT",
  );
  const audit = await db("konsultasi_outcome_audit").where({ aksi: "koreksi" }).orderBy("id");
  assert.deepEqual(audit.map((baris) => [baris.versi, baris.status_ke, baris.alasan]), [
    [1, "dicabut", "Bukti NPWP ternyata belum ada"],
    [2, "terverifikasi", "Bukti NPWP ternyata belum ada"],
  ]);
});

test("cabut: alasan wajib, efek hilang dari profil, idempoten, lalu tiket dapat diajukan ulang sebagai versi baru", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const w = await dunia(db);
  const t1 = await w.tiket();
  const dto = (await tutupDenganOutcome(db, call, w.d1, t1)).res.body.data;
  const id = dto.outcome.id;
  await call("POST", `/outcome/${id}/verifikasi`, { accountability: akun(w.p1.id) });
  assert.equal((await profil(db, w.u1.id)).hasilKonsultasi.length, 1);

  assert.equal(kode(await call("POST", `/outcome/${id}/cabut`, { accountability: akun(w.p1.id), body: {} })), "OUTCOME_TIDAK_VALID");
  assert.equal(status(await call("POST", `/outcome/${id}/cabut`, { accountability: akun(w.d1.id), body: { alasan: "Coba cabut" } })), 403);
  assert.equal((await call("POST", `/outcome/${id}/cabut`, { accountability: akun(w.sumedang.id), body: { alasan: "Coba cabut" } })).res.statusCode, 404);
  assert.equal((await db("konsultasi_outcome").where({ id }).first()).status, "terverifikasi");

  const cabut = await call("POST", `/outcome/${id}/cabut`, { accountability: akun(w.subang.id), body: { alasan: "Bukti tidak valid" } });
  assert.equal(cabut.res.statusCode, 200, JSON.stringify(cabut.res.body));
  assert.deepEqual(cabut.res.body.data, { id, versi: 1, status: "dicabut", duplikat: false });
  const baris = await db("konsultasi_outcome").where({ id }).first();
  assert.deepEqual([baris.status, baris.alasan_cabut, baris.dicabut_oleh], ["dicabut", "Bukti tidak valid", w.subang.id]);
  assert.deepEqual((await profil(db, w.u1.id)).hasilKonsultasi, []);
  assert.deepEqual([(await indikator(db, "npwp_usaha")).ya, (await indikator(db, "npwp_usaha")).tidak], [1, 1]);
  assert.equal((await indikator(db, "sop_tertulis")).ya, 0);

  // Retry: idempoten, tanpa audit ganda.
  const ulang = await call("POST", `/outcome/${id}/cabut`, { accountability: akun(w.subang.id), body: { alasan: "Bukti tidak valid" } });
  assert.equal(ulang.res.body.data.duplikat, true);
  assert.equal(await hitung(db, "konsultasi_outcome_audit", { aksi: "cabut" }), 1);

  // Panel: tiket menawarkan "Catat outcome" lagi; pengajuan baru = versi 2, versi 1 tetap tercatat sebagai dicabut.
  const daftar = await call("GET", "/tiket", { accountability: akun(w.p1.id), query: {} });
  const tiketDto = daftar.res.body.data.find((item) => item.id === t1.id);
  assert.equal(tiketDto.outcomeBisaDicatat, true);
  assert.equal(tiketDto.outcome.status, "dicabut");
  assert.equal(tiketDto.outcome.alasanCabut, "Bukti tidak valid");
  assert.deepEqual(tiketDto.outcome.aksi, []);
  const ajukan = await call("POST", `/tiket/${t1.id}/outcome`, { accountability: akun(w.d1.id), body: { items: [{ atribut: "qris", jenis: "kepatuhan" }] } });
  assert.equal(ajukan.res.statusCode, 201, JSON.stringify(ajukan.res.body));
  assert.equal((await db("konsultasi_outcome").where({ id: ajukan.res.body.data.id }).first()).versi, 2);
  assert.equal(await hitung(db, "konsultasi_outcome", { tiket: t1.id }), 2);
});

test("dua permintaan serentak: satu outcome, satu penutupan, satu verifikasi", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const w = await dunia(db);

  // Dua penutupan serentak dengan versi yang sama: satu menang, satu 409; hanya satu outcome.
  const t1 = await w.tiket();
  const versi = await versiTiket(db, t1.id);
  const tutup = () => call("PATCH", `/tiket/${t1.id}`, { accountability: akun(w.d1.id), body: { status: "selesai", versi, outcome: { items: ITEMS } } });
  const dua = await Promise.all([tutup(), tutup()]);
  assert.deepEqual(dua.map((h) => h.res.statusCode).sort(), [200, 409]);
  assert.equal(kode(dua.find((h) => h.res.statusCode === 409)), "TIKET_BERUBAH");
  assert.equal(await hitung(db, "konsultasi_outcome", { tiket: t1.id }), 1);
  assert.equal(await hitung(db, "konsultasi_outcome_audit", { aksi: "ajukan" }), 1);
  assert.equal(await hitung(db, "konsultasi_tiket_audit", { tiket: t1.id, aksi: "transisi" }), 1);

  // Tiga POST outcome identik pada tiket selesai tanpa outcome: satu 201, sisanya 200 duplikat.
  const t2 = await w.tiket({ status: "selesai" });
  const kirim = (items) => call("POST", `/tiket/${t2.id}/outcome`, { accountability: akun(w.d1.id), body: { items } });
  const tiga = await Promise.all([kirim(ITEMS), kirim([...ITEMS].reverse()), kirim(ITEMS)]);
  assert.deepEqual(tiga.map((h) => h.res.statusCode).sort(), [200, 200, 201], "urutan item tidak membedakan isi");
  assert.equal(await hitung(db, "konsultasi_outcome", { tiket: t2.id }), 1);

  // Isi berbeda pada tiket yang sama: 409 OUTCOME_SUDAH_ADA (gunakan koreksi), bukan dua outcome hidup.
  const beda = await kirim([{ atribut: "qris", jenis: "kepatuhan" }]);
  assert.equal(beda.res.statusCode, 409);
  assert.equal(kode(beda), "OUTCOME_SUDAH_ADA");

  // Dua verifikator serentak: satu benar-benar memverifikasi, satu melihat duplikat; audit tunggal.
  const id = tiga.find((h) => h.res.statusCode === 201).res.body.data.id;
  const verif = await Promise.all([
    call("POST", `/outcome/${id}/verifikasi`, { accountability: akun(w.p1.id) }),
    call("POST", `/outcome/${id}/verifikasi`, { accountability: akun(w.p2.id) }),
  ]);
  assert.deepEqual(verif.map((h) => h.res.body.data.duplikat).sort(), [false, true]);
  assert.equal(await hitung(db, "konsultasi_outcome_audit", { aksi: "verifikasi" }), 1);
});

test("penjaga keadaan: tiket tanpa outcome, tiket manual, belum selesai, item tidak valid, dan status bukan selesai", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const w = await dunia(db);

  // Menutup tanpa outcome sah: tidak ada baris outcome, profil dan indikator tidak berubah.
  const polos = await w.tiket();
  const tanpa = await call("PATCH", `/tiket/${polos.id}`, { accountability: akun(w.d1.id), body: { status: "selesai", versi: await versiTiket(db, polos.id) } });
  assert.equal(tanpa.res.statusCode, 200, JSON.stringify(tanpa.res.body));
  assert.equal(tanpa.res.body.data.outcome, null);
  assert.equal(tanpa.res.body.data.outcomeBisaDicatat, true, "panel menawarkan Catat outcome untuk tiket selesai tanpa outcome");
  assert.equal(await hitung(db, "konsultasi_outcome"), 0);
  assert.deepEqual((await profil(db, w.u1.id)).hasilKonsultasi, []);

  // Tiket manual (tanpa usaha): outcome ditolak, dan penutupan ikut batal (transaksi).
  const manual = await buatTiket(db, { usahaId: null, pendampingId: w.d1.id, status: "tindak_lanjut", jadwalSlot: "20:00" });
  const tolakManual = await tutupDenganOutcome(db, call, w.d1, manual);
  assert.equal(tolakManual.res.statusCode, 409);
  assert.equal(kode(tolakManual), "USAHA_TIDAK_TERTAUT");
  assert.equal((await db("konsultasi_tiket").where({ id: manual.id }).first()).status, "tindak_lanjut", "penutupan dibatalkan bersama outcome");
  assert.equal(await hitung(db, "konsultasi_tiket_audit", { tiket: manual.id }), 0);
  const manualSelesai = await buatTiket(db, { usahaId: null, pendampingId: w.d1.id, status: "selesai", jadwalSlot: "19:00" });
  assert.equal(kode(await call("POST", `/tiket/${manualSelesai.id}/outcome`, { accountability: akun(w.p1.id), body: { items: ITEMS } })), "USAHA_TIDAK_TERTAUT");

  // Belum selesai: POST outcome ditolak; PATCH dengan outcome tetapi status lain ditolak.
  const berjalan = await w.tiket();
  assert.equal(kode(await call("POST", `/tiket/${berjalan.id}/outcome`, { accountability: akun(w.d1.id), body: { items: ITEMS } })), "TIKET_BELUM_SELESAI");
  const salahStatus = await call("PATCH", `/tiket/${berjalan.id}`, {
    accountability: akun(w.d1.id),
    body: { catatan: "lain", versi: await versiTiket(db, berjalan.id), outcome: { items: ITEMS } },
  });
  assert.equal(kode(salahStatus), "OUTCOME_TIDAK_VALID");
  assert.equal(await hitung(db, "konsultasi_outcome"), 0);

  // Item tidak valid: atribut asing, jenis asing, duplikat, kosong, bukan array; tidak ada penulisan.
  const selesai = await w.tiket({ status: "selesai" });
  for (const items of [[], null, "npwp_usaha", [{ atribut: "nib", jenis: "kepatuhan" }], [{ atribut: "qris", jenis: "bebas" }],
    [{ atribut: "qris", jenis: "kepatuhan" }, { atribut: "qris", jenis: "perbaikan" }], [{ atribut: "'; DROP TABLE usaha;--", jenis: "kepatuhan" }]]) {
    const tolak = await call("POST", `/tiket/${selesai.id}/outcome`, { accountability: akun(w.d1.id), body: { items } });
    assert.equal(kode(tolak), "OUTCOME_TIDAK_VALID", JSON.stringify(items));
  }
  assert.equal(await hitung(db, "konsultasi_outcome"), 0);
});

test("integrasi gagal di tengah penutupan: tiket, outcome, dan audit ikut dibatalkan; retry sesudahnya berhasil sekali", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const w = await dunia(db);
  const t1 = await w.tiket();
  // Kegagalan simulasi saat menulis item outcome, setelah status tiket dan audit ditulis di transaksi yang sama.
  const gagal = {
    raw: (sql, bindings) => db.raw(sql, bindings),
    transaction: (fn) =>
      db.transaction((trx) =>
        fn({ raw: (sql, bindings) => (/INSERT INTO konsultasi_outcome_item/.test(sql) ? Promise.reject(new Error("boom")) : trx.raw(sql, bindings)) }),
      ),
  };
  const versi = await versiTiket(db, t1.id);
  const kena = await mountEndpoint(registerKlinik, { database: gagal, env: {} }).call("PATCH", `/tiket/${t1.id}`, {
    accountability: akun(w.d1.id),
    body: { status: "selesai", versi, outcome: { items: ITEMS } },
  });
  assert.equal(kena.res.statusCode, 500);
  assert.equal((await db("konsultasi_tiket").where({ id: t1.id }).first()).status, "tindak_lanjut");
  assert.equal(await hitung(db, "konsultasi_outcome"), 0);
  assert.equal(await hitung(db, "konsultasi_tiket_audit", { tiket: t1.id }), 0);
  assert.equal(await hitung(db, "konsultasi_outcome_audit"), 0);

  // Klien mencoba lagi dengan versi yang sama (tiket tidak berubah): berhasil, satu outcome.
  const retry = await pasang(db)("PATCH", `/tiket/${t1.id}`, { accountability: akun(w.d1.id), body: { status: "selesai", versi, outcome: { items: ITEMS } } });
  assert.equal(retry.res.statusCode, 200, JSON.stringify(retry.res.body));
  assert.equal(await hitung(db, "konsultasi_outcome"), 1);
});

test("tiket dibuka ulang: selesai tetap final (outcome tak tersentuh); tiket batal yang dibuka ulang tidak menghasilkan outcome", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const w = await dunia(db);
  const t1 = await w.tiket();
  const dto = (await tutupDenganOutcome(db, call, w.d1, t1)).res.body.data;
  await call("POST", `/outcome/${dto.outcome.id}/verifikasi`, { accountability: akun(w.p1.id) });

  for (const ke of ["dijadwalkan", "berjalan", "tindak_lanjut", "batal"]) {
    const buka = await call("PATCH", `/tiket/${t1.id}`, { accountability: akun(w.p1.id), body: { status: ke, versi: await versiTiket(db, t1.id) } });
    assert.equal(buka.res.statusCode, 409, ke);
    assert.equal(kode(buka), "TRANSISI_TIDAK_VALID");
  }
  assert.equal((await db("konsultasi_tiket").where({ id: t1.id }).first()).status, "selesai");
  assert.equal((await db("konsultasi_outcome").where({ id: dto.outcome.id }).first()).status, "terverifikasi");

  // Tiket batal → dijadwalkan (satu-satunya buka ulang yang sah): berjalan normal, tanpa outcome.
  const batal = await w.tiket({ status: "batal" });
  const buka = await call("PATCH", `/tiket/${batal.id}`, { accountability: akun(w.p1.id), body: { status: "dijadwalkan", versi: await versiTiket(db, batal.id) } });
  assert.equal(buka.res.statusCode, 200, JSON.stringify(buka.res.body));
  assert.equal(buka.res.body.data.outcome, null);
  assert.equal(buka.res.body.data.outcomeBisaDicatat, false);
  assert.equal(await hitung(db, "konsultasi_outcome", { tiket: batal.id }), 0);
});

test("IDOR dan peran: outcome hanya untuk petugas yang menangani tiketnya; antrean ter-scope wilayah", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const w = await dunia(db);
  const tiketSubang = await w.tiket({ status: "selesai" });
  const tiketSumedang = await buatTiket(db, { usahaId: w.u2.id, namaUsaha: "Usaha Sumedang", pendampingId: w.d2.id, status: "selesai", jadwalSlot: "20:00" });
  const kirim = (pengguna, tiket, items = ITEMS) =>
    call("POST", `/tiket/${tiket.id}/outcome`, { accountability: pengguna ? akun(pengguna.id) : null, body: { items } });

  // Tiket di luar cakupan sama dengan tiket yang tidak ada (404); umkm 403; anonim 401.
  for (const [pengguna, tiket, ekspektasi] of [
    [w.subang, tiketSumedang, 404],
    [w.sumedang, tiketSubang, 404],
    [w.d2, tiketSubang, 404], // pendamping lain
    [w.d1, tiketSumedang, 404],
    [w.umkm, tiketSubang, 403],
    [null, tiketSubang, 401],
  ]) {
    assert.equal(status(await kirim(pengguna, tiket)), ekspektasi);
  }
  assert.equal(await hitung(db, "konsultasi_outcome"), 0, "penolakan tidak menulis apa pun");
  // Tiket kolam (tanpa pendamping) tidak bisa dicatat pendamping mana pun: harus ditugaskan dulu.
  const kolam = await buatTiket(db, { usahaId: w.u1.id, pendampingId: null, status: "selesai", jadwalSlot: "19:00" });
  assert.equal((await kirim(w.d2, kolam)).res.statusCode, 404);
  assert.equal((await kirim(w.d1, kolam)).res.statusCode, 404);

  // Yang berhak: pendamping tiketnya, kab/kota wilayahnya, provinsi.
  assert.equal((await kirim(w.d1, tiketSubang)).res.statusCode, 201);
  assert.equal((await kirim(w.sumedang, tiketSumedang)).res.statusCode, 201);

  // Antrean verifikasi: provinsi melihat semua, kab/kota hanya wilayahnya, peran lain 403/401.
  const antrean = async (pengguna) => call("GET", "/outcome", { accountability: pengguna ? akun(pengguna.id) : null, query: {} });
  assert.equal((await antrean(w.p1)).res.body.data.length, 2);
  const punyaSubang = (await antrean(w.subang)).res.body.data;
  assert.deepEqual(punyaSubang.map((item) => item.namaUsaha), ["Usaha Subang"]);
  assert.deepEqual(punyaSubang[0].aksi, ["verifikasi", "koreksi", "cabut"]);
  assert.deepEqual((await antrean(w.sumedang)).res.body.data.map((item) => item.namaUsaha), ["Usaha Sumedang"]);
  assert.equal(status(await antrean(w.d1)), 403);
  assert.equal(status(await antrean(w.umkm)), 403);
  assert.equal(status(await antrean(null)), 401);
  assert.equal(kode(await call("GET", "/outcome", { accountability: akun(w.p1.id), query: { status: "bebas" } })), "INVALID_PAYLOAD");
});

test("privasi: catatan sesi (diagnosis, rencana aksi, catatan, kontak, tautan rapat) tidak pernah masuk outcome, antrean, atau profil", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const w = await dunia(db);
  const t1 = await w.tiket();
  const RAHASIA = ["RAHASIA-CATATAN", "RAHASIA-DIAGNOSIS", "RAHASIA-RENCANA", "https://meet.example/RAHASIA-LINK", "rahasia@kontak.test", "6289876543210", "RAHASIA-NAMA-KONTAK"];
  await db("konsultasi_tiket").where({ id: t1.id }).update({
    catatan: RAHASIA[0],
    diagnosis: JSON.stringify({ legalitas: RAHASIA[1] }),
    action_plan: RAHASIA[2],
    link_meet: RAHASIA[3],
    email: RAHASIA[4],
    whatsapp: RAHASIA[5],
    nama_kontak: RAHASIA[6],
  });
  const dto = (await tutupDenganOutcome(db, call, w.d1, t1)).res.body.data;
  const id = dto.outcome.id;
  await call("POST", `/outcome/${id}/verifikasi`, { accountability: akun(w.p1.id) });

  const bagian = {
    outcomeTiket: JSON.stringify(dto.outcome),
    antrean: JSON.stringify((await call("GET", "/outcome", { accountability: akun(w.p1.id), query: { status: "terverifikasi" } })).res.body.data),
    profil: JSON.stringify((await profil(db, w.u1.id)).hasilKonsultasi),
    kolomOutcome: JSON.stringify(await db("konsultasi_outcome")),
    kolomItem: JSON.stringify(await db("konsultasi_outcome_item")),
    audit: JSON.stringify(await db("konsultasi_outcome_audit")),
  };
  for (const [nama, isi] of Object.entries(bagian)) {
    for (const rahasia of RAHASIA) assert.equal(isi.includes(rahasia), false, `${nama} membocorkan ${rahasia}`);
  }
  // Bentuk DTO profil: hanya atribut + jenis + asal tiket/verifikator/tanggal.
  assert.deepEqual(Object.keys((await profil(db, w.u1.id)).hasilKonsultasi[0]).sort(), ["diverifikasiOleh", "diverifikasiPada", "id", "items", "nomorTiket", "poli", "versi"]);
  // Skema outcome tidak punya kolom teks bebas dari sesi (hanya alasan koreksi/cabut yang ditulis verifikator).
  const kolom = (await db.raw(`SELECT column_name FROM information_schema.columns WHERE table_name = 'konsultasi_outcome' ORDER BY 1`)).rows.map((row) => row.column_name);
  for (const dilarang of ["catatan", "diagnosis", "action_plan", "link_meet", "whatsapp", "email", "nama_kontak", "deskripsi"]) {
    assert.equal(kolom.includes(dilarang), false, `kolom ${dilarang}`);
  }
});

test("indikator memakai versi definisi baru dan tidak menimpa data lapangan 'ya' dengan 'tidak'", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const w = await dunia(db);
  const data = (await getAspekPerkembangan(db, {}, { role: "provinsi", kotaId: null })).data;
  assert.equal(data.definisiVersi, "indikator-operasional-v3");
  assert.match(data.sumber, /konsultasi_outcome/);
  // U2 sudah ya dari lapangan; outcome yang dicabut/koreksi tidak boleh membuatnya "tidak".
  const t2 = await buatTiket(db, { usahaId: w.u2.id, pendampingId: w.d2.id, status: "tindak_lanjut", jadwalSlot: "09:00" });
  const dto = (await tutupDenganOutcome(db, call, w.d2, t2, [{ atribut: "npwp_usaha", jenis: "kepatuhan" }])).res.body.data;
  await call("POST", `/outcome/${dto.outcome.id}/verifikasi`, { accountability: akun(w.p1.id) });
  assert.deepEqual([(await indikator(db, "npwp_usaha")).ya, (await indikator(db, "npwp_usaha")).tidak], [1, 1], "U2 sudah ya: tetap satu");
  await call("POST", `/outcome/${dto.outcome.id}/cabut`, { accountability: akun(w.p1.id), body: { alasan: "Salah catat usaha" } });
  assert.deepEqual([(await indikator(db, "npwp_usaha")).ya, (await indikator(db, "npwp_usaha")).tidak], [1, 1], "nilai lapangan U2 tetap ya setelah dicabut");
});

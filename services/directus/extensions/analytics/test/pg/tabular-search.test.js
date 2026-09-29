import assert from "node:assert/strict";
import test from "node:test";
import { buildTabularFilter } from "../../src/lib/utils/tabular-filter.js";
import { buatKota, buatPelaku, buatUsaha } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";

const TEKS_PLAN = (result) => (result.rows ?? result).map((row) => Object.values(row)[0]).join("\n");

const jumlah = async (db, q) => {
  const { where, params } = buildTabularFilter({ q });
  const result = await db.raw(`SELECT count(*)::integer AS total FROM usaha_tabular t ${where}`, params);
  return (result.rows ?? result)[0].total;
};

test("pencarian Tabular dieksekusi Postgres: nama usaha, produk, kegiatan, dan pemilik", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7 });
  const pelaku = await buatPelaku(db, { nama: "Siti Aminah" });
  await buatUsaha(db, {
    nama: "Keripik Sunda",
    kotaId: 7,
    kotaNama: "KABUPATEN SUBANG",
    pelakuId: pelaku.id,
    produkUtama: "Keripik Singkong",
    kegiatanUtama: "Industri Makanan",
  });

  // Sebelum B13 klausa `ESCAPE '\'` (dua karakter) membuat Postgres menolak query ini.
  assert.equal(await jumlah(db, "keripik"), 1, "nama usaha");
  assert.equal(await jumlah(db, "singkong"), 1, "produk utama");
  assert.equal(await jumlah(db, "makanan"), 1, "kegiatan utama");
  assert.equal(await jumlah(db, "Siti Aminah"), 1, "nama pemilik lewat pelaku_usaha");
  assert.equal(await jumlah(db, "tidak ada"), 0);
});

test("pencarian Tabular memperlakukan % _ dan backslash sebagai literal", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7 });
  await buatUsaha(db, { nama: "Diskon 50% Spesial", kotaId: 7 });
  await buatUsaha(db, { nama: "Diskon 5000 Spesial", kotaId: 7 });
  await buatUsaha(db, { nama: "Toko a_b Jaya", kotaId: 7 });
  await buatUsaha(db, { nama: "Toko aXb Jaya", kotaId: 7 });
  await buatUsaha(db, { nama: "Jalan c\\d Raya", kotaId: 7 });
  await buatUsaha(db, { nama: "Jalan cd Raya", kotaId: 7 });

  assert.equal(await jumlah(db, "50%"), 1);
  assert.equal(await jumlah(db, "Disk_n"), 0);
  assert.equal(await jumlah(db, "a_b J"), 1);
  assert.equal(await jumlah(db, "c\\d"), 1);
});

test("pencarian 5 digit dianggap KBLI: kode_kbli persis atau nama memuat angka itu", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7 });
  const kbli = await buatUsaha(db, { nama: "Konveksi Maju", kotaId: 7 });
  await db("usaha_tabular").where({ id: kbli.id }).update({ kode_kbli: "15121" });
  const lain = await buatUsaha(db, { nama: "Toko Lain", kotaId: 7 });
  await db("usaha_tabular").where({ id: lain.id }).update({ kode_kbli: "47111" });
  await buatUsaha(db, { nama: "Warung 15121 Mandiri", kotaId: 7 });

  const { where, params } = buildTabularFilter({ q: "15121" });
  const rows = await db.raw(`SELECT t.nama FROM usaha_tabular t ${where} ORDER BY t.nama`, params);
  assert.deepEqual(
    (rows.rows ?? rows).map((row) => row.nama),
    ["Konveksi Maju", "Warung 15121 Mandiri"],
  );
  assert.equal(await jumlah(db, "47111"), 1);
  assert.equal(await jumlah(db, "99999"), 0);
});

test("pencarian 16 digit memakai NIK persis dan 13 digit memakai NIB persis", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7 });
  const nik = "3273010101011234";
  const nib = "9900000000001";
  const pelaku = await buatPelaku(db, { nik, nama: "Budi" });
  const punyaNik = await buatUsaha(db, { nama: "Usaha Budi", kotaId: 7, pelakuId: pelaku.id });
  await buatUsaha(db, { nama: "Usaha Lain", kotaId: 7 });
  await buatUsaha(db, { nama: "Usaha ber-NIB", kotaId: 7, nib });
  await buatUsaha(db, { nama: `Nama memuat ${nik}`, kotaId: 7 });

  const { where, params } = buildTabularFilter({ q: nik });
  const rows = await db.raw(`SELECT t.id FROM usaha_tabular t ${where}`, params);
  assert.deepEqual((rows.rows ?? rows).map((row) => row.id), [punyaNik.id], "NIK persis, bukan ILIKE nama");

  assert.equal(await jumlah(db, nib), 1, "NIB persis");
  assert.equal(await jumlah(db, "3273010101019999"), 0, "NIK tak dikenal");
  assert.equal(await jumlah(db, "9900000000002"), 0, "NIB tak dikenal");
});

test("pencarian umum memakai Bitmap Index Scan pada index trigram (seqscan dimatikan)", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7 });
  await buatUsaha(db, { nama: "Keripik Sunda", kotaId: 7, produkUtama: "Keripik", kegiatanUtama: "Makanan" });
  await db.raw("ANALYZE usaha_tabular");

  // Koneksi tunggal lewat transaksi: `SET LOCAL enable_seqscan = off` hanya berlaku di sini.
  await db.transaction(async (trx) => {
    await trx.raw("SET LOCAL enable_seqscan = off");
    const { where, params } = buildTabularFilter({ q: "keripik" });
    const plan = TEKS_PLAN(await trx.raw(`EXPLAIN (COSTS OFF) SELECT t.id FROM usaha_tabular t ${where}`, params));
    assert.match(plan, /Bitmap Index Scan/, plan);
    for (const index of [
      "idx_usaha_tabular_nama_trgm",
      "idx_usaha_tabular_produk_trgm",
      "idx_usaha_tabular_kegiatan_trgm",
    ]) {
      assert.match(plan, new RegExp(index), plan);
    }
  });
});

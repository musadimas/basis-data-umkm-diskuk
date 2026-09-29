import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadLegalitas } from "../../src/lib/usaha.js";
import { buatKota, buatLegalitas, buatProduk, buatUsaha } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";

const HARI = 24 * 60 * 60 * 1000;
const tanggalJakarta = (offsetHari = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(Date.now() + offsetHari * HARI));
const tanggalUTC = (offsetHari = 0) => new Date(Date.now() + offsetHari * HARI).toISOString().slice(0, 10);

// Tiga tes perilaku di bawah membandingkan tanggal Jakarta vs UTC. Keduanya hanya berbeda
// pada 00:00-07:00 WIB (UTC masih kemarin), jadi di luar jendela itu tes ini lulus dengan
// implementasi lama maupun baru. Dua tes terakhir menutup celah itu secara deterministik
// dengan memeriksa objek database dan SQL yang benar-benar dipakai.

test("kedaluwarsa legalitas mengikuti tanggal Jakarta, bukan UTC", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7 });
  const usaha = await buatUsaha(db, { nama: "Usaha Waktu", kotaId: 7 });
  const kemarinJakarta = tanggalJakarta(-1);
  const hariIniJakarta = tanggalJakarta(0);
  await buatLegalitas(db, { usahaId: usaha.id, jenis: "pirt", status: "terbit", berlakuHingga: kemarinJakarta });
  await buatLegalitas(db, { usahaId: usaha.id, jenis: "halal", status: "terbit", berlakuHingga: hariIniJakarta });

  await db.transaction(async (trx) => {
    // Sesi sengaja UTC seperti konfigurasi Postgres produksi.
    await trx.raw("SET LOCAL TIME ZONE 'UTC'");
    const legalitas = await loadLegalitas(trx, usaha.id);
    const perJenis = Object.fromEntries(legalitas.map((item) => [item.jenis, item]));
    assert.equal(
      perJenis.pirt.status,
      "kedaluwarsa",
      `berlaku_hingga ${kemarinJakarta} (kemarin Jakarta; UTC hari ini ${tanggalUTC(0)})`,
    );
    assert.equal(perJenis.halal.status, "terbit", `berlaku_hingga ${hariIniJakarta} berlaku sampai hari ini`);
  });
});

test("snapshot produk memakai tanggal Jakarta untuk sertifikat berlaku", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7 });
  const usaha = await buatUsaha(db, { nama: "Usaha Snapshot", kotaId: 7, nib: "1234567890123" });
  await buatLegalitas(db, { usahaId: usaha.id, jenis: "halal", status: "terbit", berlakuHingga: tanggalJakarta(0) });
  await buatLegalitas(db, { usahaId: usaha.id, jenis: "pirt", status: "terbit", berlakuHingga: tanggalJakarta(-1) });

  const produk = await buatProduk(db, { usahaId: usaha.id, nama: "Produk Snapshot" });
  const row = await db("produk").where({ id: produk.id }).first();
  assert.match(row.usaha_sertifikasi, /,halal,/, "sertifikat yang berlaku hari ini harus tersalin");
  assert.doesNotMatch(row.usaha_sertifikasi, /pirt/, "sertifikat kedaluwarsa kemarin Jakarta tidak boleh tersalin");
});

test("default tanggal Berita Acara memakai tanggal Jakarta", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const nomor = `BA-UJI-${Date.now()}`;
  await db("talent_berita_acara").insert({ nomor });
  const result = await db.raw("SELECT tanggal::text AS tanggal FROM talent_berita_acara WHERE nomor = ?", [nomor]);
  const [row] = result.rows ?? result;
  assert.equal(row.tanggal, tanggalJakarta(0), `UTC hari ini ${tanggalUTC(0)}`);
});

test("objek database memakai tanggal Jakarta secara eksplisit", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const fungsi = await db.raw("SELECT pg_get_functiondef('produk_usaha_snapshot'::regproc) AS def");
  assert.match(fungsi.rows[0].def, /Asia\/Jakarta/, "trigger snapshot produk harus memakai tanggal Jakarta");

  const bawaan = await db.raw(
    `SELECT pg_get_expr(d.adbin, d.adrelid) AS def
       FROM pg_attrdef d
       JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
      WHERE a.attrelid = 'talent_berita_acara'::regclass AND a.attname = 'tanggal'`,
  );
  assert.match(bawaan.rows[0].def, /Asia\/Jakarta/, "default tanggal BA harus memakai tanggal Jakarta");
});

test("SQL loadLegalitas memakai tanggal Jakarta", async () => {
  const source = await readFile(new URL("../../src/lib/usaha.js", import.meta.url), "utf8");
  assert.match(source, /AT TIME ZONE 'Asia\/Jakarta'/);
  assert.doesNotMatch(source, /berlaku_hingga < CURRENT_DATE/);
});

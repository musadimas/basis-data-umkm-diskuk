import assert from "node:assert/strict";
import test from "node:test";
import registerTalent from "../../src/endpoints/talent/index.js";
import { buatFile, buatLegalitas, uuid } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";
import { akun, buatPengajuan, siapkanTalent } from "./talent-support.mjs";
import * as kosongkanCatatanLama from "../../../../migrations/20261002A-talent-kosongkan-catatan-ditolak-lama.js";

const SKOR = { finansial: 80, pasar: 80, legalitas: 80, sdm: 80 };
const LENGKAP = { kapasitas: 10, satuan: "kg" };
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
  const { db, call, subang, bandung, kabkotaSubang, provinsi } = await siap(t);
  const id = await buatPengajuan(db, { usahaId: subang.id, status: "draft", skor: SKOR });

  const ubah = await call("PATCH", `/pengajuan/${id}`, { accountability: akun(kabkotaSubang.id), body: { kapasitasProduksi: 5 } });
  assert.equal(ubah.res.statusCode, 200, JSON.stringify(ubah.res.body));
  assert.equal(ubah.res.body.data.status, "draft");
  assert.equal(ubah.res.body.data.skor, null);

  // Hanya draft yang dapat diubah; baris dinilai ditolak 409.
  const dinilai = await buatPengajuan(db, { usahaId: bandung.id, status: "dinilai", skor: SKOR });
  const tertutupDinilai = await call("PATCH", `/pengajuan/${dinilai}`, { accountability: akun(provinsi.id), body: {} });
  assert.equal(tertutupDinilai.res.statusCode, 409);
  assert.equal(kode(tertutupDinilai), "PENGAJUAN_CLOSED");

  const tutup = await buatPengajuan(db, { usahaId: subang.id, status: "ditolak" });
  const tertutup = await call("PATCH", `/pengajuan/${tutup}`, { accountability: akun(provinsi.id), body: {} });
  assert.equal(tertutup.res.statusCode, 409);
  assert.equal(kode(tertutup), "PENGAJUAN_CLOSED");

  const hilang = await call("PATCH", `/pengajuan/${uuid()}`, { accountability: akun(provinsi.id), body: {} });
  assert.equal(kode(hilang), "PENGAJUAN_NOT_FOUND");
});

test("hitung-skor: skor tersimpan, status tetap draft, usaha tetap nominated; data tak lengkap 422", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, kabkotaSubang } = await siap(t);
  await buatLegalitas(db, { usahaId: subang.id, jenis: "halal", status: "terbit" });
  const surat = await buatFile(db);
  const dibuat = await call("POST", "/pengajuan", {
    accountability: akun(kabkotaSubang.id),
    body: { usaha: subang.id, kapasitasProduksi: 10, literasiQris: true, literasiPembukuanDigital: true, suratKomitmen: surat.id },
  });
  const id = dibuat.res.body.data.id;

  // Tanpa satuan: 422 dan skor tetap kosong.
  const kurang = await call("POST", `/pengajuan/${id}/hitung-skor`, { accountability: akun(kabkotaSubang.id) });
  assert.equal(kurang.res.statusCode, 422);
  assert.equal(kode(kurang), "DATA_BELUM_LENGKAP");
  assert.equal((await db("talent_pengajuan").where({ id }).first()).skor_total, null);

  await call("PATCH", `/pengajuan/${id}`, {
    accountability: akun(kabkotaSubang.id),
    body: { kapasitasProduksi: 10, satuan: "kg", literasiQris: true, literasiPembukuanDigital: true, suratKomitmen: surat.id },
  });
  const hasil = await call("POST", `/pengajuan/${id}/hitung-skor`, { accountability: akun(kabkotaSubang.id) });
  assert.equal(hasil.res.statusCode, 200, JSON.stringify(hasil.res.body));
  assert.equal(hasil.res.body.data.status, "draft");
  assert.equal(hasil.res.body.data.skor.rubrikVersi, "placeholder-v0");
  assert.equal(hasil.res.body.data.skor.pasar, 100);
  assert.equal((await db("usaha").where({ id: subang.id }).first()).talent_status, "nominated");

  // Kapasitas 0 juga 422.
  await call("PATCH", `/pengajuan/${id}`, { accountability: akun(kabkotaSubang.id), body: { kapasitasProduksi: 0, satuan: "kg" } });
  const nol = await call("POST", `/pengajuan/${id}/hitung-skor`, { accountability: akun(kabkotaSubang.id) });
  assert.equal(nol.res.statusCode, 422);
  assert.equal(kode(nol), "DATA_BELUM_LENGKAP");
});

test("ajukan: draft berskor menjadi dinilai dan usaha scouting; tanpa skor 409; dinilai 409; tak lengkap 422", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, bandung, provinsi, kabkotaSubang } = await siap(t);

  // Tanpa skor: 409 SKOR_BELUM_DIHITUNG.
  const tanpaSkor = await buatPengajuan(db, { usahaId: subang.id, status: "draft", ...LENGKAP });
  const gagalSkor = await call("POST", `/pengajuan/${tanpaSkor}/ajukan`, { accountability: akun(kabkotaSubang.id) });
  assert.equal(gagalSkor.res.statusCode, 409);
  assert.equal(kode(gagalSkor), "SKOR_BELUM_DIHITUNG");

  // Berskor tapi tanpa satuan: 422 DATA_BELUM_LENGKAP.
  await db("talent_pengajuan")
    .where({ id: tanpaSkor })
    .update({ skor_finansial: 80, skor_pasar: 80, skor_legalitas: 80, skor_sdm: 80, skor_total: 80, rubrik_versi: "placeholder-v0", satuan: null });
  const takLengkap = await call("POST", `/pengajuan/${tanpaSkor}/ajukan`, { accountability: akun(kabkotaSubang.id) });
  assert.equal(takLengkap.res.statusCode, 422);
  assert.equal(kode(takLengkap), "DATA_BELUM_LENGKAP");

  // Draft berskor lengkap: 200 dinilai + usaha scouting.
  const id = await buatPengajuan(db, { usahaId: bandung.id, status: "draft", skor: SKOR, ...LENGKAP });
  const hasil = await call("POST", `/pengajuan/${id}/ajukan`, { accountability: akun(provinsi.id) });
  assert.equal(hasil.res.statusCode, 200, JSON.stringify(hasil.res.body));
  assert.equal(hasil.res.body.data.status, "dinilai");
  assert.equal((await db("usaha").where({ id: bandung.id }).first()).talent_status, "scouting");

  const ulang = await call("POST", `/pengajuan/${id}/ajukan`, { accountability: akun(provinsi.id) });
  assert.equal(ulang.res.statusCode, 409);
  assert.equal(kode(ulang), "PENGAJUAN_CLOSED");
});

test("ajukan paralel: tepat satu 200", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, provinsi } = await siap(t);
  const id = await buatPengajuan(db, { usahaId: subang.id, status: "draft", skor: SKOR, ...LENGKAP });
  const klik = () => call("POST", `/pengajuan/${id}/ajukan`, { accountability: akun(provinsi.id) });

  const hasil = await Promise.all([klik(), klik(), klik()]);
  const status = hasil.map((item) => item.res.statusCode).sort();
  assert.deepEqual(status, [200, 409, 409], JSON.stringify(hasil.map((item) => item.res.body)));
  assert.equal((await db("talent_pengajuan").where({ id }).first()).status, "dinilai");
});

test("ajukan paralel dengan PATCH: tepat satu berhasil dan status konsisten", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, provinsi } = await siap(t);
  const id = await buatPengajuan(db, { usahaId: subang.id, status: "draft", skor: SKOR, ...LENGKAP });

  const [ajukan, patch] = await Promise.all([
    call("POST", `/pengajuan/${id}/ajukan`, { accountability: akun(provinsi.id) }),
    call("PATCH", `/pengajuan/${id}`, { accountability: akun(provinsi.id), body: { kapasitasProduksi: 20, satuan: "kg" } }),
  ]);
  const codes = [ajukan.res.statusCode, patch.res.statusCode].sort();
  assert.deepEqual(codes, [200, 409], JSON.stringify([ajukan.res.body, patch.res.body]));
  const baris = await db("talent_pengajuan").where({ id }).first();
  assert.ok(
    (baris.status === "dinilai" && baris.skor_total !== null) || (baris.status === "draft" && baris.skor_total === null),
    JSON.stringify(baris),
  );
});

test("tolak: hanya provinsi, alasan wajib, hanya dinilai; catatan pengaju utuh", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, bandung, provinsi, kabkotaSubang } = await siap(t);
  const id = await buatPengajuan(db, { usahaId: subang.id, status: "dinilai", skor: SKOR, catatan: "catatan pengaju" });

  const kabkota = await call("POST", `/pengajuan/${id}/tolak`, { accountability: akun(kabkotaSubang.id), body: { alasan: "x" } });
  assert.equal(kabkota.nextError?.statusCode ?? kabkota.res.statusCode, 403);

  const kosong = await call("POST", `/pengajuan/${id}/tolak`, { accountability: akun(provinsi.id), body: {} });
  assert.equal(kosong.res.statusCode, 400);
  assert.equal(kode(kosong), "ALASAN_WAJIB");

  const spasi = await call("POST", `/pengajuan/${id}/tolak`, { accountability: akun(provinsi.id), body: { alasan: "   " } });
  assert.equal(spasi.res.statusCode, 400);
  assert.equal(kode(spasi), "ALASAN_WAJIB");

  // Draft (belum diajukan) tidak dapat ditolak.
  const draft = await buatPengajuan(db, { usahaId: bandung.id, status: "draft" });
  const belum = await call("POST", `/pengajuan/${draft}/tolak`, { accountability: akun(provinsi.id), body: { alasan: "x" } });
  assert.equal(belum.res.statusCode, 409);
  assert.equal(kode(belum), "PENGAJUAN_TIDAK_SIAP_DIKURASI");

  const tolak = await call("POST", `/pengajuan/${id}/tolak`, { accountability: akun(provinsi.id), body: { alasan: "belum siap" } });
  assert.equal(tolak.res.statusCode, 200, JSON.stringify(tolak.res.body));
  assert.equal(tolak.res.body.data.status, "ditolak");
  assert.equal(tolak.res.body.data.alasanTolak, "belum siap");
  assert.ok(tolak.res.body.data.ditolakAt, "ditolakAt terisi");
  assert.equal(tolak.res.body.data.catatan, "catatan pengaju");
  const baris = await db("talent_pengajuan").where({ id }).first();
  assert.equal(baris.ditolak_oleh, provinsi.id);
  assert.ok(baris.ditolak_at instanceof Date, "ditolak_at tersimpan sebagai TIMESTAMPTZ");
  assert.equal((await db("usaha").where({ id: subang.id }).first()).talent_status, "none");

  const ulang = await call("POST", `/pengajuan/${id}/tolak`, { accountability: akun(provinsi.id), body: { alasan: "x" } });
  assert.equal(ulang.res.statusCode, 409);
  assert.equal(kode(ulang), "PENGAJUAN_TIDAK_SIAP_DIKURASI");
});

test("daftar ditolak hanya penolakan terbaru per usaha", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, bandung, provinsi } = await siap(t);
  const lama = await buatPengajuan(db, { usahaId: subang.id, status: "ditolak", dateCreated: "2026-09-01T00:00:00Z" });
  await buatPengajuan(db, { usahaId: subang.id, status: "disetujui", skor: SKOR, dateCreated: "2026-09-10T00:00:00Z" });
  const ditolakBandung = await buatPengajuan(db, { usahaId: bandung.id, status: "ditolak", dateCreated: "2026-09-05T00:00:00Z" });

  const hasil = await call("GET", "/pengajuan", { accountability: akun(provinsi.id), query: { status: "ditolak" } });
  assert.equal(hasil.res.statusCode, 200);
  assert.deepEqual(hasil.res.body.data.map((p) => p.id), [ditolakBandung]);
  assert.ok(!hasil.res.body.data.some((p) => p.id === lama));
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

test("PDF Berita Acara: provinsi 200 berisi nomor dan usaha; kabkota 403; id asing 404; id rusak 400", { skip: pgSkipReason() }, async (t) => {
  const { db, call, subang, bandung, provinsi, kabkotaSubang } = await siap(t);
  const a = await buatPengajuan(db, { usahaId: subang.id, status: "dinilai", skor: SKOR });
  const b = await buatPengajuan(db, { usahaId: bandung.id, status: "dinilai", skor: SKOR });
  const dibuat = await call("POST", "/berita-acara", { accountability: akun(provinsi.id), body: { pengajuan: [a, b], catatan: "batch 1" } });
  assert.equal(dibuat.res.statusCode, 201, JSON.stringify(dibuat.res.body));
  const id = dibuat.res.body.data.id;

  const prov = await call("GET", `/berita-acara/${id}/pdf`, { accountability: akun(provinsi.id) });
  assert.equal(prov.res.statusCode, 200, JSON.stringify(prov.res.body));
  assert.equal(prov.res.headers["Content-Type"], "application/pdf");
  assert.ok(prov.res.headers["Content-Disposition"].includes("BA-TS-"), prov.res.headers["Content-Disposition"]);
  const raw = prov.res.body.toString("latin1");
  assert.equal(raw.slice(0, 8), "%PDF-1.4");
  assert.match(raw, /BA-TS\/\d{4}\/0001/);
  assert.match(raw, /Usaha Subang/);
  assert.match(raw, /Usaha Bandung/);

  const kabkota = await call("GET", `/berita-acara/${id}/pdf`, { accountability: akun(kabkotaSubang.id) });
  assert.equal(kabkota.nextError?.statusCode ?? kabkota.res.statusCode, 403);

  const asing = await call("GET", `/berita-acara/${uuid()}/pdf`, { accountability: akun(provinsi.id) });
  assert.equal(asing.res.statusCode, 404);
  assert.equal(kode(asing), "BERITA_ACARA_NOT_FOUND");

  const rusak = await call("GET", "/berita-acara/x/pdf", { accountability: akun(provinsi.id) });
  assert.equal(rusak.res.statusCode, 400);
});

test("migration 20261002A: catatan baris ditolak lama (hasil backfill) dikosongkan, penolakan baru utuh", { skip: pgSkipReason() }, async (t) => {
  const { db, subang, bandung, provinsi } = await siap(t);
  // Bentuk pra-20261001A setelah backfill: alasan kurator ada di catatan dan alasan_tolak, tanpa pelaku.
  const lama = await buatPengajuan(db, { usahaId: subang.id, status: "ditolak", catatan: "Data omzet belum valid" });
  await db("talent_pengajuan").where({ id: lama }).update({ alasan_tolak: "Data omzet belum valid", ditolak_at: new Date() });
  const baru = await buatPengajuan(db, { usahaId: bandung.id, status: "ditolak", catatan: "Catatan pengaju" });
  await db("talent_pengajuan").where({ id: baru }).update({ alasan_tolak: "Alasan kurator", ditolak_oleh: provinsi.id, ditolak_at: new Date() });

  await kosongkanCatatanLama.up(db);
  const baris = async (id) => db("talent_pengajuan").where({ id }).first();
  assert.equal((await baris(lama)).catatan, null);
  assert.equal((await baris(lama)).alasan_tolak, "Data omzet belum valid");
  assert.equal((await baris(baru)).catatan, "Catatan pengaju");

  await kosongkanCatatanLama.down(db);
  assert.equal((await baris(lama)).catatan, "Data omzet belum valid");
  assert.equal((await baris(baru)).catatan, "Catatan pengaju");
});

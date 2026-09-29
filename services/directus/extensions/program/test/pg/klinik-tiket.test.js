import assert from "node:assert/strict";
import test from "node:test";
import registerKlinik from "../../src/endpoints/klinik/index.js";
import { LAMPIRAN_FOLDER_ID } from "../../src/endpoints/klinik/service.js";
import { NOMOR_TIKET } from "../../src/endpoints/klinik/rules.js";
import { buatKota, buatUsaha, buatUser } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";
import { ENV, PNG, akun, captchaSah, fakeDirectus, formMultipart, hariKerja, payloadTiket } from "./klinik-support.js";

const kode = (hasil) => hasil.res.body?.errors?.[0]?.extensions?.code;
const hitung = async (db, tabel, where = {}) => Number((await db(tabel).where(where).count("* as n").first()).n);

async function pasang(db) {
  const fakes = fakeDirectus(db);
  const { call } = mountEndpoint(registerKlinik, {
    database: db,
    env: ENV,
    context: { services: fakes.services, getSchema: fakes.getSchema },
  });
  const pesan = async ({ payload, lampiran = [], captcha, accountability = null }) =>
    call("POST", "/tiket", {
      accountability,
      ...formMultipart({ payload, lampiran, captcha: captcha ?? (await captchaSah()) }),
    });
  return { fakes, call, pesan };
}

test("pemesanan anonim: unggah -> tiket -> lampiran -> outbox dalam satu alur", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { fakes, pesan } = await pasang(db);

  const hasil = await pesan({ payload: await payloadTiket(db), lampiran: [PNG] });
  assert.equal(hasil.res.statusCode, 201, JSON.stringify(hasil.res.body));
  const data = hasil.res.body.data;
  assert.match(data.nomor, NOMOR_TIKET);
  assert.equal(data.sumberIdentitas, "manual");
  assert.equal(data.slot, "09:00");
  assert.ok(data.notifikasi.status);

  const tiket = await db("konsultasi_tiket").where({ nomor: data.nomor }).first();
  assert.equal(tiket.nama_usaha, "Kedai Uji");
  assert.equal(tiket.whatsapp, "6281234567890");
  assert.equal(tiket.sumber_identitas, "manual");
  assert.equal(tiket.pemohon, null);

  const lampiran = await db("konsultasi_tiket_lampiran").where({ konsultasi_tiket_id: tiket.id });
  assert.equal(lampiran.length, 1);
  const berkas = await db("directus_files").where({ id: lampiran[0].directus_files_id }).first();
  assert.equal(berkas.folder, LAMPIRAN_FOLDER_ID);
  assert.equal(berkas.type, "image/png");
  assert.equal(fakes.uploads.length, 1);

  const pesanOutbox = await db("notifikasi_outbox").where({ tiket: tiket.id });
  assert.equal(pesanOutbox.length, 1);
  assert.equal(pesanOutbox[0].jenis, "tiket_dibuat");
  assert.equal(pesanOutbox[0].consent, true);
  assert.equal(await hitung(db, "auth_captcha_used"), 1, "captcha dikonsumsi tepat sekali");
});

test("pemesanan dari akun SIDT memakai nama usaha di database, bukan dari payload", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7 });
  const usaha = await buatUsaha(db, { nama: "Usaha Terdaftar", kotaId: 7 });
  const owner = await buatUser(db, { appRole: "umkm", usahaId: usaha.id });
  const { pesan } = await pasang(db);

  const hasil = await pesan({ payload: await payloadTiket(db, { namaUsaha: "Nama Palsu" }), accountability: akun(owner.id) });
  assert.equal(hasil.res.statusCode, 201, JSON.stringify(hasil.res.body));
  assert.equal(hasil.res.body.data.sumberIdentitas, "sidt");
  const tiket = await db("konsultasi_tiket").where({ nomor: hasil.res.body.data.nomor }).first();
  assert.equal(tiket.nama_usaha, "Usaha Terdaftar");
  assert.equal(tiket.usaha, usaha.id);
  assert.equal(tiket.pemohon, owner.id);
});

test("dua pemesan slot yang sama: satu 201, satu 409, dan berkas si kalah dihapus", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { fakes, pesan } = await pasang(db);
  const payload = await payloadTiket(db);
  const captchaA = await captchaSah();
  const captchaB = await captchaSah();

  const hasil = await Promise.all([
    pesan({ payload: { ...payload, namaKontak: "Pemesan A" }, lampiran: [PNG], captcha: captchaA }),
    pesan({ payload: { ...payload, namaKontak: "Pemesan B" }, lampiran: [PNG], captcha: captchaB }),
  ]);
  const status = hasil.map((item) => item.res.statusCode).sort();
  assert.deepEqual(status, [201, 409], JSON.stringify(hasil.map((item) => item.res.body)));
  assert.equal(kode(hasil.find((item) => item.res.statusCode === 409)), "SLOT_PENUH");

  assert.equal(await hitung(db, "konsultasi_tiket"), 1);
  assert.equal(await hitung(db, "konsultasi_tiket_lampiran"), 1);
  assert.equal(fakes.uploads.length, 2, "kedua pemesan sempat mengunggah");
  assert.equal(await hitung(db, "directus_files", { folder: LAMPIRAN_FOLDER_ID }), 1, "berkas si kalah dikompensasi");
  assert.equal(fakes.files.size, 1);
});

test("slot yang sudah dipesan menolak 409 dan tidak meninggalkan berkas atau tiket kedua", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { call, fakes, pesan } = await pasang(db);
  const payload = await payloadTiket(db);

  const pertama = await pesan({ payload });
  assert.equal(pertama.res.statusCode, 201, JSON.stringify(pertama.res.body));
  const kedua = await pesan({ payload, lampiran: [PNG, PNG] });
  assert.equal(kedua.res.statusCode, 409);
  assert.equal(kode(kedua), "SLOT_PENUH");
  assert.equal(fakes.uploads.length, 2);
  assert.equal(await hitung(db, "directus_files"), 0);
  assert.equal(fakes.files.size, 0);
  assert.equal(await hitung(db, "konsultasi_tiket"), 1);
  assert.equal(await hitung(db, "notifikasi_outbox"), 1, "pesan outbox si kalah ikut rollback");

  const slot = await call("GET", "/slot", { accountability: null, query: { poli: String(payload.poli), tanggal: payload.tanggal } });
  assert.equal(slot.res.body.data.find((item) => item.slot === "09:00").tersedia, false);
  assert.equal(slot.res.body.data.find((item) => item.slot === "10:30").tersedia, true);
});

test("validasi dan sniff lampiran mendahului captcha, captcha mendahului tulis", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { fakes, pesan } = await pasang(db);
  const payload = await payloadTiket(db);
  const sah = await captchaSah();

  const rusak = await pesan({ payload: { ...payload, deskripsi: "pendek" }, captcha: sah });
  assert.equal(kode(rusak), "INVALID_PAYLOAD");
  const bukanJson = await pesan({ payload: "bukan json", captcha: sah });
  assert.equal(kode(bukanJson), "INVALID_PAYLOAD");
  const html = await pesan({ payload, lampiran: [Buffer.from("<html><script>")], captcha: sah });
  assert.equal(kode(html), "LAMPIRAN_TIDAK_DIDUKUNG");
  const banyak = await pesan({ payload, lampiran: [PNG, PNG, PNG, PNG], captcha: sah });
  assert.equal(kode(banyak), "LAMPIRAN_TERLALU_BANYAK");
  const besar = await pesan({ payload, lampiran: [Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)])], captcha: sah });
  assert.equal(kode(besar), "LAMPIRAN_TERLALU_BESAR");
  assert.equal(await hitung(db, "auth_captcha_used"), 0, "captcha yang sah belum terpakai oleh penolakan validasi");

  const salahCaptcha = await pesan({ payload, captcha: "bukan-captcha" });
  assert.equal(salahCaptcha.res.statusCode, 400);
  assert.equal(kode(salahCaptcha), "CAPTCHA_INVALID");

  const luarRentang = await pesan({ payload: { ...payload, tanggal: hariKerja(1).replace(/^\d{4}/, "2001") }, captcha: sah });
  assert.equal(kode(luarRentang), "TANGGAL_DI_LUAR_RENTANG");

  assert.equal(await hitung(db, "konsultasi_tiket"), 0);
  assert.equal(fakes.uploads.length, 0, "tidak ada unggahan sebelum semua pemeriksaan lolos");

  const dipakai = await pesan({ payload, captcha: sah });
  assert.equal(dipakai.res.statusCode, 201, JSON.stringify(dipakai.res.body));
  const ulang = await pesan({ payload: { ...payload, slot: "10:30" }, captcha: sah });
  assert.equal(kode(ulang), "CAPTCHA_INVALID", "captcha sekali pakai");
});

test("poli dan slot publik membaca database sungguhan", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { call } = await pasang(db);
  const poli = await call("GET", "/poli", { accountability: null });
  assert.equal(poli.res.statusCode, 200);
  assert.ok(poli.res.body.data.length > 0);
  assert.ok(poli.res.body.data.every((item) => Array.isArray(item.subtopik)));

  const tanggal = hariKerja(2);
  const slot = await call("GET", "/slot", { accountability: null, query: { poli: String(poli.res.body.data[0].id), tanggal } });
  assert.equal(slot.res.statusCode, 200);
  assert.deepEqual(slot.res.body.data.map((item) => item.slot), ["09:00", "10:30", "13:00", "14:30"]);
  assert.equal(slot.res.headers["Cache-Control"], "no-store");
  const salahPoli = await call("GET", "/slot", { accountability: null, query: { poli: "0", tanggal } });
  assert.equal(kode(salahPoli), "POLI_TIDAK_VALID");
});

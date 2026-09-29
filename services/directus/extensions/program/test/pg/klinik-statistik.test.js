import assert from "node:assert/strict";
import test from "node:test";
import registerKlinik from "../../src/endpoints/klinik/index.js";
import { jakartaDate } from "../../src/endpoints/kpi/rules.js";
import { buatTiket, buatUser, poliTersedia } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";
import { ENV, captchaSah, hariKerja } from "./klinik-support.js";

const kode = (hasil) => hasil.res.body?.errors?.[0]?.extensions?.code;
const HARI = ["senin", "selasa", "rabu", "kamis", "jumat"];
const SLOTS = ["09:00", "10:30", "13:00", "14:30"];

const pasang = (db, env = ENV) => mountEndpoint(registerKlinik, { database: db, env }).call;

/** Baris audit transisi dengan waktu eksplisit, supaya rata-rata respons bisa dihitung di tes secara independen. */
async function transisi(db, tiketId, statusDari, statusKe, waktu) {
  await db("konsultasi_tiket_audit").insert({ tiket: tiketId, aksi: "transisi", status_dari: statusDari, status_ke: statusKe, date_created: waktu });
}
const setDibuat = (db, tiketId, waktu) => db("konsultasi_tiket").where({ id: tiketId }).update({ date_created: waktu });
const jam = (dasar, n) => new Date(dasar.getTime() + n * 3_600_000);

test("statistik: total selesai, rata-rata respons, dan CSAT cocok dengan hitungan independen dari baris nyata", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const t0 = new Date("2026-08-03T01:00:00Z");
  // Slot berbeda supaya indeks unik slot tidak menolak fixture.
  const semua = [];
  const buat = async (slot, status) => {
    const tiket = await buatTiket(db, { status, jadwalSlot: slot });
    await setDibuat(db, tiket.id, t0);
    semua.push(tiket);
    return tiket;
  };
  const selesaiA = await buat("09:00", "selesai");
  const selesaiB = await buat("10:30", "selesai");
  const selesaiF = await buat("13:00", "selesai");
  const berjalanC = await buat("14:30", "berjalan");
  await buat("15:00", "masuk");
  const batalE = await buat("16:00", "batal");

  // Transisi pertama ke status selain `batal` = respons. A: 2 jam; B: 6 jam; C: 4 jam.
  await transisi(db, selesaiA.id, "masuk", "dijadwalkan", jam(t0, 2));
  await transisi(db, selesaiA.id, "dijadwalkan", "selesai", jam(t0, 50)); // transisi lanjutan tidak menggeser respons
  await transisi(db, selesaiB.id, "masuk", "dijadwalkan", jam(t0, 6));
  await transisi(db, berjalanC.id, "masuk", "dijadwalkan", jam(t0, 4));
  // F: dibatalkan dulu (jam 1, tidak dihitung), lalu dibuka lagi dan dijadwalkan pada jam 10.
  await transisi(db, selesaiF.id, "masuk", "batal", jam(t0, 1));
  await transisi(db, selesaiF.id, "batal", "dijadwalkan", jam(t0, 10));
  // E hanya dibatalkan: tidak pernah diproses, bukan respons. D masih "Tiket Masuk": belum direspons.
  await transisi(db, batalE.id, "masuk", "batal", jam(t0, 3));

  // CSAT: A=5 (consent), B=4 (consent), F=1 tanpa consent (tersimpan, tidak dihitung).
  await db("konsultasi_tiket_csat").insert([
    { tiket: selesaiA.id, nilai: 5, consent: true },
    { tiket: selesaiB.id, nilai: 4, consent: true },
    { tiket: selesaiF.id, nilai: 1, consent: false },
  ]);

  const { res } = await call("GET", "/statistik", { accountability: null });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const data = res.body.data;

  // Perhitungan independen (bukan SQL yang sama): total selesai dan rata-rata dari angka fixture di atas.
  assert.equal(data.totalSelesai, 3);
  assert.equal(data.respons.sampel, 4, "A, B, C, F punya transisi non-batal; D dan E tidak");
  assert.equal(data.respons.rataRataJam, (2 + 6 + 4 + 10) / 4);
  assert.equal(data.respons.targetJam, 24);
  assert.equal(data.csat.sampel, 2, "jawaban tanpa consent tidak dihitung");
  assert.equal(data.csat.rataRata, 4.5);
  assert.equal(data.csat.skalaMaks, 5);
  assert.ok(data.definisi.respons && data.definisi.csat && data.definisi.totalSelesai);
  assert.equal(await db("konsultasi_tiket_csat").count("* as n").first().then((row) => Number(row.n)), 3, "jawaban tanpa consent tetap tersimpan");

  // Publik: hanya agregat, tidak ada tiket/kontak/id.
  const json = JSON.stringify(res.body);
  for (const bocor of ["KLN", "Kontak Uji", "6281200000001", ...semua.map((tiket) => tiket.id)]) {
    assert.equal(json.includes(bocor), false, `bocor: ${bocor}`);
  }
  assert.deepEqual(Object.keys(data).sort(), ["csat", "definisi", "dihitungPada", "respons", "totalSelesai"]);
});

test("statistik: tanpa data atau tanpa jawaban ber-consent, nilai kosong adalah null (bukan 0)", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  let { res } = await call("GET", "/statistik", { accountability: null });
  assert.deepEqual(
    { total: res.body.data.totalSelesai, respons: res.body.data.respons, csat: res.body.data.csat },
    { total: 0, respons: { rataRataJam: null, sampel: 0, targetJam: 24 }, csat: { rataRata: null, sampel: 0, skalaMaks: 5 } },
  );

  // Tiket selesai dengan satu jawaban tanpa consent: total naik, CSAT tetap kosong.
  const tiket = await buatTiket(db, { status: "selesai" });
  await db("konsultasi_tiket_csat").insert({ tiket: tiket.id, nilai: 1, consent: false });
  ({ res } = await call("GET", "/statistik", { accountability: null }));
  assert.equal(res.body.data.totalSelesai, 1);
  assert.equal(res.body.data.csat.rataRata, null);
  assert.equal(res.body.data.csat.sampel, 0);
  // Tiket selesai tanpa jejak audit tidak punya respons yang dapat diukur.
  assert.equal(res.body.data.respons.rataRataJam, null);
});

test("jawab CSAT: kunci nomor+WA, hanya tiket selesai, satu jawaban per tiket, serentak → satu baris", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const selesai = await buatTiket(db, { nomor: "KLN-2026-09-0101", whatsapp: "6281234567890", status: "selesai", jadwalSlot: "09:00" });
  const berjalan = await buatTiket(db, { nomor: "KLN-2026-09-0102", whatsapp: "6281234567890", status: "berjalan", jadwalSlot: "10:30" });
  const kirim = async (badan) =>
    call("POST", "/tiket/csat", { accountability: null, body: { whatsapp: "0812-3456-7890", nilai: 5, consent: true, ...badan, captcha: await captchaSah() } });
  const lacak = async (nomor) =>
    (await call("POST", "/tiket/lacak", { accountability: null, body: { nomor, whatsapp: "6281234567890", captcha: await captchaSah() } })).res.body.data;

  // Sebelum dinilai: tiket selesai menawarkan penilaian; tiket belum selesai tidak.
  assert.deepEqual((await lacak(selesai.nomor)).csat, { bisaMenilai: true, sudahMenilai: false });
  assert.deepEqual((await lacak(berjalan.nomor)).csat, { bisaMenilai: false, sudahMenilai: false });

  // Tanpa captcha sah, tidak ada baris ditulis.
  const tanpaCaptcha = await call("POST", "/tiket/csat", {
    accountability: null,
    body: { nomor: selesai.nomor, whatsapp: "6281234567890", nilai: 5, consent: true },
  });
  assert.equal(kode(tanpaCaptcha), "CAPTCHA_INVALID");
  assert.equal((await db("konsultasi_tiket_csat").count("* as n").first()).n, "0");

  // Nomor tidak ada dan WA salah: 404 identik (tidak menjadi oracle nomor tiket).
  const tidakAda = await kirim({ nomor: "KLN-2026-09-9999" });
  const waSalah = await kirim({ nomor: selesai.nomor, whatsapp: "6289999999999" });
  assert.equal(tidakAda.res.statusCode, 404);
  assert.deepEqual(waSalah.res.body, tidakAda.res.body);

  assert.equal(kode(await kirim({ nomor: berjalan.nomor })), "TIKET_BELUM_SELESAI");

  // Dua kiriman serentak untuk tiket yang sama: satu 201, satu 409; baris tunggal.
  const hasil = await Promise.all([kirim({ nomor: selesai.nomor, nilai: 4 }), kirim({ nomor: selesai.nomor, nilai: 2 })]);
  assert.deepEqual(hasil.map((h) => h.res.statusCode).sort(), [201, 409]);
  assert.equal(kode(hasil.find((h) => h.res.statusCode === 409)), "CSAT_SUDAH_ADA");
  const baris = await db("konsultasi_tiket_csat").where({ tiket: selesai.id });
  assert.equal(baris.length, 1);
  assert.equal(baris[0].consent, true);
  assert.deepEqual((await lacak(selesai.nomor)).csat, { bisaMenilai: false, sudahMenilai: true });

  // Jawaban tanpa consent: tersimpan, tetapi statistik tidak menghitungnya.
  const lain = await buatTiket(db, { nomor: "KLN-2026-09-0103", whatsapp: "6281234567890", status: "selesai", jadwalSlot: "13:00" });
  const tanpaConsent = await kirim({ nomor: lain.nomor, nilai: 1, consent: false });
  assert.equal(tanpaConsent.res.statusCode, 201);
  assert.equal(tanpaConsent.res.body.data.dihitung, false);
  const stat = (await call("GET", "/statistik", { accountability: null })).res.body.data;
  assert.equal(stat.csat.sampel, 1);
  assert.equal(stat.csat.rataRata, baris[0].nilai);
});

/** Slot bebas konsultan dihitung ulang langsung dari baris tiket (bukan lewat fungsi produksi). */
async function slotBebasIndependen(db, konsultan, tanggal) {
  const namaHari = HARI[new Date(`${tanggal}T00:00:00Z`).getUTCDay() - 1];
  if (!konsultan.hari.includes(namaHari)) return [];
  const bebas = [];
  for (const slot of SLOTS.filter((s) => konsultan.slot.includes(s))) {
    const pakaiPoli = await db("konsultasi_tiket")
      .where({ poli: konsultan.poli, jadwal_tanggal: tanggal, jadwal_slot: slot })
      .whereNot({ status: "batal" })
      .first();
    const pakaiPendamping = konsultan.pendamping
      ? await db("konsultasi_tiket").where({ pendamping: konsultan.pendamping, jadwal_tanggal: tanggal, jadwal_slot: slot }).whereNot({ status: "batal" }).first()
      : null;
    if (!pakaiPoli && !pakaiPendamping) bebas.push(slot);
  }
  return bebas;
}

test("direktori konsultan: daftar aktif dan slot bebas cocok dengan DB (jadwal, slot terpakai, batal, pendamping sibuk)", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const poli1 = await poliTersedia(db);
  const poli2 = (await db("konsultasi_poli").select("id").whereNot({ id: poli1 }).orderBy("sort").first()).id;
  const pendamping = await buatUser(db, { appRole: "pendamping" });

  const semuaHari = HARI;
  const dokumen = [
    { nama: "Konsultan Penuh", poli: poli1, afiliasi: "plut", hari: semuaHari, slot: SLOTS, pendamping: null, aktif: true, sort: 1 },
    { nama: "Hanya Selasa", poli: poli1, afiliasi: "dinas", hari: ["selasa"], slot: ["09:00", "13:00"], pendamping: null, aktif: true, sort: 2 },
    { nama: "Praktisi Pendamping", poli: poli2, afiliasi: "praktisi", hari: semuaHari, slot: ["09:00", "10:30"], pendamping: pendamping.id, aktif: true, sort: 3 },
    { nama: "Tidak Aktif", poli: poli1, afiliasi: "plut", hari: semuaHari, slot: SLOTS, pendamping: null, aktif: false, sort: 4 },
  ];
  for (const item of dokumen) {
    await db("klinik_konsultan").insert({ ...item, hari: JSON.stringify(item.hari), slot: JSON.stringify(item.slot) });
  }

  const d1 = hariKerja(1);
  const d2 = hariKerja(2);
  // Poli 1 pada d1 jam 09:00 dipesan tiket aktif; jam 10:30 dibatalkan (slot kembali bebas).
  await buatTiket(db, { poliId: poli1, jadwalTanggal: d1, jadwalSlot: "09:00", status: "dijadwalkan" });
  await buatTiket(db, { poliId: poli1, jadwalTanggal: d1, jadwalSlot: "10:30", status: "batal" });
  // Pendamping memegang tiket poli 1 pada d2 jam 10:30: slot poli 2 yang sama menjadi tidak bebas baginya.
  await buatTiket(db, { poliId: poli1, jadwalTanggal: d2, jadwalSlot: "10:30", status: "berjalan", pendampingId: pendamping.id });

  const { res } = await call("GET", "/konsultan", { accountability: null, query: { hari: "14" } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const { konsultan, rentang } = res.body.data;
  assert.deepEqual(konsultan.map((k) => k.nama), ["Konsultan Penuh", "Hanya Selasa", "Praktisi Pendamping"], "yang tidak aktif tidak tampil");
  assert.match(rentang.dari, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(rentang.dari > jakartaDate(new Date()), "mulai besok");

  // Bandingkan setiap konsultan dengan hitungan independen dari DB untuk setiap tanggal dalam rentang.
  const tanggalList = [];
  for (let ms = Date.parse(`${rentang.dari}T00:00:00Z`); ms <= Date.parse(`${rentang.sampai}T00:00:00Z`); ms += 86_400_000) {
    tanggalList.push(new Date(ms).toISOString().slice(0, 10));
  }
  for (const [indeks, dto] of konsultan.entries()) {
    const sumber = dokumen[indeks];
    const diharapkan = [];
    for (const tanggal of tanggalList) {
      const bebas = await slotBebasIndependen(db, sumber, tanggal);
      if (bebas.length) diharapkan.push({ tanggal, slot: bebas });
    }
    assert.deepEqual(dto.ketersediaan, diharapkan, dto.nama);
    assert.equal(dto.totalSlotBebas, diharapkan.reduce((n, item) => n + item.slot.length, 0));
    for (const { tanggal } of dto.ketersediaan) {
      assert.ok(![0, 6].includes(new Date(`${tanggal}T00:00:00Z`).getUTCDay()), `akhir pekan tidak pernah tampil: ${tanggal}`);
    }
  }

  const [penuh, selasa, praktisi] = konsultan;
  const hariD1 = penuh.ketersediaan.find((item) => item.tanggal === d1);
  assert.ok(hariD1, "d1 berada dalam horizon dan masih punya slot bebas");
  assert.ok(!hariD1.slot.includes("09:00"), "slot poli yang dipesan tidak bebas");
  assert.ok(hariD1.slot.includes("10:30"), "tiket batal membebaskan slot");
  const hariD2Praktisi = praktisi.ketersediaan.find((item) => item.tanggal === d2);
  assert.ok(hariD2Praktisi, "d2 berada dalam horizon");
  assert.deepEqual(hariD2Praktisi.slot, ["09:00"], "pendamping yang sibuk di poli lain kehilangan slot itu");
  assert.ok(selasa.ketersediaan.every((item) => new Date(`${item.tanggal}T00:00:00Z`).getUTCDay() === 2), "hanya hari kerja yang dilayani");
  assert.ok(selasa.ketersediaan.every((item) => item.slot.every((slot) => ["09:00", "13:00"].includes(slot))));
  assert.deepEqual(penuh.poli.id, poli1);
  assert.equal(penuh.afiliasiLabel, "PLUT");

  // Publik: tidak ada id akun pendamping, e-mail, atau nomor telepon.
  const json = JSON.stringify(res.body);
  assert.equal(json.includes(pendamping.id), false);
  assert.equal(json.includes(pendamping.email), false);
  for (const dto of konsultan) assert.equal("pendamping" in dto, false);
});

test("direktori konsultan: coach tanpa slot bebas tampil dengan ketersediaan kosong; horizon divalidasi; jumlah query tetap", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const poli = await poliTersedia(db);
  const tanggal = hariKerja(1);
  await db("klinik_konsultan").insert({ nama: "Satu Slot", poli, afiliasi: "praktisi", hari: JSON.stringify(HARI), slot: JSON.stringify(["09:00"]) });
  // Setiap hari kerja dalam horizon 1 (besok saja) sudah terpesan untuk satu-satunya slot.
  await buatTiket(db, { poliId: poli, jadwalTanggal: tanggal, jadwalSlot: "09:00", status: "dijadwalkan" });

  let raw = 0;
  const hitung = { raw: (...args) => (raw += 1, db.raw(...args)), transaction: (...args) => db.transaction(...args) };
  const call = mountEndpoint(registerKlinik, { database: hitung, env: ENV }).call;

  // Horizon 1 hari = besok saja (bila besok akhir pekan, rentang kosong tanpa galat).
  const { res } = await call("GET", "/konsultan", { accountability: null, query: { hari: "1" } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const [dto] = res.body.data.konsultan;
  assert.equal(dto.nama, "Satu Slot");
  assert.deepEqual(dto.ketersediaan.filter((item) => item.tanggal === tanggal), [], "slot satu-satunya sudah dipesan → tidak bebas");
  assert.ok(raw <= 2, `query direktori tetap (dua), bukan per konsultan: ${raw}`);

  // Tambah konsultan: jumlah query tidak bertambah.
  for (let ke = 0; ke < 5; ke += 1) {
    await db("klinik_konsultan").insert({ nama: `Konsultan ${ke}`, poli, afiliasi: "dinas", hari: JSON.stringify(HARI), slot: JSON.stringify(SLOTS) });
  }
  raw = 0;
  await call("GET", "/konsultan", { accountability: null, query: {} });
  assert.ok(raw <= 2, `jumlah query tidak tumbuh dengan jumlah konsultan: ${raw}`);

  for (const buruk of ["0", "31", "abc", "1.5", "-1"]) {
    const tanggapan = await call("GET", "/konsultan", { accountability: null, query: { hari: buruk } });
    assert.equal(kode(tanggapan), "HORIZON_TIDAK_VALID", buruk);
  }

  // Statistik: satu query saja.
  raw = 0;
  await call("GET", "/statistik", { accountability: null });
  assert.equal(raw, 1, "statistik = satu query");
});

test("baris konsultan yang diedit tangan dengan nilai asing tidak merusak DTO", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const poli = await poliTersedia(db);
  await db("klinik_konsultan").insert({
    nama: "Nilai Asing", poli, afiliasi: "praktisi", hari: JSON.stringify(["senin", "minggu", 3]), slot: JSON.stringify(["09:00", "25:99"]),
  });
  const { res } = await call("GET", "/konsultan", { accountability: null, query: {} });
  assert.equal(res.statusCode, 200);
  const [dto] = res.body.data.konsultan;
  assert.deepEqual(dto.hari, ["senin"]);
  assert.deepEqual(dto.slot, ["09:00"]);
  for (const { tanggal, slot } of dto.ketersediaan) {
    assert.equal(new Date(`${tanggal}T00:00:00Z`).getUTCDay(), 1);
    assert.deepEqual(slot, ["09:00"]);
  }
});

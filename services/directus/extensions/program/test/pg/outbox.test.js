import assert from "node:assert/strict";
import test from "node:test";
import { BACKOFF_MS, CLAIM_LEASE_MS, buatOutbox } from "../../src/lib/outbox/index.js";
import { buatAdapterEmail } from "../../src/lib/outbox/adapters/email.js";
import { buatAdapterMemory } from "../../src/lib/outbox/adapters/memory.js";
import { buatAdapterWhatsapp } from "../../src/lib/outbox/adapters/whatsapp.js";
import { buatKegiatan, buatPengingat, buatTiket } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";

const MENIT = 60_000;
const T0 = new Date("2026-10-01T03:00:00.000Z");

/** Jam yang dapat digeser: backoff dan lease diuji tanpa menunggu waktu nyata. */
function jam(awal = T0) {
  let sekarang = awal.getTime();
  const baca = () => new Date(sekarang);
  baca.maju = (ms) => {
    sekarang += ms;
  };
  return baca;
}

async function siapkan(t, { adapters = [], now = jam() } = {}) {
  const { db } = await withDatabase(t);
  const tiket = await buatTiket(db, { consent: true });
  const outbox = buatOutbox({ database: db, logger: { warn() {} }, adapters, now });
  let urut = 0;
  const pesan = (overrides = {}) => {
    urut += 1;
    return {
      kunci: `uji:${urut}`,
      jenis: "tiket_dibuat",
      kanal: "whatsapp",
      tujuan: `62812000${String(urut).padStart(4, "0")}`,
      template: "klinik_tiket_dibuat",
      pesan: { text: `pesan ${urut}`, params: { n: urut } },
      consent: true,
      sumber: { tiket: tiket.id },
      ...overrides,
    };
  };
  const baris = async (kondisi = "TRUE", bindings = []) =>
    (await db.raw(`SELECT * FROM notifikasi_outbox WHERE ${kondisi} ORDER BY idempotency_key`, bindings)).rows;
  return { db, tiket, outbox, pesan, baris, now };
}

test("enqueue idempoten, wajib consent, dan ikut rollback transaksi pemanggil", { skip: pgSkipReason() }, async (t) => {
  const { db, outbox, pesan, baris } = await siapkan(t);

  const pertama = await outbox.enqueue(db, pesan({ kunci: "sama" }));
  const kedua = await outbox.enqueue(db, pesan({ kunci: "sama" }));
  assert.ok(pertama?.id);
  assert.equal(kedua, null);
  assert.equal((await baris("idempotency_key = 'sama'")).length, 1);

  assert.equal(await outbox.enqueue(db, pesan({ kunci: "tanpa-consent", consent: false })), null);
  assert.equal((await baris("idempotency_key = 'tanpa-consent'")).length, 0);

  await assert.rejects(
    db.transaction(async (trx) => {
      await outbox.enqueue(trx, pesan({ kunci: "di-trx" }));
      throw new Error("rollback");
    }),
    /rollback/,
  );
  assert.equal((await baris("idempotency_key = 'di-trx'")).length, 0);

  // Tepat satu sumber: tiket atau pengingat.
  await assert.rejects(outbox.enqueue(db, pesan({ kunci: "dua", sumber: { tiket: pertama.id, pengingat: pertama.id } })), /tepat satu/);
  await assert.rejects(outbox.enqueue(db, pesan({ kunci: "nol", sumber: {} })), /tepat satu/);
});

test("sumber pengingat menyimpan email dengan kedaluwarsa dan CHECK sumber menolak baris tanpa sumber", { skip: pgSkipReason() }, async (t) => {
  const { db, outbox, pesan, baris } = await siapkan(t);
  const kegiatan = await buatKegiatan(db, { tanggalMulai: new Date(T0.getTime() + 24 * 60 * MENIT) });
  const pengingat = await buatPengingat(db, { kegiatanId: kegiatan.id });

  const row = await outbox.enqueue(
    db,
    pesan({ kunci: `pengingat:${pengingat.id}`, jenis: "pengingat_kegiatan", kanal: "email", tujuan: "a@contoh.test", sumber: { pengingat: pengingat.id }, kedaluwarsaPada: kegiatan.tanggalMulai }),
  );
  assert.equal(row.kanal, "email");
  const [simpan] = await baris("pengingat = ?", [pengingat.id]);
  assert.equal(simpan.tiket, null);
  assert.ok(simpan.kedaluwarsa_pada);

  await assert.rejects(
    db.raw(
      `INSERT INTO notifikasi_outbox (jenis, tujuan, consent, template, idempotency_key) VALUES ('tiket_dibuat', 'x', TRUE, 't', 'tanpa-sumber')`,
    ),
    /notifikasi_outbox_sumber_check/,
  );
});

test("dua dispatch paralel mengirim setiap baris tepat satu kali (SKIP LOCKED)", { skip: pgSkipReason() }, async (t) => {
  const hasil = (kiriman) => ({ ok: true, provider: "memory", messageId: `m-${kiriman.tujuan}`, providerStatus: "accepted" });
  const a = buatAdapterMemory({ tundaMs: 15, hasil });
  const b = buatAdapterMemory({ tundaMs: 15, hasil });
  const { db, tiket, pesan, baris, now } = await siapkan(t);
  const dispatcherA = buatOutbox({ database: db, logger: {}, adapters: [a], now });
  const dispatcherB = buatOutbox({ database: db, logger: {}, adapters: [b], now });
  for (let i = 0; i < 24; i++) await dispatcherA.enqueue(db, pesan({ sumber: { tiket: tiket.id } }));

  const habiskan = async (dispatcher) => {
    let total = 0;
    for (;;) {
      const { terkirim, gagal } = await dispatcher.dispatch({ limit: 4 });
      if (terkirim + gagal === 0) return total;
      total += terkirim;
    }
  };
  const [jumlahA, jumlahB] = await Promise.all([habiskan(dispatcherA), habiskan(dispatcherB)]);

  assert.equal(jumlahA + jumlahB, 24);
  const tujuan = [...a.terkirim, ...b.terkirim].map((kiriman) => kiriman.tujuan);
  assert.equal(new Set(tujuan).size, 24, "tidak ada tujuan yang dikirim dua kali");
  assert.ok(a.terkirim.length > 0 && b.terkirim.length > 0, "kedua dispatcher ikut bekerja");
  const semua = await baris();
  assert.ok(semua.every((row) => row.status === "terkirim" && row.attempts === 1));
});

test("lease: pesan yang sedang dikirim tidak diambil dua kali sampai lease habis", { skip: pgSkipReason() }, async (t) => {
  const memory = buatAdapterMemory();
  const { db, outbox, pesan, baris, now } = await siapkan(t, { adapters: [buatAdapterMemory()] });
  const dispatcher = buatOutbox({ database: db, logger: {}, adapters: [memory], now });
  const row = await outbox.enqueue(db, pesan());
  // Proses lain mengklaim lalu mati di tengah kirim.
  await db.raw(`UPDATE notifikasi_outbox SET status = 'mengirim', attempts = 1, date_updated = ? WHERE id = ?`, [now(), row.id]);

  now.maju(CLAIM_LEASE_MS - MENIT);
  assert.deepEqual(await dispatcher.dispatch(), { terkirim: 0, gagal: 0, dilewati: 0 });
  assert.equal(memory.terkirim.length, 0);

  now.maju(2 * MENIT);
  assert.equal((await dispatcher.dispatch()).terkirim, 1);
  const [akhir] = await baris("id = ?", [row.id]);
  assert.equal(akhir.status, "terkirim");
  assert.equal(akhir.attempts, 2);
});

test("retry mengikuti backoff ke-1 sampai ke-5 lalu gagal; kegagalan permanen langsung gagal", { skip: pgSkipReason() }, async (t) => {
  const memory = buatAdapterMemory({ hasil: () => ({ ok: false, error: "http_503" }) });
  const { db, outbox, pesan, baris, now } = await siapkan(t, { adapters: [memory] });
  const row = await outbox.enqueue(db, pesan());

  for (let percobaan = 1; percobaan <= BACKOFF_MS.length; percobaan++) {
    assert.equal((await outbox.dispatch()).gagal, 1, `percobaan ${percobaan}`);
    const [saat] = await baris("id = ?", [row.id]);
    assert.equal(saat.attempts, percobaan);
    if (percobaan < BACKOFF_MS.length) {
      assert.equal(saat.status, "pending");
      assert.equal(new Date(saat.next_attempt_at).getTime(), now().getTime() + BACKOFF_MS[percobaan - 1]);
      // Sebelum jatuh tempo tidak diklaim; setelahnya ya.
      now.maju(BACKOFF_MS[percobaan - 1] - 1);
      assert.equal((await outbox.dispatch()).gagal, 0);
      now.maju(1);
    } else {
      assert.equal(saat.status, "gagal");
      assert.equal(saat.last_error, "http_503");
    }
  }
  assert.equal(memory.terkirim.length, BACKOFF_MS.length);

  const permanen = buatAdapterMemory({ hasil: () => ({ ok: false, error: "http_400", permanen: true }) });
  const lain = buatOutbox({ database: db, logger: {}, adapters: [permanen], now });
  const kedua = await lain.enqueue(db, pesan());
  assert.equal((await lain.dispatch()).gagal, 1);
  const [gagal] = await baris("id = ?", [kedua.id]);
  assert.equal(gagal.status, "gagal");
  assert.equal(gagal.attempts, 1);
});

test("regresi starvation: 60 baris WhatsApp tanpa adapter tidak menutup email yang jatuh tempo (B17)", { skip: pgSkipReason() }, async (t) => {
  const email = buatAdapterMemory({ kanal: "email" });
  const { db, outbox, pesan, baris, now } = await siapkan(t, { adapters: [email] });
  const lama = new Date(now().getTime() - 60 * MENIT);
  for (let i = 0; i < 60; i++) await outbox.enqueue(db, pesan({ kirimPada: lama }));
  await outbox.enqueue(db, pesan({ kanal: "email", tujuan: "warga@contoh.test", kirimPada: now() }));

  const hasil = await outbox.dispatch({ limit: 10 });
  assert.equal(hasil.terkirim, 1);
  assert.equal(hasil.dilewati, 60);
  assert.equal(email.terkirim.length, 1);
  assert.equal(email.terkirim[0].tujuan, "warga@contoh.test");

  const wa = await baris("kanal = 'whatsapp'");
  assert.equal(wa.length, 60);
  assert.ok(wa.every((row) => row.status === "pending" && row.attempts === 0), "jatah percobaan WA tidak terpakai");
  const tiketWa = await buatTiket(db, { consent: true, jadwalSlot: "20:00" });
  await outbox.enqueue(db, pesan({ sumber: { tiket: tiketWa.id } }));
  assert.deepEqual(await outbox.statusUntuk({ tiket: tiketWa.id }), { status: "menunggu_gateway", label: "Menunggu gateway" });
});

test("resi: 2xx hanya terkirim, callback delivered menjadi diterima, status tak dikenal null", { skip: pgSkipReason() }, async (t) => {
  const memory = buatAdapterMemory({ butuhResi: true, final: true, hasil: (_k, n) => ({ ok: true, provider: "memory", messageId: `wamid-${n}`, providerStatus: "accepted", receipt: { ok: 1 }, final: true }) });
  const { db, outbox, pesan, baris } = await siapkan(t, { adapters: [memory] });
  const a = await outbox.enqueue(db, pesan());
  const b = await outbox.enqueue(db, pesan());
  await outbox.dispatch();

  const [terkirim] = await baris("id = ?", [a.id]);
  assert.equal(terkirim.status, "terkirim", "butuhResi menahan diterima walau adapter mengaku final");
  assert.equal(terkirim.provider_status, "accepted");
  assert.deepEqual(terkirim.provider_receipt, { ok: 1 });

  assert.equal(await outbox.terapkanResi({ providerMessageId: "wamid-1", status: "sedang-diproses" }), null);
  const diterima = await outbox.terapkanResi({ providerMessageId: "wamid-1", status: "delivered", receipt: { at: 1 } });
  assert.equal(diterima.id, a.id);
  assert.equal(diterima.status, "diterima");
  const [setelah] = await baris("id = ?", [a.id]);
  assert.equal(setelah.provider_status, "delivered");
  assert.ok(setelah.diterima_at);

  const gagal = await outbox.terapkanResi({ id: b.id, status: "failed" });
  assert.equal(gagal.status, "gagal");
  assert.equal(await outbox.terapkanResi({ providerMessageId: "tidak-ada", status: "delivered" }), null);
});

test("adapter tanpa resi menganggap kirim final sebagai diterima; label email SMTP", { skip: pgSkipReason() }, async (t) => {
  const email = buatAdapterMemory({ kanal: "email", butuhResi: false, final: true });
  const { db, outbox, pesan, baris } = await siapkan(t, { adapters: [email] });
  const row = await outbox.enqueue(db, pesan({ kanal: "email", tujuan: "a@contoh.test" }));
  await outbox.dispatch();
  const [akhir] = await baris("id = ?", [row.id]);
  assert.equal(akhir.status, "diterima");
  assert.ok(akhir.diterima_at);
  assert.deepEqual(await outbox.statusUntuk({ tiket: akhir.tiket }), { status: "diterima", label: "Terkirim (SMTP)" });
});

test("batalkan menahan pesan pending; lewat kedaluwarsaPada menjadi batal tanpa dikirim", { skip: pgSkipReason() }, async (t) => {
  const memory = buatAdapterMemory();
  const { db, outbox, pesan, baris, now, tiket } = await siapkan(t, { adapters: [memory] });
  const dibatalkan = await outbox.enqueue(db, pesan({ kunci: "dibatalkan" }));
  const kedaluwarsa = await outbox.enqueue(db, pesan({ kunci: "kedaluwarsa", kedaluwarsaPada: new Date(now().getTime() + 10 * MENIT) }));
  const aman = await outbox.enqueue(db, pesan({ kunci: "aman", kedaluwarsaPada: new Date(now().getTime() + 60 * MENIT) }));

  assert.equal(await outbox.batalkan(db, { tiket: tiket.id }, "ditarik"), 3);
  // Tersisa satu: pulihkan dua lainnya ke pending untuk sisa skenario.
  await db.raw(`UPDATE notifikasi_outbox SET status = 'pending', alasan = NULL WHERE id = ANY(?)`, [[kedaluwarsa.id, aman.id]]);

  now.maju(20 * MENIT);
  const hasil = await outbox.dispatch();
  assert.equal(hasil.terkirim, 1);
  assert.equal(memory.terkirim.length, 1);

  const [b] = await baris("id = ?", [dibatalkan.id]);
  assert.equal(b.status, "batal");
  assert.equal(b.alasan, "ditarik");
  assert.equal(b.attempts, 0);
  const [k] = await baris("id = ?", [kedaluwarsa.id]);
  assert.equal(k.status, "batal");
  assert.equal(k.alasan, "kedaluwarsa");
  assert.equal(k.attempts, 0);
  const [a] = await baris("id = ?", [aman.id]);
  assert.equal(a.status, "terkirim");
});

test("adapter WhatsApp/email hanya terpasang bila terkonfigurasi", () => {
  assert.equal(buatAdapterWhatsapp({ env: {} }), null);
  assert.equal(buatAdapterEmail({}), null);
  const wa = buatAdapterWhatsapp({ env: { WHATSAPP_GATEWAY_URL: "http://gw.test" } });
  assert.equal(wa.kanal, "whatsapp");
  assert.equal(wa.butuhResi, true);
  assert.equal(buatAdapterWhatsapp({ env: { WHATSAPP_GATEWAY_URL: "http://gw.test", WHATSAPP_REQUIRE_CALLBACK: "false" } }).butuhResi, false);
});

test("adapter WhatsApp: 4xx permanen kecuali 408/429, 5xx dicoba ulang", async () => {
  const jawab = (status) => async () => ({ ok: false, status, text: async () => "" });
  const kirim = (status) =>
    buatAdapterWhatsapp({ env: { WHATSAPP_GATEWAY_URL: "http://gw.test" }, fetchImpl: jawab(status) }).kirim({ tujuan: "62", template: "t", pesan: { text: "x" } });
  assert.equal((await kirim(400)).permanen, true);
  assert.equal((await kirim(429)).permanen, false);
  assert.equal((await kirim(503)).permanen, false);
});

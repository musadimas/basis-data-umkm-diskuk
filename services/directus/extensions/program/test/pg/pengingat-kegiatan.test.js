import assert from "node:assert/strict";
import test from "node:test";
import { batalkanPengingat, jadwalkanPengingatJatuhTempo } from "../../src/endpoints/kegiatan/service.js";
import { buatOutbox } from "../../src/lib/outbox/index.js";
import { buatAdapterEmail } from "../../src/lib/outbox/adapters/email.js";
import { buatAdapterMemory } from "../../src/lib/outbox/adapters/memory.js";
import { buatKegiatan, buatPengingat } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";

const HARI = 24 * 60 * 60 * 1000;

async function siapkan(t, adapters = [buatAdapterMemory({ kanal: "email", final: true })]) {
  const { db } = await withDatabase(t);
  const outbox = buatOutbox({ database: db, logger: { warn() {} }, adapters });
  const antrean = async (kondisi = "TRUE", bindings = []) =>
    (await db.raw(`SELECT * FROM notifikasi_outbox WHERE ${kondisi} ORDER BY date_created, id`, bindings)).rows;
  return { db, outbox, antrean };
}

test("langganan jatuh tempo diantrekan ke outbox dengan kedaluwarsa = kegiatan mulai, lalu dikirim (Tes 8)", { skip: pgSkipReason() }, async (t) => {
  const email = buatAdapterMemory({ kanal: "email", final: true });
  const { db, outbox, antrean } = await siapkan(t, [email]);
  const kegiatan = await buatKegiatan(db, { judul: "Bazar <b>UMKM</b>", tanggalMulai: new Date(Date.now() + 2 * HARI), lokasi: "Gedung <script>x</script>" });
  const langganan = await buatPengingat(db, { kegiatanId: kegiatan.id, tujuan: "baru@contoh.test", jadwalKirim: new Date(Date.now() - 60_000) });
  const belumJatuhTempo = await buatPengingat(db, { kegiatanId: kegiatan.id, tujuan: "nanti@contoh.test", jadwalKirim: new Date(Date.now() + HARI) });

  const hasil = await jadwalkanPengingatJatuhTempo({ database: db, outbox, env: { PUBLIC_URL: "http://diskuk.test" } });
  assert.deepEqual(hasil, { dijadwalkan: 1, dibatalkan: 0, kedaluwarsa: 0 });

  const [pesan, ...lain] = await antrean();
  assert.equal(lain.length, 0);
  assert.equal(pesan.pengingat, langganan.id);
  assert.equal(pesan.tiket, null);
  assert.equal(pesan.jenis, "pengingat_kegiatan");
  assert.equal(pesan.kanal, "email");
  assert.equal(pesan.status, "pending");
  assert.match(pesan.idempotency_key, new RegExp(`^pengingat:${langganan.id}:`));
  assert.equal(new Date(pesan.kedaluwarsa_pada).getTime(), new Date(kegiatan.tanggalMulai).getTime());
  // Templat memakai escape HTML: judul/lokasi dari staf tidak menjadi markup.
  assert.doesNotMatch(pesan.payload.html, /<script>|<b>UMKM/);
  assert.match(pesan.payload.html, /Bazar &lt;b&gt;UMKM&lt;\/b&gt;/);
  assert.match(pesan.payload.text, /http:\/\/diskuk\.test\/v1\/program\/kegiatan\/pengingat\//);

  assert.equal((await db("kegiatan_pengingat").where({ id: langganan.id }).first()).status, "dijadwalkan");
  assert.equal((await db("kegiatan_pengingat").where({ id: belumJatuhTempo.id }).first()).status, "menunggu");

  // Menjalankan ulang tidak menggandakan pesan.
  assert.deepEqual(await jadwalkanPengingatJatuhTempo({ database: db, outbox }), { dijadwalkan: 0, dibatalkan: 0, kedaluwarsa: 0 });
  assert.equal((await antrean()).length, 1);

  assert.deepEqual(await outbox.dispatch(), { terkirim: 1, gagal: 0, dilewati: 0 });
  assert.equal(email.terkirim.length, 1);
  assert.equal(email.terkirim[0].tujuan, "baru@contoh.test");
  assert.equal((await antrean())[0].status, "diterima");
});

test("kegiatan yang sudah lewat tidak diantrekan dan langganannya dibatalkan sebagai kedaluwarsa (Tes 8, B18)", { skip: pgSkipReason() }, async (t) => {
  const { db, outbox, antrean } = await siapkan(t);
  const kemarin = await buatKegiatan(db, {
    judul: "Kegiatan Kemarin",
    tanggalMulai: new Date(Date.now() - HARI),
    tanggalSelesai: new Date(Date.now() - HARI + 3_600_000),
  });
  const besok = await buatKegiatan(db, { judul: "Kegiatan Besok", tanggalMulai: new Date(Date.now() + HARI) });
  const tertinggal = await buatPengingat(db, { kegiatanId: kemarin.id, tujuan: "lama@contoh.test", jadwalKirim: new Date(Date.now() - HARI) });
  const tepatWaktu = await buatPengingat(db, { kegiatanId: besok.id, tujuan: "baru@contoh.test", jadwalKirim: new Date(Date.now() - 60_000) });

  const hasil = await jadwalkanPengingatJatuhTempo({ database: db, outbox });
  assert.deepEqual(hasil, { dijadwalkan: 1, dibatalkan: 0, kedaluwarsa: 1 });

  assert.deepEqual((await antrean()).map((row) => row.pengingat), [tepatWaktu.id]);
  const row = await db("kegiatan_pengingat").where({ id: tertinggal.id }).first();
  assert.equal(row.status, "dibatalkan");
  assert.equal(row.alasan, "kedaluwarsa");
});

test("kegiatan yang ditarik membuat langganannya dibatalkan dan pesan pending-nya batal (Tes 8)", { skip: pgSkipReason() }, async (t) => {
  const { db, outbox, antrean } = await siapkan(t);
  const kegiatan = await buatKegiatan(db, { tanggalMulai: new Date(Date.now() + 3 * HARI) });
  const langganan = await buatPengingat(db, { kegiatanId: kegiatan.id, tujuan: "a@contoh.test", jadwalKirim: new Date(Date.now() - 60_000) });
  const menunggu = await buatPengingat(db, { kegiatanId: kegiatan.id, tujuan: "b@contoh.test", jadwalKirim: new Date(Date.now() + HARI) });
  await jadwalkanPengingatJatuhTempo({ database: db, outbox });
  assert.equal((await antrean("status = 'pending'")).length, 1);

  await db("kegiatan").where({ id: kegiatan.id }).update({ status_publikasi: "dibatalkan" });
  const hasil = await jadwalkanPengingatJatuhTempo({ database: db, outbox });
  assert.equal(hasil.dibatalkan, 2);

  for (const id of [langganan.id, menunggu.id]) {
    const row = await db("kegiatan_pengingat").where({ id }).first();
    assert.equal(row.status, "dibatalkan");
    assert.equal(row.alasan, "kegiatan_dibatalkan");
  }
  const [pesan] = await antrean();
  assert.equal(pesan.status, "batal");
  assert.equal((await outbox.dispatch()).terkirim, 0);
});

test("baris WhatsApp tanpa adapter tidak menutup email jatuh tempo (Tes 8, B17)", { skip: pgSkipReason() }, async (t) => {
  const email = buatAdapterMemory({ kanal: "email", final: true });
  const { db, outbox, antrean } = await siapkan(t, [email]);
  const kegiatan = await buatKegiatan(db, { tanggalMulai: new Date(Date.now() + 2 * HARI) });
  const lama = new Date(Date.now() - 2 * HARI);
  for (let i = 0; i < 51; i++) {
    await buatPengingat(db, { kegiatanId: kegiatan.id, kanal: "whatsapp", tujuan: `0812000${String(i).padStart(4, "0")}`, jadwalKirim: lama });
  }
  await buatPengingat(db, { kegiatanId: kegiatan.id, kanal: "email", tujuan: "baru@contoh.test", jadwalKirim: new Date(Date.now() - 60_000) });

  const hasil = await jadwalkanPengingatJatuhTempo({ database: db, outbox, limit: 100 });
  assert.equal(hasil.dijadwalkan, 52);
  const kirim = await outbox.dispatch({ limit: 10 });
  assert.equal(kirim.terkirim, 1);
  assert.equal(kirim.dilewati, 51);
  assert.equal(email.terkirim.length, 1);
  const wa = await antrean("kanal = 'whatsapp'");
  assert.equal(wa.length, 51);
  assert.equal(wa.every((row) => row.status === "pending" && row.attempts === 0), true, "WA tanpa adapter tidak memakai percobaan");
  assert.deepEqual(await outbox.statusUntuk({ pengingat: wa[0].pengingat }), { status: "menunggu_gateway", label: "Menunggu gateway" });
});

test("membatalkan langganan lewat token membatalkan pesan pending; opt-in ulang memakai jadwal baru (Tes 8)", { skip: pgSkipReason() }, async (t) => {
  const { db, outbox, antrean } = await siapkan(t);
  const kegiatan = await buatKegiatan(db, { tanggalMulai: new Date(Date.now() + 3 * HARI) });
  const langganan = await buatPengingat(db, { kegiatanId: kegiatan.id, tujuan: "a@contoh.test", jadwalKirim: new Date(Date.now() - 60_000) });
  await jadwalkanPengingatJatuhTempo({ database: db, outbox });
  const { token } = await db("kegiatan_pengingat").where({ id: langganan.id }).first();

  const hasil = await batalkanPengingat(db, token, outbox);
  assert.equal(hasil.data.sudah, false);
  assert.equal((await antrean())[0].status, "batal");
  assert.equal((await outbox.dispatch()).terkirim, 0);
  assert.equal((await batalkanPengingat(db, token, outbox)).data.sudah, true);

  // Berlangganan lagi dengan jadwal yang sama tidak boleh tertelan kunci idempotensi lama.
  await db("kegiatan_pengingat").where({ id: langganan.id }).update({ status: "menunggu", jadwal_kirim: new Date(Date.now() - 60_000), date_updated: db.raw("NOW() + INTERVAL '1 second'") });
  assert.equal((await jadwalkanPengingatJatuhTempo({ database: db, outbox })).dijadwalkan, 1);
  assert.equal((await antrean()).length, 2);
  assert.equal((await outbox.statusUntuk({ pengingat: langganan.id })).status, "pending");
});

test("adapter email nyata lewat MailService mengirim HTML yang sudah di-escape (Tes 8)", { skip: pgSkipReason() }, async (t) => {
  const surat = [];
  class MailService {
    async send(data) {
      surat.push(data);
      return { messageId: "<m@diskuk>" };
    }
  }
  const { db, outbox } = await siapkan(t, [buatAdapterEmail({ services: { MailService }, database: {}, getSchema: async () => ({}) })]);
  const kegiatan = await buatKegiatan(db, { judul: "Bazar <script>alert(1)</script>", tanggalMulai: new Date(Date.now() + 2 * HARI) });
  await buatPengingat(db, { kegiatanId: kegiatan.id, tujuan: "a@contoh.test", jadwalKirim: new Date(Date.now() - 60_000) });
  await jadwalkanPengingatJatuhTempo({ database: db, outbox });
  assert.equal((await outbox.dispatch()).terkirim, 1);
  assert.equal(surat[0].to, "a@contoh.test");
  assert.doesNotMatch(surat[0].html, /<script>/);
  assert.match(surat[0].html, /Bazar &lt;script&gt;/);
});

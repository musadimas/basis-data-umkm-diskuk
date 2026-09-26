"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  ajukan,
  nominasi,
  tolak,
  terbitkanBeritaAcara,
  listTalenta,
  jakartaDateString,
} = require("../src/talenta-service.js");

const USAHA = "11111111-1111-4111-8111-000000000001";
const TALENTA = "33333333-3333-4333-8333-000000000001";
const FILE_OK = "44444444-4444-4444-8444-000000000001";
const KABKOTA = { userId: "u-kab", role: "kabkota", kotaId: 1 };
const PROVINSI = { userId: "u-prov", role: "provinsi", kotaId: null };
const PENDAMPING = { userId: "u-damp", role: "pendamping" };

const FORM = {
  kapasitasProduksiBulanan: 500,
  satuanKapasitas: "unit",
  kesiapanHalal: true,
  kesiapanPirtBpom: true,
  kesiapanHki: false,
  adopsiQris: true,
  pencatatanKeuanganDigital: true,
  suratKomitmenFileId: null,
};

function baseDb(over = {}) {
  const state = {
    kotaUsaha: 1,
    talentaAktif: null,
    berkasOk: true,
    detailRow: null,
    ...over,
  };
  const queries = [];
  const raw = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes("FROM usaha u") && sql.includes("LEFT JOIN pelaku_usaha")) {
      return {
        rows: [
          {
            id: USAHA,
            nama: "Usaha 01",
            nib: "1234567890123",
            skala: "micro",
            omzet_tahunan: "300000000",
            total_aset: null,
            kota_id: state.kotaUsaha,
            kota_nama: "Kabupaten Bogor",
            kecamatan_nama: "Cibinong",
            kelurahan_nama: "Pakansari",
            pemilik_nama: "Pemilik",
          },
        ],
      };
    }
    if (sql.includes("statistik_tenaga_kerja")) return { rows: [{ total: "10" }] };
    if (sql.includes("FROM usaha_atribut_jabar WHERE usaha")) {
      return {
        rows: [
          {
            npwp_usaha: true,
            sertifikat_halal: true,
            pirt_bpom: true,
            hki_merek: false,
            rekening_terpisah: true,
            sop_tertulis: true,
            ecommerce: true,
            medsos_bisnis: true,
            akses_kur: false,
          },
        ],
      };
    }
    if (sql.includes("FROM talenta WHERE usaha")) {
      return { rows: state.talentaAktif ? [state.talentaAktif] : [] };
    }
    if (sql.includes("FROM directus_files")) {
      return {
        rows: state.berkasOk
          ? [{ id: FILE_OK, folder: "fa57be17-82ba-480c-b77c-536d42a124d4", uploaded_by: KABKOTA.userId }]
          : [{ id: FILE_OK, folder: "fa57be17-82ba-480c-b77c-536d42a124d4", uploaded_by: "u-lain" }],
      };
    }
    if (sql.includes("INSERT INTO talenta (usaha")) return { rows: [{ id: TALENTA }] };
    if (sql.includes("SELECT \n  t.*, ko.nama") || sql.includes("t.*, ko.nama")) {
      return { rows: [state.detailRow ?? { id: TALENTA, usaha: USAHA, usaha_nama: "Usaha 01", kota: 1, kota_nama: "Kabupaten Bogor", status: "diajukan", kapasitas_produksi_bulanan: "500", satuan_kapasitas: "unit", kesiapan_halal: true, kesiapan_pirt_bpom: true, kesiapan_hki: false, adopsi_qris: true, pencatatan_keuangan_digital: true, surat_komitmen: null, skor_finansial: "50", skor_pasar: "87.5", skor_legalitas: "80", skor_sdm: "100", skor_total: "79.38", rubrik_versi: 1, rekomendasi: "Direkomendasikan Masuk Talent Pool", diajukan_oleh: KABKOTA.userId, date_created: "2026-09-20T00:00:00.000Z", berita_acara: null }] };
    }
    if (sql.includes("FROM talenta t") && sql.includes("ORDER BY t.date_created DESC")) {
      return { rows: [] };
    }
    if (sql.includes("COUNT(*)::integer AS total FROM talenta")) return { rows: [{ total: 0 }] };
    return { rows: [] };
  };
  return { queries, raw, transaction: async (fn) => fn({ raw }) };
}

test("kabkota ajukan usaha kota lain → 404", async () => {
  const db = baseDb({ kotaUsaha: 99 });
  await assert.rejects(() => ajukan(db, { usahaId: USAHA, form: FORM }, KABKOTA), (e) => e.statusCode === 404);
});

test("duplikasi aktif → 409 TALENTA_SUDAH_ADA", async () => {
  const db = baseDb({ talentaAktif: { id: TALENTA, status: "diajukan" } });
  await assert.rejects(() => ajukan(db, { usahaId: USAHA, form: FORM }, KABKOTA), (e) => {
    assert.equal(e.code, "TALENTA_SUDAH_ADA");
    return e.statusCode === 409;
  });
});

test("surat komitmen milik user lain → 400", async () => {
  const db = baseDb({ berkasOk: false });
  await assert.rejects(
    () => ajukan(db, { usahaId: USAHA, form: { ...FORM, suratKomitmenFileId: FILE_OK } }, KABKOTA),
    (e) => e.statusCode === 400,
  );
});

test("pendamping ajukan → 403", async () => {
  const db = baseDb();
  await assert.rejects(() => ajukan(db, { usahaId: USAHA, form: FORM }, PENDAMPING), (e) => e.statusCode === 403);
});

test("kabkota nominasi → 403", async () => {
  const db = baseDb();
  await assert.rejects(() => nominasi(db, TALENTA, KABKOTA), (e) => e.statusCode === 403);
});

test("nominasi dari dinilai → 409", async () => {
  const db = baseDb({ detailRow: { id: TALENTA, usaha: USAHA, kota: 1, status: "dinilai", kapasitas_produksi_bulanan: "1", satuan_kapasitas: "unit", kesiapan_halal: false, kesiapan_pirt_bpom: false, kesiapan_hki: false, adopsi_qris: false, pencatatan_keuangan_digital: false, surat_komitmen: null, skor_finansial: "0", skor_pasar: "0", skor_legalitas: "0", skor_sdm: "0", skor_total: "0", rubrik_versi: 1, rekomendasi: "Belum Direkomendasikan", date_created: "2026-09-20T00:00:00.000Z", berita_acara: null } });
  await assert.rejects(() => nominasi(db, TALENTA, PROVINSI), (e) => e.statusCode === 409);
});

test("tolak alasan 3 char → 400", async () => {
  const db = baseDb();
  await assert.rejects(() => tolak(db, TALENTA, { alasan: "abc" }, PROVINSI), (e) => e.statusCode === 400);
});

test("BA dengan satu id berstatus diajukan → 409 tanpa perubahan", async () => {
  const updated = [];
  const raw = async (sql, params) => {
    if (sql.includes("LOCK TABLE")) return { rows: [] };
    if (sql.includes("FROM talenta WHERE id = ANY")) {
      return { rows: [{ id: TALENTA, status: "diajukan" }] };
    }
    if (sql.includes("UPDATE talenta SET status = 'scouting'")) {
      updated.push(params);
      return { rows: [] };
    }
    return { rows: [] };
  };
  const db = { raw, transaction: async (fn) => fn({ raw }) };
  await assert.rejects(
    () => terbitkanBeritaAcara(db, { talentaIds: [TALENTA] }, PROVINSI),
    (e) => {
      assert.equal(e.code, "INVALID_TRANSITION");
      return e.statusCode === 409;
    },
  );
  assert.equal(updated.length, 0);
});

test("BA sukses → nomor BA-TS/<tahun>/0001 pada DB kosong dan tanggal WIB", async () => {
  const updated = [];
  const raw = async (sql, params) => {
    if (sql.includes("LOCK TABLE")) return { rows: [] };
    if (sql.includes("FROM talenta WHERE id = ANY")) return { rows: [{ id: TALENTA, status: "dinilai" }] };
    if (sql.includes("FROM talenta_berita_acara WHERE nomor LIKE")) return { rows: [{ n: 0 }] };
    if (sql.includes("INSERT INTO talenta_berita_acara")) return { rows: [{ id: "ba-1" }] };
    if (sql.includes("UPDATE talenta SET status = 'scouting'")) {
      updated.push(params);
      return { rows: [] };
    }
    return { rows: [] };
  };
  const db = { raw, transaction: async (fn) => fn({ raw }) };
  // 2026-07-31T16:30:00Z = 23:30 WIB 31 Juli → tanggal 2026-07-31 WIB.
  const out = await terbitkanBeritaAcara(db, { talentaIds: [TALENTA] }, PROVINSI, new Date("2026-07-31T16:30:00Z"));
  assert.equal(out.data.nomor, "BA-TS/2026/0001");
  assert.equal(out.data.tanggal, "2026-07-31");
  assert.equal(out.data.jumlah, 1);
  assert.equal(updated.length, 1);
});

test("tanggal WIB: 23:30 UTC 31 Juli → 2026-08-01", () => {
  assert.equal(jakartaDateString(new Date("2026-07-31T16:30:00Z")), "2026-07-31");
  assert.equal(jakartaDateString(new Date("2026-07-31T17:30:00Z")), "2026-08-01");
});

test("list kabkota mengikat kota", async () => {
  const seen = [];
  const raw = async (sql, params) => {
    seen.push({ sql, params });
    if (sql.includes("COUNT(*)")) return { rows: [{ total: 0 }] };
    return { rows: [] };
  };
  const db = { raw, transaction: async (fn) => fn({ raw }) };
  await listTalenta(db, {}, KABKOTA);
  const count = seen.find((q) => q.sql.includes("COUNT(*)"));
  assert.ok(count.params.includes(1), "kota operator diikat pada query");
});

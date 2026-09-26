import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);

const migrationA = readFileSync(
  new URL("../migrations/20260926A-operational-roles.js", import.meta.url),
  "utf8",
);
const migrationB = readFileSync(
  new URL("../migrations/20260926B-kabkota-analytics-access.js", import.meta.url),
  "utf8",
);

const auth = require("../extensions/shared/auth.cjs");
const operator = require("../extensions/shared/operator.cjs");

const ROLE_IDS = {
  provinsi: "7d6d493c-1a6d-4c59-9e74-40d42a7862eb",
  kabkota: "ade3c009-8725-46ba-a7a0-904eeba89d01",
  pendamping: "d824230f-46db-407d-b8ea-fb2ed58c6c4f",
  umkm: "d821d35e-62e1-4f27-a323-843845d6c965",
};

const POLICY_IDS = {
  provinsi: "9325db4b-9518-41db-b122-8c667f2ce510",
  kabkota: "542bb438-226b-49b6-8792-bcfc614560a5",
  pendamping: "81086586-a5a3-4d9e-a650-eca9bac81c23",
  umkm: "98524352-468a-45bd-b638-d4075243d27d",
};

test("migrasi A memuat keempat UUID role dan tiga UUID policy", () => {
  for (const id of Object.values(ROLE_IDS)) {
    assert.ok(migrationA.includes(id), `role id ${id} harus ada di migrasi A`);
  }
  for (const id of Object.values(POLICY_IDS)) {
    assert.ok(migrationA.includes(id), `policy id ${id} harus ada di migrasi A`);
  }
  assert.ok(migrationA.includes("ADD COLUMN IF NOT EXISTS kota"), "kolom kota");
  assert.ok(migrationA.includes("ADD COLUMN IF NOT EXISTS usaha"), "kolom usaha");
  assert.ok(migrationA.includes("ux_directus_users_usaha"), "unique index usaha");
  assert.ok(
    migrationA.includes("id,email,first_name,last_name,avatar,role,kota,usaha"),
    "fields baca diri sendiri termasuk role/kota/usaha",
  );
  assert.ok(migrationA.includes("'password'::text"), "permission update password");
  assert.ok(migrationA.includes("auth_password_policy"), "policy kata sandi diset");
  // NIB 13 digit tidak boleh sah sebagai kata sandi.
  assert.ok(migrationA.includes('^(?!\\\\d{13}$).{12,}$'), "regex menolak NIB sebagai kata sandi");
});

test("migrasi B memberi policy kabkota empat aksi analitik_view", () => {
  for (const action of ["'read'", "'create'", "'update'", "'delete'"]) {
    assert.ok(migrationB.includes(action), `aksi ${action} pada analitik_view kabkota`);
  }
  assert.ok(migrationB.includes(POLICY_IDS.kabkota), "policy kabkota pada migrasi B");
});

test("auth.cjs ROLE_IDS sinkron dengan migrasi dan roleKeyOf benar", () => {
  assert.deepEqual(auth.ROLE_IDS, ROLE_IDS);
  assert.deepEqual(auth.ALL_ROLES, ["provinsi", "kabkota", "pendamping", "umkm"]);
  assert.equal(auth.roleKeyOf({ admin: true }), "provinsi");
  assert.equal(auth.roleKeyOf({ role: ROLE_IDS.umkm }), "umkm");
  assert.equal(auth.roleKeyOf({ role: "bukan-role" }), null);
  assert.equal(auth.roleKeyOf(undefined), null);
});

test("requireDashboardAccountability default provinsi-only", () => {
  const kabkotaReq = { accountability: { user: "u1", role: ROLE_IDS.kabkota } };
  assert.throws(() => auth.requireDashboardAccountability(kabkotaReq), (error) => error.statusCode === 403);
  assert.throws(() => auth.requireDashboardAccountability({ accountability: null }), (error) => error.statusCode === 401);
  assert.doesNotThrow(() => auth.requireDashboardAccountability(kabkotaReq, { roles: ["kabkota"] }));
  // Perilaku lama tetap: role lama + admin lolos guard default.
  assert.doesNotThrow(() => auth.requireDashboardAccountability({ accountability: { user: "u2", role: ROLE_IDS.provinsi } }));
  assert.doesNotThrow(() => auth.requireDashboardAccountability({ accountability: { user: "u3", admin: true } }));
});

test("resolveOperator: provinsi tanpa penugasan tidak menyentuh DB", async () => {
  let calls = 0;
  const database = { async raw() { calls += 1; return { rows: [] }; } };
  const op = await operator.resolveOperator(database, { user: ROLE_IDS.provinsi, role: ROLE_IDS.provinsi, admin: false });
  assert.equal(op.role, "provinsi");
  assert.equal(calls, 0);
});

test("resolveOperator: kabkota dipetakan ke kota, tanpa kota ditolak", async () => {
  const database = {
    async raw(sql, params) {
      assert.ok(sql.includes("FROM directus_users u"));
      if (params[0] === "11111111-1111-4111-8111-00000000000a") {
        return { rows: [{ id: params[0], kota: 7, kota_nama: "KABUPATEN SUBANG", usaha: null, usaha_nama: null, usaha_nib: null }] };
      }
      return { rows: [{ id: params[0], kota: null, kota_nama: null, usaha: null, usaha_nama: null, usaha_nib: null }] };
    },
  };
  const op = await operator.resolveOperator(database, { user: "11111111-1111-4111-8111-00000000000a", role: ROLE_IDS.kabkota });
  assert.equal(op.kotaId, 7);
  await assert.rejects(
    () => operator.resolveOperator(database, { user: "22222222-2222-4222-8222-00000000000b", role: ROLE_IDS.kabkota }),
    (error) => error.statusCode === 403 && error.code === "KOTA_NOT_ASSIGNED",
  );
});

test("scopeTabularQuery memaksa kota kabkota dan scopeTabularOptions memfilter", () => {
  const operatorRow = { role: "kabkota", kotaId: 7 };
  assert.deepEqual(operator.scopeTabularQuery({ kota: "99", page: "2" }, operatorRow), { kota: "7", page: "2" });
  const provinsiRow = { role: "provinsi", kotaId: null };
  assert.deepEqual(operator.scopeTabularQuery({ kota: "99" }, provinsiRow), { kota: "99" });
  const options = {
    kota: [{ id: 7, nama: "Subang" }, { id: 9, nama: "Bogor" }],
    kecamatan: [{ id: 1, kotaId: 7 }, { id: 2, kotaId: 9 }],
  };
  const scoped = operator.scopeTabularOptions(options, operatorRow);
  assert.deepEqual(scoped.kota, [{ id: 7, nama: "Subang" }]);
  assert.deepEqual(scoped.kecamatan, [{ id: 1, kotaId: 7 }]);
  assert.equal(operator.DATA_ROLES.length, 2);
});

test("extension operasional terdaftar sebagai endpoint", () => {
  const pkg = JSON.parse(readFileSync(new URL("../extensions/directus-extension-operasional/package.json", import.meta.url), "utf8"));
  assert.equal(pkg["directus:extension"].type, "endpoint");
});

// ── Y02: atribut Jabar + talenta/BA + kontrak skor (jangan hapus saat Y01 berubah) ──
const migrationC = readFileSync(
  new URL("../migrations/20260926C-create-usaha-atribut-jabar.js", import.meta.url),
  "utf8",
);
const migrationE = readFileSync(
  new URL("../migrations/20260926E-create-talenta.js", import.meta.url),
  "utf8",
);
const talentIndex = require("../extensions/directus-extension-operasional/src/talent-index.js");

const ATRIBUT_15 = [
  "npwp_usaha",
  "izin_edar",
  "sertifikat_halal",
  "pirt_bpom",
  "hki_merek",
  "sni",
  "rekening_terpisah",
  "sop_tertulis",
  "ecommerce",
  "medsos_bisnis",
  "qris",
  "pembukuan_digital",
  "akses_kur",
  "rantai_pasok_industri",
  "kontrak_offtaker",
];

test("migrasi C: 15 atribut Jabar nullable, cascade, rollback disposable", () => {
  assert.ok(migrationC.includes("CREATE TABLE IF NOT EXISTS usaha_atribut_jabar"));
  for (const col of ATRIBUT_15) {
    assert.ok(migrationC.includes(`${col} BOOLEAN`), `kolom ${col}`);
  }
  assert.ok(migrationC.includes("REFERENCES usaha(id) ON DELETE CASCADE"));
  assert.ok(migrationC.includes("DROP TABLE IF EXISTS usaha_atribut_jabar"));
});

test("migrasi E: talenta + BA + indeks parsial + folder + permission berkas", () => {
  assert.ok(migrationE.includes("CREATE TABLE IF NOT EXISTS talenta_berita_acara"));
  assert.ok(migrationE.includes("CREATE TABLE IF NOT EXISTS talenta"));
  assert.ok(migrationE.includes("ux_talenta_usaha_aktif"));
  assert.ok(migrationE.includes("WHERE status <> 'ditolak'"));
  assert.ok(migrationE.includes("idx_talenta_status_kota"));
  assert.ok(migrationE.includes("fa57be17-82ba-480c-b77c-536d42a124d4"));
  for (const id of Object.values(POLICY_IDS)) {
    assert.ok(migrationE.includes(id), `policy ${id} pada migrasi E`);
  }
  assert.ok(migrationE.includes("DROP TABLE IF EXISTS talenta"));
});

test("kontrak skor Y02: fixture angka hasil hitung manual", () => {
  const seed01 = talentIndex.hitungTalentIndex({
    omzetTahunan: 600_000_000,
    nibAda: true,
    totalTenagaKerja: 7,
    atribut: {
      npwp_usaha: true,
      sertifikat_halal: true,
      pirt_bpom: true,
      hki_merek: true,
      rekening_terpisah: true,
      sop_tertulis: true,
      ecommerce: true,
      medsos_bisnis: true,
      akses_kur: true,
    },
    form: {
      kapasitasProduksiBulanan: 1200,
      kesiapanHalal: true,
      kesiapanPirtBpom: true,
      kesiapanHki: true,
      adopsiQris: true,
      pencatatanKeuanganDigital: true,
      suratKomitmenAda: true,
    },
  });
  assert.deepEqual(
    [seed01.finansial, seed01.pasar, seed01.legalitas, seed01.sdm, seed01.total],
    [100, 100, 100, 91, 97.75],
  );
  assert.equal(talentIndex.RUBRIK_VERSI, 1);
});

// ── Y03: program akselerasi + laporan Jumat + verifikasi (jangan hapus) ──
const migrationF = readFileSync(
  new URL("../migrations/20260926F-create-program-akselerasi.js", import.meta.url),
  "utf8",
);
const programWeek = require("../extensions/directus-extension-operasional/src/program-week.js");
const kpiEvaluasi = require("../extensions/directus-extension-operasional/src/kpi-evaluasi.js");

test("migrasi F: batch + kolom talenta + laporan mingguan + provenance + rollback", () => {
  assert.ok(migrationF.includes("CREATE TABLE IF NOT EXISTS program_batch"));
  assert.ok(migrationF.includes("talent_lab','accelerator"));
  assert.ok(migrationF.includes("ADD COLUMN IF NOT EXISTS batch"));
  assert.ok(migrationF.includes("ADD COLUMN IF NOT EXISTS pendamping"));
  assert.ok(migrationF.includes("target_mingguan_override"));
  assert.ok(migrationF.includes("rekomendasi_pitching"));
  assert.ok(migrationF.includes("CREATE TABLE IF NOT EXISTS talenta_laporan_mingguan"));
  assert.ok(migrationF.includes("client_uuid UUID NOT NULL UNIQUE"));
  assert.ok(migrationF.includes("UNIQUE (talenta, minggu_ke)"));
  assert.ok(migrationF.includes("provenance"));
  assert.ok(migrationF.includes("offline-replay"));
  assert.ok(migrationF.includes("DROP TABLE IF EXISTS talenta_laporan_mingguan"));
  assert.ok(migrationF.includes("DROP TABLE IF EXISTS program_batch"));
});

test("kontrak Y03: vektor minggu + Jumat + capaian + rekomendasi", () => {
  assert.equal(programWeek.mingguKe("2026-09-28", new Date("2026-09-27T16:59:59Z")), 0);
  assert.equal(programWeek.mingguKe("2026-09-28", new Date("2026-09-27T17:00:00Z")), 1);
  assert.equal(programWeek.targetMingguan(780000000, 1.2, null), 18000000);
  assert.equal(programWeek.isJumatJakarta(new Date("2026-10-02T05:00:00Z")), true);
  assert.equal(programWeek.isJumatJakarta(new Date("2026-10-01T05:00:00Z")), false);
  assert.equal(kpiEvaluasi.capaianPersen(21000000, 18000000), 116.7);
  assert.equal(kpiEvaluasi.capaianPersen(5000, 0), null);
  assert.equal(
    kpiEvaluasi.layakRekomendasi(
      [1, 2, 3, 4].map((m) => ({ mingguKe: m, omzet: 19000000, target: 18000000, status: "disetujui" })),
    ),
    true,
  );
  assert.equal(
    kpiEvaluasi.layakRekomendasi(
      [2, 3, 5, 6].map((m) => ({ mingguKe: m, omzet: 19000000, target: 18000000, status: "disetujui" })),
    ),
    false,
  );
});

"use strict";

const { pastikanUsaha } = require("../../../analytics-shared/cakupan.cjs");
const { OperasionalError, validationFailed } = require("./errors.js");

const ATRIBUT_COLUMNS = [
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

const ATRIBUT_CAMEL = {
  npwpUsaha: "npwp_usaha",
  izinEdar: "izin_edar",
  sertifikatHalal: "sertifikat_halal",
  pirtBpom: "pirt_bpom",
  hkiMerek: "hki_merek",
  sni: "sni",
  rekeningTerpisah: "rekening_terpisah",
  sopTertulis: "sop_tertulis",
  ecommerce: "ecommerce",
  medsosBisnis: "medsos_bisnis",
  qris: "qris",
  pembukuanDigital: "pembukuan_digital",
  aksesKur: "akses_kur",
  rantaiPasokIndustri: "rantai_pasok_industri",
  kontrakOfftaker: "kontrak_offtaker",
};

const rowsOf = (result) => result?.rows ?? result?.[0] ?? result ?? [];

function toCamelAtribut(row) {
  if (!row) return null;
  const out = {};
  for (const [camel, col] of Object.entries(ATRIBUT_CAMEL)) {
    const v = row[col];
    out[camel] = v === null || v === undefined ? null : Boolean(v);
  }
  return out;
}

const CAMEL_DARI_KOLOM = Object.fromEntries(Object.entries(ATRIBUT_CAMEL).map(([camel, kolom]) => [kolom, camel]));

// Outcome klinik terverifikasi (R04): hanya atribut + jenis + asal tiket/verifikator/tanggal.
// Sengaja tanpa diagnosis, rencana aksi, catatan, kontak, atau tautan rapat tiket.
async function getHasilKonsultasi(database, usahaId) {
  const result = await database.raw(
    `SELECT o.id, o.versi, o.diverifikasi_nama, o.diverifikasi_pada, t.nomor, po.nama AS poli,
            i.atribut, i.jenis
       FROM konsultasi_outcome o
       JOIN konsultasi_tiket t ON t.id = o.tiket
       JOIN konsultasi_poli po ON po.id = t.poli
       JOIN konsultasi_outcome_item i ON i.outcome = o.id
      WHERE o.usaha = ? AND o.status = 'terverifikasi'
      ORDER BY o.diverifikasi_pada DESC, o.id, i.atribut`,
    [usahaId],
  );
  const perOutcome = new Map();
  for (const row of rowsOf(result)) {
    if (!perOutcome.has(row.id)) {
      perOutcome.set(row.id, {
        id: row.id,
        versi: row.versi,
        nomorTiket: row.nomor,
        poli: row.poli,
        diverifikasiOleh: row.diverifikasi_nama ?? null,
        diverifikasiPada: row.diverifikasi_pada ? new Date(row.diverifikasi_pada).toISOString() : null,
        items: [],
      });
    }
    perOutcome.get(row.id).items.push({ atribut: CAMEL_DARI_KOLOM[row.atribut] ?? row.atribut, jenis: row.jenis });
  }
  return [...perOutcome.values()];
}

async function getUsahaLapangan(database, usahaId, pemanggil) {
  await pastikanUsaha(database, pemanggil, usahaId);
  const detail = await database.raw(
    `SELECT u.id, u.nama, u.nib, u.kegiatan_utama, u.produk_utama, u.skala,
            u.omzet_tahunan, u.total_aset, u.latitude, u.longitude, u.status,
            kk.kode AS kode_kbli,
            a.alamat_jalan,
            ko.id AS kota_id, ko.nama AS kota_nama,
            kc.nama AS kecamatan_nama, kl.nama AS kelurahan_nama,
            pu.nama_lengkap AS pemilik_nama
     FROM usaha u
     LEFT JOIN klasifikasi_usaha kk ON kk.id = u.klasifikasi
     LEFT JOIN alamat a ON a.id = u.alamat
     LEFT JOIN kelurahan kl ON kl.id = a.kelurahan
     LEFT JOIN kecamatan kc ON kc.id = kl.kecamatan
     LEFT JOIN kota ko ON ko.id = kc.kota
     LEFT JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha
     WHERE u.id = ?
     LIMIT 1`,
    [usahaId],
  );
  const row = rowsOf(detail)[0] ?? {};
  const atributRes = await database.raw(
    `SELECT ${["usaha", ...ATRIBUT_COLUMNS, "diperbarui_oleh", "terverifikasi_oleh", "terverifikasi_pada", "date_updated"].join(", ")}
     FROM usaha_atribut_jabar WHERE usaha = ? LIMIT 1`,
    [usahaId],
  );
  const atributRow = rowsOf(atributRes)[0] ?? null;
  let verifikator = null;
  if (atributRow?.terverifikasi_oleh) {
    const vRes = await database.raw(
      `SELECT id, first_name, last_name, email FROM directus_users WHERE id = ? LIMIT 1`,
      [atributRow.terverifikasi_oleh],
    );
    const v = rowsOf(vRes)[0];
    if (v) {
      const nama = [v.first_name, v.last_name].filter(Boolean).join(" ").trim();
      verifikator = { id: v.id, nama: nama || v.email || String(v.id) };
    }
  }
  const hasilKonsultasi = await getHasilKonsultasi(database, usahaId);
  return {
    data: {
      id: usahaId,
      sidt: {
        nama: row.nama ?? null,
        nib: row.nib ?? null,
        kegiatanUtama: row.kegiatan_utama ?? null,
        produkUtama: row.produk_utama ?? null,
        kodeKbli: row.kode_kbli ?? null,
        skala: row.skala ?? null,
        omzetTahunan: row.omzet_tahunan == null ? null : Number(row.omzet_tahunan),
        totalAset: row.total_aset == null ? null : Number(row.total_aset),
        latitude: row.latitude == null ? null : Number(row.latitude),
        longitude: row.longitude == null ? null : Number(row.longitude),
        status: row.status ?? null,
      },
      wilayah: {
        kota: row.kota_nama ?? null,
        kecamatan: row.kecamatan_nama ?? null,
        kelurahan: row.kelurahan_nama ?? null,
        alamatJalan: row.alamat_jalan ?? null,
      },
      pemilik: { nama: row.pemilik_nama ?? null },
      atribut: toCamelAtribut(atributRow),
      hasilKonsultasi,
      verifikasi: {
        terverifikasiOleh: verifikator,
        terverifikasiPada: atributRow?.terverifikasi_pada
          ? new Date(atributRow.terverifikasi_pada).toISOString()
          : null,
      },
      diperbaruiPada: atributRow?.date_updated
        ? new Date(atributRow.date_updated).toISOString()
        : null,
    },
  };
}

function validateSidt(sidt = {}) {
  const fields = {};
  const clean = {};
  if (sidt.nama !== undefined) {
    const v = typeof sidt.nama === "string" ? sidt.nama.trim() : "";
    if (!v || v.length > 255) fields.nama = "Nama usaha 1–255 karakter";
    else clean.nama = v;
  }
  if (sidt.nib !== undefined) {
    if (sidt.nib === null || sidt.nib === "") clean.nib = null;
    else if (!/^\d{13}$/.test(String(sidt.nib))) fields.nib = "NIB harus 13 digit";
    else clean.nib = String(sidt.nib);
  }
  for (const key of ["kegiatanUtama", "produkUtama"]) {
    if (sidt[key] !== undefined) {
      if (sidt[key] === null || sidt[key] === "") clean[key] = null;
      else if (typeof sidt[key] !== "string" || sidt[key].length > 2000)
        fields[key] = "Maksimal 2000 karakter";
      else clean[key] = sidt[key];
    }
  }
  if (sidt.kodeKbli !== undefined) {
    if (sidt.kodeKbli === null || sidt.kodeKbli === "") clean.kodeKbli = null;
    else if (!/^\d{5}$/.test(String(sidt.kodeKbli))) fields.kodeKbli = "Kode KBLI harus 5 digit";
    else clean.kodeKbli = String(sidt.kodeKbli);
  }
  if (sidt.skala !== undefined) {
    if (!["micro", "small", "medium"].includes(sidt.skala)) fields.skala = "Skala tidak dikenal";
    else clean.skala = sidt.skala;
  }
  for (const key of ["omzetTahunan", "totalAset"]) {
    if (sidt[key] !== undefined) {
      if (sidt[key] === null || sidt[key] === "") clean[key] = null;
      else {
        const n = Number(sidt[key]);
        if (!Number.isInteger(n) || n < 0 || n > 9_000_000_000_000_000)
          fields[key] = "Nilai 0 sampai 9.000.000.000.000.000";
        else clean[key] = n;
      }
    }
  }
  const latUnset = sidt.latitude === undefined;
  const lngUnset = sidt.longitude === undefined;
  if (!latUnset || !lngUnset) {
    const lat = sidt.latitude === null || sidt.latitude === "" ? null : Number(sidt.latitude);
    const lng = sidt.longitude === null || sidt.longitude === "" ? null : Number(sidt.longitude);
    if ((lat === null) !== (lng === null)) {
      fields.latitude = "Latitude dan longitude harus diisi bersamaan";
      fields.longitude = "Latitude dan longitude harus diisi bersamaan";
    } else if (lat !== null && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
      fields.latitude = "Koordinat tidak valid";
    } else if (lat !== null && (lat < -8.0 || lat > -5.8 || lng < 106.3 || lng > 108.9)) {
      fields.latitude = "Koordinat di luar Jawa Barat";
      fields.longitude = "Koordinat di luar Jawa Barat";
    } else {
      clean.latitude = lat;
      clean.longitude = lng;
    }
  }
  return { fields, clean };
}

function validateAtribut(atribut = {}) {
  const fields = {};
  const clean = {};
  for (const [camel, col] of Object.entries(ATRIBUT_CAMEL)) {
    if (atribut[camel] !== undefined) {
      const v = atribut[camel];
      if (v !== null && typeof v !== "boolean") fields[camel] = "Nilai harus Ya/Tidak/Belum didata";
      else clean[col] = v;
    }
  }
  return { fields, clean };
}

const SIDT_COLUMN = {
  nama: "nama",
  nib: "nib",
  kegiatanUtama: "kegiatan_utama",
  produkUtama: "produk_utama",
  skala: "skala",
  omzetTahunan: "omzet_tahunan",
  totalAset: "total_aset",
  latitude: "latitude",
  longitude: "longitude",
};

async function updateUsahaLapangan(database, usahaId, body = {}, pemanggil) {
  await pastikanUsaha(database, pemanggil, usahaId);
  const sidt = body.sidt ?? {};
  const atribut = body.atribut ?? {};
  const s = validateSidt(sidt);
  const a = validateAtribut(atribut);
  const fields = { ...s.fields, ...a.fields };
  if (Object.keys(fields).length > 0) throw validationFailed(fields);

  let klasifikasiId = null;
  if (s.clean.kodeKbli) {
    const kRes = await database.raw(`SELECT id FROM klasifikasi_usaha WHERE kode = ? LIMIT 1`, [
      s.clean.kodeKbli,
    ]);
    const kRow = rowsOf(kRes)[0];
    if (!kRow) throw validationFailed({ kodeKbli: "Kode KBLI tidak ditemukan" });
    klasifikasiId = kRow.id;
  }

  const run = async (trx) => {
    const sidtKeys = Object.keys(s.clean).filter((k) => k !== "kodeKbli");
    if (sidtKeys.length > 0 || klasifikasiId !== null || s.clean.kodeKbli === null) {
      const sets = [];
      const params = [];
      for (const key of sidtKeys) {
        sets.push(`${SIDT_COLUMN[key]} = ?`);
        params.push(s.clean[key]);
      }
      if (klasifikasiId !== null) {
        sets.push(`klasifikasi = ?`);
        params.push(klasifikasiId);
      } else if (s.clean.kodeKbli === null) {
        sets.push(`klasifikasi = NULL`);
      }
      sets.push(`date_updated = NOW()`);
      params.push(usahaId);
      try {
        await trx.raw(`UPDATE usaha SET ${sets.join(", ")} WHERE id = ?`, params);
      } catch (error) {
        if (String(error?.code) === "23505") {
          throw new OperasionalError(409, "NIB_CONFLICT", "NIB sudah dipakai usaha lain.");
        }
        throw error;
      }
    }
    const atributCols = Object.keys(a.clean);
    if (atributCols.length > 0) {
      const cols = ["usaha", ...atributCols, "diperbarui_oleh"];
      const placeholders = cols.map(() => "?").join(", ");
      const updates = atributCols.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
      await trx.raw(
        `INSERT INTO usaha_atribut_jabar (${cols.join(", ")}) VALUES (${placeholders})
         ON CONFLICT (usaha) DO UPDATE SET ${updates},
           diperbarui_oleh = EXCLUDED.diperbarui_oleh,
           date_updated = NOW(),
           terverifikasi_oleh = NULL, terverifikasi_pada = NULL`,
        [usahaId, ...atributCols.map((c) => a.clean[c]), pemanggil?.id ?? null],
      );
    }
  };

  if (typeof database.transaction === "function") {
    await database.transaction(run);
  } else {
    await run(database);
  }
  return getUsahaLapangan(database, usahaId, pemanggil);
}

async function verifikasiUsaha(database, usahaId, pemanggil) {
  await pastikanUsaha(database, pemanggil, usahaId);
  const existing = await database.raw(`SELECT usaha FROM usaha_atribut_jabar WHERE usaha = ? LIMIT 1`, [
    usahaId,
  ]);
  if (!rowsOf(existing)[0]) {
    throw new OperasionalError(409, "ATRIBUT_BELUM_DIISI", "Isi atribut Jabar sebelum verifikasi.");
  }
  const run = async (trx) => {
    await trx.raw(
      `UPDATE usaha_atribut_jabar SET terverifikasi_oleh = ?, terverifikasi_pada = NOW(), date_updated = NOW() WHERE usaha = ?`,
      [pemanggil?.id ?? null, usahaId],
    );
  };
  if (typeof database.transaction === "function") {
    await database.transaction(run);
  } else {
    await run(database);
  }
  return getUsahaLapangan(database, usahaId, pemanggil);
}

module.exports = {
  ATRIBUT_COLUMNS,
  ATRIBUT_CAMEL,
  getUsahaLapangan,
  updateUsahaLapangan,
  verifikasiUsaha,
};

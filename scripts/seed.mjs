/**
 * Seed script — imports data from specs/data.xlsx into the database.
 *
 * Usage:
 *   npm install xlsx knex pg dotenv
 *   node scripts/seed.mjs
 *
 * Requires a .env file at the project root (see .env.example).
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import xlsx from 'xlsx';
import Knex from 'knex';

const __dirname = dirname(fileURLToPath(import.meta.url));

const knex = Knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cache = {};

async function upsert(table, where, extra = {}) {
  const key = `${table}:${JSON.stringify(where)}`;
  if (cache[key]) return cache[key];
  let row = await knex(table).where(where).first();
  if (!row) [row] = await knex(table).insert({ ...where, ...extra }).returning('*');
  cache[key] = row.id;
  return row.id;
}

async function upsertAddress(subDistrictId, streetAddress, rt, rw) {
  const [row] = await knex('addresses').insert({
    sub_district: subDistrictId,
    street_address: streetAddress ?? null,
    rt: rt ? String(rt) : null,
    rw: rw ? String(rw) : null,
  }).returning('*');
  return row.id;
}

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

function toBigInt(v) {
  if (!v) return null;
  const n = Number(String(v).replace(/[^0-9]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function mapGender(v) {
  if (!v) return 'male';
  const s = String(v).toLowerCase();
  return s.includes('perempuan') || s.includes('wanita') || s === 'f' ? 'female' : 'male';
}

function mapScale(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (s.includes('mikro')) return 'micro';
  if (s.includes('kecil')) return 'small';
  if (s.includes('menengah')) return 'medium';
  return null;
}

function mapLegalStatus(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (s.includes('cv')) return 'cv';
  if (s.includes('pt')) return 'pt';
  if (s.includes('firma')) return 'firm';
  if (s.includes('koperasi')) return 'cooperative';
  if (s.includes('perseorangan') || s.includes('perorangan')) return 'sole_proprietorship';
  return 'other';
}

function mapEducation(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (s.includes('s3') || s.includes('doktor')) return 'doctorate';
  if (s.includes('s2') || s.includes('magister')) return 'master';
  if (s.includes('s1') || s.includes('sarjana')) return 'bachelor';
  if (s.includes('d3') || s.includes('diploma')) return 'diploma';
  if (s.includes('sma') || s.includes('smk') || s.includes('sederajat')) return 'senior_high';
  if (s.includes('smp')) return 'junior_high';
  if (s.includes('sd')) return 'elementary';
  return 'none';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  const filePath = resolve(__dirname, '../specs/data.xlsx');
  const workbook = xlsx.read(readFileSync(filePath), { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  console.log(`Loaded ${rows.length} rows from data.xlsx`);

  for (const row of rows) {
    // ── Geographic hierarchy: entrepreneur home address ───────────────────────
    const entProvId = await upsert('provinces', { name: row['prov_pengusaha'] });
    const entCityId = await upsert('cities',    { name: row['kab_pengusaha'] }, { province: entProvId });
    const entDistId = await upsert('districts',  { name: row['kec_pengusaha'] }, { city: entCityId });
    const entSubId  = await upsert('sub_districts', { name: row['kel_pengusaha'] }, { district: entDistId });
    const entAddrId = await upsertAddress(entSubId, row['alamat_pengusaha'], row['rt_pengusaha'], row['rw_pengusaha']);

    // ── Geographic hierarchy: business address ────────────────────────────────
    const bizProvId = await upsert('provinces', { name: row['prov_usaha'] });
    const bizCityId = await upsert('cities',    { name: row['kab_usaha'] }, { province: bizProvId });
    const bizDistId = await upsert('districts',  { name: row['kec_usaha'] }, { city: bizCityId });
    const bizSubId  = await upsert('sub_districts', { name: row['kel_usaha'] }, { district: bizDistId });
    const bizAddrId = await upsertAddress(bizSubId, row['alamat_usaha'], row['rt_usaha'], row['rw_usaha']);

    // ── KBLI classification ───────────────────────────────────────────────────
    const kbliCode = row['kode_kbli'] ? String(row['kode_kbli']).trim() : null;
    const classificationId = kbliCode
      ? await upsert('business_classifications', { code: kbliCode }, { category: row['kategori_kbli'] ?? '' })
      : null;

    // ── Entrepreneur ──────────────────────────────────────────────────────────
    const nik = String(row['nik_pengusaha'] ?? '').trim();
    let entrepreneur = nik ? await knex('entrepreneurs').where('nik', nik).first() : null;

    if (!entrepreneur) {
      [entrepreneur] = await knex('entrepreneurs').insert({
        nik: nik || `GEN-${Date.now()}`,
        full_name: row['nama_pengusaha'] ?? '',
        gender: mapGender(row['jenis_kelamin']),
        is_disabled: Boolean(row['is_disabilitas']),
        birth_date: row['tanggal_lahir'] ?? null,
        education_level: mapEducation(row['pendidikan_formal']),
        phone: row['kontak_hp'] ? String(row['kontak_hp']) : null,
        address: entAddrId,
      }).returning('*');
    }

    // ── Business ──────────────────────────────────────────────────────────────
    const sourceId = row['id_data_badan_usaha'] ? String(row['id_data_badan_usaha']) : null;
    const nib = row['nib'] ? String(row['nib']).trim() : null;

    let business = null;
    if (sourceId) business = await knex('businesses').where('source_id', sourceId).first();
    if (!business && nib) business = await knex('businesses').where('nib', nib).first();

    if (!business) {
      [business] = await knex('businesses').insert({
        source_id: sourceId,
        entrepreneur: entrepreneur.id,
        nib,
        name: row['nama_usaha'] ?? '',
        main_activity: row['kegiatan_utama'] ?? null,
        main_product: row['produk_utama'] ?? null,
        classification: classificationId,
        legal_status: mapLegalStatus(row['status_badan_usaha']),
        scale: mapScale(row['skala_usaha']),
        founding_capital: toBigInt(row['modal_pendirian']),
        operation_start_month: row['bulan_mulai_operasi'] ? toInt(row['bulan_mulai_operasi']) : null,
        operation_start_year: row['tahun_mulai_operasi'] ? toInt(row['tahun_mulai_operasi']) : null,
        annual_revenue: toBigInt(row['omzet_tahunan']),
        total_assets: toBigInt(row['asset']),
        address: bizAddrId,
        latitude: row['alamat_latitude'] ? parseFloat(row['alamat_latitude']) : null,
        longitude: row['alamat_longitude'] ? parseFloat(row['alamat_longitude']) : null,
        photo: row['foto_usaha'] ?? null,
      }).returning('*');
    }

    // ── Workforce stats ───────────────────────────────────────────────────────
    const existingWf = await knex('workforce_stats').where('business', business.id).first();
    if (!existingWf) {
      await knex('workforce_stats').insert({
        business: business.id,
        paid_male:              toInt(row['tk_dibayar_laki']),
        paid_female:            toInt(row['tk_dibayar_perempuan']),
        paid_disabled_male:     toInt(row['tk_dibayar_disabil_laki']),
        paid_disabled_female:   toInt(row['tk_dibayar_disabil_perempuan']),
        unpaid_male:            toInt(row['tk_not_dibayar_laki']),
        unpaid_female:          toInt(row['tk_not_dibayar_perempuan']),
        unpaid_disabled_male:   toInt(row['tk_not_dibayar_disabil_laki']),
        unpaid_disabled_female: toInt(row['tk_not_dibayar_disabil_perempuan']),
      });
    }

    // ── Data sync log ─────────────────────────────────────────────────────────
    await knex('data_sync_logs').insert({
      business: business.id,
      pulled_at: row['pulled_at'] ? new Date(row['pulled_at']) : new Date(),
    });

    console.log(`  ✓ ${business.name}`);
  }

  console.log('Seed complete.');
  await knex.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

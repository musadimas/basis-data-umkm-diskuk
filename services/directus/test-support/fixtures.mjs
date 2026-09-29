import { randomUUID } from "node:crypto";
import contracts from "../analytics-shared/contracts.cjs";

/**
 * Builder data untuk tes Postgres ter-migrasi. Semua id memakai `randomUUID()` supaya tes dalam
 * satu file tidak saling bertabrakan; kolom mengikuti skema nyata di template
 * (lihat scripts/test-db-template.sh).
 */
export function uuid() {
  return randomUUID();
}

export async function buatProvinsi(db, { id = 32, nama = `PROVINSI ${id}`, kode = String(id) } = {}) {
  await db("provinsi").insert({ id, nama, kode }).onConflict("id").ignore();
  return { id, nama, kode };
}

export async function buatKota(db, { id, nama = `KABUPATEN ${id}`, provinsiId = 32 } = {}) {
  await buatProvinsi(db, { id: provinsiId });
  await db("kota").insert({ id, nama, provinsi: provinsiId }).onConflict("id").ignore();
  return { id, nama };
}

export async function buatPelaku(
  db,
  { id = uuid(), nik = String(Math.floor(1e15 + Math.random() * 8e15)), nama = "Pelaku Uji", jenisKelamin = "male" } = {},
) {
  await db("pelaku_usaha").insert({ id, nik, nama_lengkap: nama, jenis_kelamin: jenisKelamin });
  return { id, nik, nama };
}

/**
 * Usaha + baris `usaha_tabular`-nya. Sumber kota kanonik adalah `usaha_tabular.kota_id`
 * (K3 dokumen tinjauan), jadi keduanya selalu dibuat bersama.
 */
export async function buatUsaha(
  db,
  {
    id = uuid(),
    nama = "Usaha Uji",
    kotaId = null,
    kotaNama = null,
    nib = null,
    pelakuId = null,
    status = "active",
    produkUtama = null,
    kegiatanUtama = null,
  } = {},
) {
  const pelaku = pelakuId ?? (await buatPelaku(db)).id;
  const row = { id, pelaku_usaha: pelaku, nama, status };
  if (nib) row.nib = nib;
  await db("usaha").insert(row);
  await db("usaha_tabular").insert({
    id,
    nama,
    kota_id: kotaId,
    kota_nama: kotaNama,
    produk_utama: produkUtama,
    kegiatan_utama: kegiatanUtama,
  });
  return { id, nama, pelakuId: pelaku, kotaId };
}

export async function buatUser(
  db,
  { id = uuid(), appRole = "provinsi", kotaScope = null, usahaId = null, email = null } = {},
) {
  const address = email ?? `${id}@contoh.test`;
  await db("directus_users").insert({
    id,
    role: contracts.APPLICATION_ROLE_ID,
    email: address,
    app_role: appRole,
    kota_scope: kotaScope,
    usaha: usahaId,
  });
  return { id, appRole, kotaScope, usahaId, email: address };
}

export async function buatPeserta(
  db,
  {
    id = uuid(),
    usahaId,
    batch = "2026-1",
    pendampingId = null,
    targetMingguan = 4,
    tanggalMulai = "2026-01-05",
    fase = "akselerasi",
    status = "aktif",
  } = {},
) {
  await db("program_peserta").insert({
    id,
    usaha: usahaId,
    batch,
    pendamping: pendampingId,
    target_mingguan: targetMingguan,
    tanggal_mulai: tanggalMulai,
    fase,
    status,
  });
  return { id, usahaId, batch, pendampingId };
}

export async function buatProduk(db, { id = uuid(), usahaId, nama = "Produk Uji", statusKurasi = "menunggu" } = {}) {
  await db("produk").insert({ id, usaha: usahaId, nama, status_kurasi: statusKurasi });
  return { id, usahaId, nama, statusKurasi };
}

export async function buatFile(
  db,
  { id = uuid(), folder = null, uploadedBy = null, type = "image/png", filesize = 1024, filename = "berkas.png" } = {},
) {
  await db("directus_files").insert({
    id,
    storage: "local",
    folder,
    uploaded_by: uploadedBy,
    type,
    filesize,
    filename_download: filename,
  });
  return { id, folder, uploadedBy, type, filesize };
}

export async function pasangFoto(db, { produkId, fileId, sort = 1 }) {
  await db("produk_foto").insert({ produk_id: produkId, directus_files_id: fileId, sort });
}

export async function buatLegalitas(
  db,
  { id = uuid(), usahaId, jenis = "halal", nomor = null, status = "terbit", berlakuHingga = null, berkas = null } = {},
) {
  await db("usaha_legalitas").insert({
    id,
    usaha: usahaId,
    jenis,
    nomor,
    status,
    berlaku_hingga: berlakuHingga,
    berkas,
  });
  return { id, usahaId, jenis, status, berlakuHingga };
}

/** Poli pertama yang disemai migrasi (tiket butuh FK poli). */
export async function poliTersedia(db) {
  const row = await db("konsultasi_poli").select("id").orderBy("sort").first();
  return row?.id ?? null;
}

export async function buatKegiatan(
  db,
  {
    id = uuid(),
    judul = "Kegiatan Uji",
    tanggalMulai,
    tanggalSelesai = null,
    statusPublikasi = "terbit",
    metode = null,
    lokasi = null,
    link = null,
    kotaNama = null,
  } = {},
) {
  const row = {
    id,
    judul,
    tanggal_mulai: tanggalMulai,
    tanggal_selesai: tanggalSelesai ?? tanggalMulai,
    status_publikasi: statusPublikasi,
  };
  if (metode !== null) row.metode = metode;
  if (lokasi !== null) row.lokasi = lokasi;
  if (link !== null) row.link = link;
  if (kotaNama !== null) row.kota_nama = kotaNama;
  await db("kegiatan").insert(row);
  return { id, judul, tanggalMulai };
}

export async function buatPengingat(
  db,
  {
    id = uuid(),
    kegiatanId,
    kanal = "email",
    tujuan = `uji-${randomUUID().slice(0, 8)}@contoh.test`,
    tujuanMasked = null,
    jadwalKirim = new Date(),
    status = "menunggu",
    alasan = null,
  } = {},
) {
  await db("kegiatan_pengingat").insert({
    id,
    kegiatan: kegiatanId,
    kanal,
    tujuan,
    tujuan_masked: tujuanMasked ?? tujuan,
    jadwal_kirim: jadwalKirim,
    status,
    alasan,
  });
  return { id, kanal, tujuan, status };
}

export async function buatTiket(
  db,
  {
    id = uuid(),
    nomor = `UJI-${randomUUID().slice(0, 8)}`,
    usahaId = null,
    pemohonId = null,
    pendampingId = null,
    poliId,
    namaUsaha = "Usaha Uji",
    namaKontak = "Kontak Uji",
    whatsapp = "6281200000001",
    jadwalTanggal = "2026-12-01",
    jadwalSlot = `${String(9 + Math.floor(Math.random() * 8)).padStart(2, "0")}:00`,
    status = "masuk",
    consent = false,
  } = {},
) {
  const poli = poliId ?? (await poliTersedia(db));
  if (!poli) throw new Error("tidak ada baris konsultasi_poli; migrasi harus menyemainya");
  await db("konsultasi_tiket").insert({
    id,
    nomor,
    usaha: usahaId,
    pemohon: pemohonId,
    pendamping: pendampingId,
    poli,
    nama_usaha: namaUsaha,
    nama_kontak: namaKontak,
    whatsapp,
    deskripsi: "Tiket uji harness Postgres.",
    moda: "daring",
    jadwal_tanggal: jadwalTanggal,
    jadwal_slot: jadwalSlot,
    status,
    wa_consent: consent,
  });
  return { id, nomor, usahaId, poliId: poli, status };
}

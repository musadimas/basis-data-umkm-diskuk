import { AnalyticsApiError } from "./errors.js";
import { baseMeta } from "./meta.js";
import privacy from "../../../../../analytics-shared/privacy.cjs";
const { MASKING_VERSION, safeScalar, sanitizeExtraFields, } = privacy;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function display(value, fallback = "Belum tersedia") {
  return value === null || value === undefined || value === ""
    ? fallback
    : String(value);
}
function field(
  fieldId,
  label,
  value,
  qualityStatus = "reported",
  dataType = "text",
) {
  return {
    fieldId,
    label,
    value: value ?? null,
    displayValue: display(value),
    qualityStatus,
    dataType,
  };
}
function profileSections(row) {
  return [
    {
      id: "ringkasan",
      label: "Ringkasan",
      fields: [
        field("status", "Status", row.status),
        field("skala_usaha", "Skala usaha", row.skala),
        field("kbli_kode", "Kode KBLI", row.kode_kbli),
        field("kategori_kbli", "Kategori KBLI", row.kategori_kbli),
      ],
    },
    {
      id: "usaha",
      label: "Usaha",
      fields: [
        field("kegiatan_utama", "Kegiatan utama", row.kegiatan_utama),
        field("produk_utama", "Produk utama", row.produk_utama),
        field("status_hukum", "Status hukum", row.status_hukum),
      ],
    },
    {
      id: "lokasi_usaha",
      label: "Lokasi Usaha",
      fields: [
        field("alamat_usaha", "Alamat usaha", row.business_address),
        field("latitude", "Lintang", row.latitude, "reported", "number"),
        field("longitude", "Bujur", row.longitude, "reported", "number"),
      ],
    },
    {
      id: "tenaga_kerja",
      label: "Tenaga Kerja",
      fields: [
        field(
          "tenaga_kerja_status",
          "Status data tenaga kerja",
          null,
          "missing",
        ),
      ],
    },
    {
      id: "pelaku_usaha",
      label: "Pelaku Usaha",
      fields: [
        field("owner_name", "Nama pelaku usaha", row.owner_name),
        field("masked_nik", "NIK", row.masked_nik),
        field("masked_phone", "Telepon", row.masked_phone),
        field("age_band", "Kelompok usia", row.age_band),
      ],
    },
    {
      id: "kualitas_asal_data",
      label: "Kualitas dan Asal Data",
      fields: [
        field("source_updated_at", "Pembaruan sumber", row.source_updated_at),
        field("omzet_quality", "Kualitas omzet", row.omzet_quality),
        field("aset_quality", "Kualitas aset", row.aset_quality),
        field("masking_version", "Versi masking", MASKING_VERSION),
      ],
    },
    {
      id: "informasi_tambahan",
      label: "Informasi Tambahan",
      fields: Object.entries(sanitizeExtraFields(row.extra_fields)).map(
        ([key, value]) => field(`extra_${key}`, key, safeScalar(value)),
      ),
    },
  ];
}
async function getProfile(database, id, operator = null) {
  if (!UUID.test(String(id || "")))
    throw new AnalyticsApiError(404, "PROFILE_NOT_FOUND");
  const result = await database.raw(
    `SELECT c.usaha_id,c.kota_id,c.status,c.nama,c.kota_nama,kegiatan_utama,produk_utama,status_hukum,skala,kode_kbli,kategori_kbli,business_address,latitude,longitude,omzet_quality,aset_quality,masked_nik,masked_phone,owner_name,age_band,source_updated_at,extra_fields,g.data_as_of FROM analitik_usaha_current c JOIN analitik_active_generation p ON p.id=1 AND p.active_generation_id=c.generation_id JOIN analitik_generation g ON g.id=c.generation_id WHERE c.usaha_id=? LIMIT 1`,
    [id],
  );
  const row = (result.rows ?? result[0] ?? [])[0];
  if (!row) throw new AnalyticsApiError(404, "PROFILE_NOT_FOUND");
  if (operator?.role === "kabkota" && operator?.kotaId != null && Number(row.kota_id) !== Number(operator.kotaId)) {
    throw new AnalyticsApiError(404, "PROFILE_NOT_FOUND");
  }
  const sections = profileSections(row);
  // Y02: edit in-app via /dashboard/data-lapangan untuk provinsi + kabkota
  // (scoping kota tetap dari Y01 di atas). Archive tetap keputusan Y01.
  const canEdit = ["provinsi", "kabkota"].includes(operator?.role);
  const isProvinsi = operator?.role === "provinsi";
  return {
    meta: baseMeta({
      status: "current",
      dataAsOf: row.data_as_of,
      population: 1,
      matched: 1,
      coverage: { matched: 1, total: 1 },
      warnings: [],
    }),
    data: {
      id: row.usaha_id,
      title: display(row.nama),
      badges: [row.status === "archived" ? "Diarsipkan" : "Aktif"].filter(
        Boolean,
      ),
      hero: {
        name: display(row.nama),
        location: display(row.kota_nama || row.business_address),
        image: null,
      },
      sections,
      actions: {
        canEdit,
        canArchive: isProvinsi && row.status === "active",
        canRestore: isProvinsi && row.status === "archived",
        editPath: `/dashboard/data-lapangan/${row.usaha_id}`,
      },
      maskingVersion: MASKING_VERSION,
    },
  };
}
export { getProfile, profileSections, UUID };

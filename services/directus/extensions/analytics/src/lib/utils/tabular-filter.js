// Builds the shared WHERE clause for the tabular snapshot filters (infographic + tabular endpoints).

const VALID_SKALA = ["micro", "small", "medium"];

export class TabularQueryError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    // Directus hanya merender status error bernama "DirectusError"; nama lain diratakan
    // menjadi 500 (Y05: q < 3 karakter seharusnya 400 Q_TOO_SHORT). Bentuk sama dengan CakupanError.
    this.name = "DirectusError";
    this.statusCode = statusCode;
    this.status = statusCode;
    this.code = code;
    this.extensions = { code, status: statusCode };
  }
}

export const positiveInt = (value, fallback = null) => {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

const stringParam = (value, maxLength = 255) =>
  typeof value === "string" && value.length > 0 ? value.slice(0, maxLength) : null;

export const escapeLike = (str) =>
  String(str).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

export const searchClause = (rawQ) => {
  if (rawQ === null || rawQ === undefined) return null;
  const q = String(rawQ).trim().slice(0, 100);
  if (!q) return null;

  // Exact NIK (16 digits)
  if (/^\d{16}$/.test(q)) {
    return {
      sql: "t.id IN (SELECT u.id FROM usaha u JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha WHERE pu.nik = ?)",
      params: [q],
    };
  }

  // Exact NIB (13 digits)
  if (/^\d{13}$/.test(q)) {
    return {
      sql: "t.id IN (SELECT id FROM usaha WHERE nib = ?)",
      params: [q],
    };
  }

  // Exact KBLI (5 digits)
  if (/^\d{5}$/.test(q)) {
    const pattern = `%${escapeLike(q)}%`;
    return {
      // Backslash adalah escape bawaan LIKE di PostgreSQL; klausa ESCAPE eksplisit di sini
      // menghasilkan dua karakter dan ditolak Postgres (B13).
      sql: "(t.kode_kbli = ? OR t.nama ILIKE ?)",
      params: [q, pattern],
    };
  }

  // Minimum length check
  if (q.length < 3) {
    throw new TabularQueryError(400, "Q_TOO_SHORT", "Kata kunci minimal 3 karakter");
  }

  // General search across business name, owner name, primary product, and business activity
  const pattern = `%${escapeLike(q)}%`;
  return {
    // Arm pemilik memakai `= ANY(ARRAY(...))`, bukan `IN (subquery)`: bentuk subquery membuat
    // seluruh OR tidak bisa memakai BitmapOr sehingga planner jatuh ke seq scan (B13).
    sql: "(t.nama ILIKE ? OR t.produk_utama ILIKE ? OR t.kegiatan_utama ILIKE ? OR t.id = ANY(ARRAY(SELECT u.id FROM usaha u JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha WHERE pu.nama_lengkap ILIKE ?)))",
    params: [pattern, pattern, pattern, pattern],
  };
};

export const buildTabularFilter = (query = {}) => {
  const clauses = [];
  const params = [];
  const push = (column, value) => {
    if (value === null) return;
    params.push(value);
    clauses.push(`${column} = ?`);
  };

  push("t.kota_id", positiveInt(query.kota));
  push("t.kecamatan_id", positiveInt(query.kecamatan));
  push("t.kelurahan_id", positiveInt(query.kelurahan));
  push("t.skala", VALID_SKALA.includes(query.skala) ? query.skala : null);
  push("t.kategori_kbli", stringParam(query.kegiatan));
  push("t.kode_kbli", stringParam(query.kbli));

  if (query.q) {
    const search = searchClause(query.q);
    if (search) {
      clauses.push(search.sql);
      params.push(...search.params);
    }
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
    hasFilters: clauses.length > 0,
  };
};

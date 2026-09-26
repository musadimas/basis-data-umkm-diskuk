// Builds the shared WHERE clause for the tabular snapshot filters (infographic + tabular endpoints).

const VALID_SKALA = ["micro", "small", "medium"];

export const positiveInt = (value, fallback = null) => {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

const stringParam = (value, maxLength = 255) =>
  typeof value === "string" && value.length > 0 ? value.slice(0, maxLength) : null;

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

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
    hasFilters: clauses.length > 0,
  };
};

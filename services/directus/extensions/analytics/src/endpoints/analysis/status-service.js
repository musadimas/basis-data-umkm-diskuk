async function getStatus(database) {
  const result = await database.raw(
    `SELECT g.id,g.status,g.data_as_of,g.reconciled_at FROM analitik_active_generation p LEFT JOIN analitik_generation g ON g.id=p.active_generation_id WHERE p.id=1`,
  );
  const row = (result.rows ?? result[0] ?? [])[0];
  if (!row?.id)
    return {
      status: "processing",
      dataAsOf: null,
      message: "Data sedang disiapkan. Silakan coba lagi.",
    };
  const stale = row.status !== "active" || !row.reconciled_at;
  return {
    status: stale ? "stale_last_good" : "current",
    dataAsOf: row.data_as_of,
    message: stale
      ? "Data terakhir yang berhasil diproses sedang ditampilkan."
      : "Data terbaru berhasil diproses.",
  };
}
export { getStatus };

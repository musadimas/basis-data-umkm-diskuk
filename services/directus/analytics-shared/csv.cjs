/**
 * Satu-satunya definisi sel CSV untuk router, worker, dan ekspor Tabular.
 *
 * Sel yang dimulai `=`, `+`, `-`, atau `@` diawali `'` supaya spreadsheet tidak
 * mengeksekusinya sebagai formula (CSV injection), lalu di-quote bila perlu
 * (RFC 4180). Dipakai `exporter.js` (worker) dan endpoint Tabular.
 */
function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function csvRow(values) {
  return values.map(csvCell).join(",") + "\r\n";
}

module.exports = { csvCell, csvRow };

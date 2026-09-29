import contracts from "../../../../../analytics-shared/contracts.cjs";
import sharedCompiler from "../../../../../analytics-shared/query-compiler.cjs";
import { AnalyticsApiError } from "./errors.js";
const { EXPRESSION_KEYS } = contracts;
// Kandidat 03 langkah 1 (dimensi) + 2e (metrik): definisi tunggal di
// analytics-shared/query-compiler.cjs. METRIC adalah alias agar pemakaian
// internal tidak berubah.
const DIMENSIONS = sharedCompiler.DIMENSIONS;
const METRIC = sharedCompiler.METRICS;
// Kandidat 03 langkah 3f: adapter tipis di atas inti shared. Error netral
// `{ status, code }` dari shared dipetakan ke `AnalyticsApiError` tanpa
// mengubah status/kode; definisi + logika scope + budget hidup di shared.
function petakanError(error) {
  if (error instanceof AnalyticsApiError) throw error;
  if (error && typeof error.status === "number" && typeof error.code === "string")
    throw new AnalyticsApiError(error.status, error.code, error.message);
  throw error;
}
// `operator` wajib (fail-closed di shared): kabkota di-scope oleh compiler.
function compileQuery(request, registry, operator) {
  try {
    return sharedCompiler.compileAggregate(request, { registry, operator });
  } catch (error) {
    petakanError(error);
  }
}
function compileFiltersOnly(request, registry, operator) {
  try {
    return sharedCompiler.compileFilters(request, { registry, operator });
  } catch (error) {
    petakanError(error);
  }
}
export { DIMENSIONS, METRIC, compileQuery, compileFiltersOnly, EXPRESSION_KEYS };

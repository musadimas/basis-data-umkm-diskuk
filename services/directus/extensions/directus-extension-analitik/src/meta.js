const { SCHEMA_VERSION, MASKING_VERSION } = require("../../../analytics-shared/contracts.cjs");
function utc(value) { const date = value ? new Date(value) : new Date(); return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(); }
function baseMeta({ dataAsOf = null, status = "current", population = 0, matched = 0, coverage = {}, warnings = [] } = {}) { return { schemaVersion: SCHEMA_VERSION, dataAsOf: dataAsOf ? utc(dataAsOf) : null, generatedAt: utc(), status, source: "Current state UMKM aktif Jawa Barat", population: Number(population), matched: Number(matched), coverage, warnings, maskingVersion: MASKING_VERSION }; }
function correlation(req) { return req.headers?.["x-request-id"] || require("node:crypto").randomUUID(); }
module.exports = { utc, baseMeta, correlation };

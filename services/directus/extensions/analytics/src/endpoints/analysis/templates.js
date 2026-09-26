import contracts from "../../../../../analytics-shared/contracts.cjs";
const { SCHEMA_VERSION } = contracts;
const templates = [{ id: "current-city-distribution", version: 1, label: "Sebaran UMKM Saat Ini", description: "Jumlah UMKM menurut kabupaten/kota pada snapshot saat ini.", config: { schemaVersion: SCHEMA_VERSION, metric: "jumlah_umkm", groupBy: "kota_nama", visual: "bar", filters: [] } }, { id: "reported-scale", version: 1, label: "Skala yang dilaporkan", description: "Komposisi skala usaha sebagaimana dilaporkan sumber.", config: { schemaVersion: SCHEMA_VERSION, metric: "jumlah_umkm", groupBy: "skala_dilaporkan", visual: "donut", filters: [] } }];
function listTemplates() { return templates.map((template) => ({ ...template, workforce: { enabled: false }, financial: { enabled: false } })); }
export { templates, listTemplates };

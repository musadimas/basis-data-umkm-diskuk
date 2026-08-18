const SECRET = /(password|secret|token|cookie|authorization|signed.?url|nik|telepon|phone|birth)/i;
const PII_VALUE = /\b\d{16}\b|(?:\+62|08)\d{8,13}/;
export function sanitize(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return SECRET.test(value) || PII_VALUE.test(value) ? "[REDACTED]" : value.slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitize);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET.test(key) && !["body","stack","query","values","request"].includes(key)).map(([key, child]) => [key, sanitize(child)]));
  return value;
}
export function createLogger(service = "analytics-worker", write = console.log) {
  return { log(level, event, fields = {}) { write(JSON.stringify(sanitize({ timestamp: new Date().toISOString(), level, service, event, ...fields }))); }, info(event, fields) { this.log("info", event, fields); }, warn(event, fields) { this.log("warn", event, fields); }, error(event, fields) { this.log("error", event, fields); } };
}

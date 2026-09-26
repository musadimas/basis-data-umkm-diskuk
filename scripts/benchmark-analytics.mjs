import { performance } from "node:perf_hooks"
import { writeFile } from "node:fs/promises"

const base = (process.env.ANALYTICS_BASE_URL || "").replace(/\/$/, "")
const cookie = process.env.ANALYTICS_SESSION_COOKIE || ""
const outputIndex = process.argv.indexOf("--output")
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] || "/tmp/analytics-benchmark.json" : "/tmp/analytics-benchmark.json"
if (!base || !cookie) throw new Error("ANALYTICS_BASE_URL and ANALYTICS_SESSION_COOKIE are required")
const iterations = Math.max(1, Math.min(100, Number.parseInt(process.env.ANALYTICS_BENCHMARK_ITERATIONS || "10", 10) || 10))
const concurrency = Math.max(1, Math.min(16, Number.parseInt(process.env.ANALYTICS_BENCHMARK_CONCURRENCY || "4", 10) || 4))
const profileId = process.env.ANALYTICS_PROFILE_ID || ""
const defaultConfig = { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "kota_nama", filters: [], visual: "bar", includeOthers: true, shareOfFilteredTotal: true }
const jobs = [
  ...Array.from({ length: iterations }, () => ({ kind: "common", path: "/panel/v1/analytics/analysis/query", method: "POST", body: defaultConfig })),
  ...Array.from({ length: Math.max(1, Math.ceil(iterations / 2)) }, () => ({ kind: "records", path: "/panel/v1/analytics/analysis/records", method: "POST", body: { schemaVersion: 1, filters: [], pageSize: 20 } })),
]
if (profileId) jobs.push(...Array.from({ length: Math.max(1, Math.ceil(iterations / 2)) }, () => ({ kind: "profile", path: `/panel/v1/analytics/analysis/umkm/${encodeURIComponent(profileId)}` })))
const results = []
let cursor = 0
async function runOne(job) {
  const started = performance.now()
  let timeout = false
  let error = false
  let freshness = null
  try {
    const response = await fetch(base + job.path, { method: job.method || "GET", headers: { cookie, "content-type": "application/json" }, body: job.body ? JSON.stringify(job.body) : undefined, signal: AbortSignal.timeout(10_000) })
    if (!response.ok) error = true
    const payload = await response.json().catch(() => null)
    const dataAsOf = payload?.data?.meta?.dataAsOf
    if (dataAsOf) freshness = Math.max(0, Math.round((Date.now() - Date.parse(dataAsOf)) / 1000))
  } catch (cause) {
    error = true
    timeout = cause?.name === "TimeoutError" || cause?.name === "AbortError"
  }
  results.push({ kind: job.kind, durationMs: performance.now() - started, error, timeout, freshness })
}
async function worker() { while (cursor < jobs.length) { const job = jobs[cursor++]; await runOne(job) } }
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker))
function percentile(values, p) { const sorted = [...values].sort((a, b) => a - b); return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0) }
function summarize(kind) {
  const values = results.filter((item) => item.kind === kind)
  const durations = values.map((item) => item.durationMs)
  const fresh = values.map((item) => item.freshness).filter((item) => item !== null)
  return { requestCount: values.length, p50Ms: percentile(durations, .5), p95Ms: percentile(durations, .95), p99Ms: percentile(durations, .99), errorRate: values.length ? values.filter((item) => item.error).length / values.length : 0, timeouts: values.filter((item) => item.timeout).length, freshnessSeconds: fresh.length ? Math.max(...fresh) : null }
}
const common = summarize("common")
const profile = summarize("profile")
const summary = { requestCount: results.length, common, profile, records: summarize("records"), errorRate: results.length ? results.filter((item) => item.error).length / results.length : 1, timeouts: results.filter((item) => item.timeout).length, freshnessSeconds: results.map((item) => item.freshness).filter((item) => item !== null).sort((a, b) => b - a)[0] ?? null }
await writeFile(output, JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary))
if (common.p95Ms > 3000 || (profile.requestCount && profile.p95Ms > 5000) || summary.errorRate > .01 || summary.timeouts) process.exitCode = 1

const base = (process.env.ANALYTICS_BASE_URL || "").replace(/\/$/, "")
if (!base) throw new Error("ANALYTICS_BASE_URL is required")
const cookie = process.env.ANALYTICS_SESSION_COOKIE || ""
if (!cookie) throw new Error("ANALYTICS_SESSION_COOKIE is required")
const wrong = process.env.ANALYTICS_WRONG_ROLE_COOKIE || ""
const docsPath = process.env.ANALYTICS_DOCS_PATH || "/panel/v1/docs"
const privatePaths = ["/panel/infografis/", "/panel/tabular/status", "/panel/analitik/status", "/panel/analitik/metadata", docsPath, `${docsPath}/oas`]
async function probe(path, headers = {}) {
  try {
    const response = await fetch(base + path, { redirect: "manual", headers, signal: AbortSignal.timeout(10_000) })
    return { status: response.status, location: Boolean(response.headers.get("location")), cache: response.headers.get("cache-control") }
  } catch (error) { return { status: 0, error: error?.name || "request_failed" } }
}
const anonymousPage = await probe("/dashboard")
const anonymous = Object.fromEntries(await Promise.all(privatePaths.map(async (path) => [path, await probe(path)])))
const authenticated = Object.fromEntries(await Promise.all(privatePaths.map(async (path) => [path, await probe(path, { cookie })])))
const wrongRole = wrong ? Object.fromEntries(await Promise.all(privatePaths.map(async (path) => [path, await probe(path, { cookie: wrong })]))) : null
const summary = {
  anonymousPage: { status: anonymousPage.status, redirect: anonymousPage.location },
  anonymous,
  authenticated: Object.fromEntries(Object.entries(authenticated).map(([path, value]) => [path, { status: value.status, privateCache: value.cache || null }])),
  wrongRole: wrongRole ? Object.fromEntries(Object.entries(wrongRole).map(([path, value]) => [path, { status: value.status }])) : null,
  ports: process.env.ANALYTICS_PUBLIC_PORTS ? "provided" : "not_checked",
}
console.log(JSON.stringify(summary))
let failed = ![301, 302, 303, 307, 308].includes(anonymousPage.status)
for (const value of Object.values(anonymous)) if (![401, 403].includes(value.status)) failed = true
for (const value of Object.values(authenticated)) if (![200, 202, 204].includes(value.status)) failed = true
if (wrongRole) for (const value of Object.values(wrongRole)) if (value.status !== 403) failed = true
if (Object.values(authenticated).some((value) => value.status === 200 && !String(value.cache || "").includes("no-store"))) failed = true
if (failed) process.exitCode = 1

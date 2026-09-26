const test = require("node:test");
const assert = require("node:assert/strict");

const BASE_URL = process.env.ANALYTICS_INTEGRATION_BASE_URL;
const EMAIL = process.env.ANALYTICS_INTEGRATION_EMAIL;
const PASSWORD = process.env.ANALYTICS_INTEGRATION_PASSWORD;

const SKIP_REASON =
  "Opt-in integration: set ANALYTICS_INTEGRATION_BASE_URL (plus ANALYTICS_INTEGRATION_EMAIL/ANALYTICS_INTEGRATION_PASSWORD) to a disposable Directus stack. Suite never defaults to a production target.";

const UNKNOWN_EXPORT_ID = "00000000-0000-4000-8000-000000000000";

async function api(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let response;
  const options = { method, headers };
  if (payload !== undefined) options.body = payload;
  try {
    response = await fetch(`${BASE_URL}${path}`, options);
  } catch (error) {
    throw new Error(
      `integration target ${BASE_URL} is unreachable: ${error?.cause?.code || error?.message}`,
    );
  }
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, body: json };
}

function errorCode(body) {
  return body?.errors?.[0]?.extensions?.code || null;
}

async function login() {
  assert.ok(
    EMAIL && PASSWORD,
    "authenticated integration requires ANALYTICS_INTEGRATION_EMAIL and ANALYTICS_INTEGRATION_PASSWORD on the disposable stack",
  );
  const res = await api("/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  assert.equal(res.status, 200, `login failed: ${JSON.stringify(res.body)}`);
  const token = res.body?.data?.access_token;
  assert.ok(token, "login response must contain data.access_token");
  return token;
}

if (!BASE_URL) {
  test("analitik endpoint integration", { skip: SKIP_REASON }, () => {});
} else {
  test("integration target answers and rejects anonymous access with 401", async () => {
    const query = await api("/analitik/query", {
      method: "POST",
      body: { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "kota_nama" },
    });
    assert.equal(query.status, 401);
    assert.equal(errorCode(query.body), "AUTHENTICATION_REQUIRED");
    const status = await api("/analitik/status");
    assert.equal(status.status, 401);
  });

  test("authenticated session reads metadata, templates and generation status", async () => {
    const token = await login();
    const metadata = await api("/analitik/metadata", { token });
    assert.equal(metadata.status, 200);
    assert.equal(typeof metadata.body?.schemaVersion, "number");

    const templates = await api("/analitik/templates", { token });
    assert.equal(templates.status, 200);
    assert.ok(Array.isArray(templates.body?.templates));
    assert.ok(templates.body.templates.length > 0);

    const status = await api("/analitik/status", { token });
    assert.equal(status.status, 200);
    assert.ok(
      ["current", "processing", "stale_last_good"].includes(status.body?.status),
      `status must be a user-facing generation status, got ${status.body?.status}`,
    );
  });

  test("query applies filters so a zero-match filter yields zero total", async () => {
    const token = await login();
    const config = { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "kota_nama" };
    const unfiltered = await api("/analitik/query", {
      method: "POST",
      token,
      body: { ...config, filters: [] },
    });
    assert.equal(unfiltered.status, 200);
    assert.equal(typeof unfiltered.body?.data?.total, "number");
    assert.ok(unfiltered.body?.meta?.coverage, "response must carry coverage meta");
    assert.equal(typeof unfiltered.body?.data?.conservedTotal, "boolean");

    const zeroMatch = await api("/analitik/query", {
      method: "POST",
      token,
      body: {
        ...config,
        filters: [
          { field: "kota_nama", operator: "eq", value: "__integration_no_match__" },
        ],
      },
    });
    assert.equal(zeroMatch.status, 200);
    assert.equal(zeroMatch.body?.data?.total, 0, "filter must exclude every row");
  });

  test("records paging walks the cursor without repeating rows", async () => {
    const token = await login();
    const first = await api("/analitik/records", {
      method: "POST",
      token,
      body: { pageSize: 2, sort: "nama", filters: [] },
    });
    assert.equal(first.status, 200);
    const records = first.body?.data?.records;
    assert.ok(Array.isArray(records));
    assert.ok(records.length <= 2);
    const cursor = first.body?.data?.nextCursor;
    if (!cursor) return; // stack holds fewer records than one page; nothing to walk
    const second = await api("/analitik/records", {
      method: "POST",
      token,
      body: { pageSize: 2, sort: "nama", filters: [], cursor },
    });
    assert.equal(second.status, 200);
    const firstIds = new Set(records.map((row) => row.id));
    const secondIds = second.body?.data?.records || [];
    for (const row of secondIds)
      assert.ok(
        !firstIds.has(row.id),
        "keyset cursor must not replay rows from the previous page",
      );
  });

  test("export status requires auth and unknown job returns 404 for its owner", async () => {
    const anonymous = await api(`/analitik/exports/${UNKNOWN_EXPORT_ID}`);
    assert.equal(anonymous.status, 401);
    assert.equal(errorCode(anonymous.body), "AUTHENTICATION_REQUIRED");

    const token = await login();
    const missing = await api(`/analitik/exports/${UNKNOWN_EXPORT_ID}`, { token });
    assert.equal(missing.status, 404);
    assert.equal(errorCode(missing.body), "EXPORT_NOT_FOUND");
  });
}

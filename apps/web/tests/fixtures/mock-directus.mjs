import { expect } from "@playwright/test";
import { createChallenge, pbkdf2 } from "altcha/lib";
import { createKegiatanState, kegiatanApiResponse } from "./kegiatan-data.mjs";
import { createRegistrasiState, fasilitasiApiResponse, registrasiApiResponse } from "./registrasi-data.mjs";
import { infographicMapResponse, infographicResponse, tabularOptionsResponse } from "./analytics-data.mjs";
import { APPLICATION_ROLE_ID, OPERATOR_FIXTURES, mockUserMe, roleFromCookieHeader } from "./operator-fixtures.mjs";

export { OPERATOR_FIXTURES, mockUserMe };

const SPATIAL_TILE_ARCHIVE = Buffer.from(
  "UE1UaWxlcwN/AAAAAAAAABkAAAAAAAAAmAAAAAAAAAClAQAAAAAAAD0CAAAAAAAAAAAAAAAAAAA9AgAAAAAAAFoAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQICAQMDAHUiQMAk4/sAdSJAwCTj+wMAdSJAwCTj+x+LCAAAAAAAABNjdGaMYgQAAcZyRAUAAAAfiwgAAAAAAAATtZLPTsMwDMbve4opFy79tw06bRInXgAJbghVWeOO0CauUreiTHt34naMDTjsAOsl/mJ//sXzbiKsNCDWUxF30sUFVgpcEy8p7vr3lyztX1NjVyqbF9dlmqySm5fE/7Y2foyxBpujghgthDVqS1FtSFfQiGAiCnRGEhvXm4IF6uuhD3bgKtmzpKDJna5Jo/0HAt+nOTjPOd6CBScJHSuk6xpyaRGm3TxarqLkLCXDgar5lhri9A8hp1dh6CcB7rY1pbni0GirTWvCd0Rzuxgl+XYmhaEfbQ6MKy1pA04rLW0m1WvbEKhsg61VA/ksWUYpgyRBmEar8fSbOI4r54cPQFz9tBNaibVgNhGc/1fCCx6VkcR64c/y7XguNFTc/lD+QE7brc/3eyZP46aU1Ymw3z/zkvBcSBID7MTAcuef4/doFohPtKfDzRdcfszZAhog1/u7e561v5TkO2xagoPT4kQa3Y6hr/LQp37j1ormk7qTVTtUiZl43gfntcMTL6t+1KTLnw7jUC6zMLp06C34m+wnHw16bxrLAwAAH4sIAAAAAAAAE5Nyq2DiYinNzc7VaFCQYspMkWLJS8xNlGItzk7MSVRi5mI0VGLnYg3JLMnMBjFyM7OL8oUEJRiF2BgYGBmZmJRYOVsk33ACANNfA/1IAAAA",
  "base64",
);

async function installSpatialTileArchive(page) {
  await page.route("**/tiles/*.pmtiles", async (route) => {
    const range = route.request().headers().range;
    const match = range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = match ? Number(match[1]) : 0;
    const requestedEnd = match?.[2] ? Number(match[2]) : SPATIAL_TILE_ARCHIVE.length - 1;
    if (!Number.isSafeInteger(start) || start >= SPATIAL_TILE_ARCHIVE.length) {
      await route.fulfill({
        status: 416,
        headers: { "content-range": `bytes */${SPATIAL_TILE_ARCHIVE.length}` },
        body: "",
      });
      return;
    }
    const end = Math.min(requestedEnd, SPATIAL_TILE_ARCHIVE.length - 1);
    const body = SPATIAL_TILE_ARCHIVE.subarray(start, end + 1);
    await route.fulfill({
      status: range ? 206 : 200,
      headers: {
        "accept-ranges": "bytes",
        "content-length": String(body.length),
        "content-range": `bytes ${start}-${end}/${SPATIAL_TILE_ARCHIVE.length}`,
        "content-type": "application/vnd.pmtiles",
      },
      body,
    });
  });
}

const PLAYWRIGHT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";

/** Role aktif dari cookie `mock_role` (fallback: opsi install `role`). */
function roleFromRequestCookies(request, fallbackRole) {
  return roleFromCookieHeader(request.headers().cookie, fallbackRole);
}

// A real ALTCHA challenge at minimal cost so the widget solves quickly in the test browser.
async function mockCaptchaChallenge() {
  return createChallenge({
    algorithm: "PBKDF2/SHA-256",
    cost: 1,
    deriveKey: pbkdf2.deriveKey,
    hmacSignatureSecret: "playwright-altcha-secret",
    expiresAt: new Date(Date.now() + 300_000),
  });
}

/**
 * Mirrors the server response envelope for SDK clients: `meta` travels inside `data`
 * (analytics bundle `envelope()`, tabular rows/points, auth activity). Handlers below keep
 * building the legacy `{ data, meta }` shape; `withEnvelope` rewrites it on the way out.
 */
const ENVELOPED_PATHS = [
  [/^\/panel\/v1\/analytics\/analysis\/(query|records|umkm\/|exports)/, "items"],
  [/^\/panel\/v1\/analytics\/tabular\/$/, "rows"],
  [/^\/panel\/v1\/analytics\/tabular\/query$/, "rows"],
  [/^\/panel\/v1\/analytics\/tabular\/spasial$/, "points"],
  [/^\/panel\/v1\/auth\/activity$/, "items"],
];

function envelope(payload, listKey) {
  if (!payload || typeof payload !== "object" || !("meta" in payload) || !("data" in payload)) return payload;
  const { data, meta, ...rest } = payload;
  return { ...rest, data: Array.isArray(data) ? { [listKey]: data, meta } : { ...data, meta } };
}

function withEnvelope(route, path) {
  const match = ENVELOPED_PATHS.find(([pattern]) => pattern.test(path));
  if (!match) return route;
  return {
    request: () => route.request(),
    fulfill: (options) =>
      route.fulfill(
        typeof options.body === "string" && options.contentType === "application/json"
          ? { ...options, body: JSON.stringify(envelope(JSON.parse(options.body), match[1])) }
          : options,
      ),
  };
}

export const MOCK_USER = {
  id: "user-1",
  email: "analyst@example.invalid",
  first_name: "Analis",
  last_name: "Provinsi",
  role: APPLICATION_ROLE_ID,
  app_role: "provinsi",
  instansi: "DISKUK Provinsi Jawa Barat",
};

export async function installMockDirectus(
  page,
  { authenticated = false, renderMap = false, spatialTileset = null, serveSpatialTiles = false, role = "provinsi", requests = [], hasilKonsultasi = () => [] } = {},
) {
  let loggedIn = authenticated;
  globalThis.__y02Verified = new Set();
  // Agenda fixtures + reminder opt-ins of this install (Y07), shared by both calendar queries.
  const kegiatanState = createKegiatanState();
  // R03: state pendaftaran internal + sertifikat milik install ini.
  const registrasiState = createRegistrasiState();
  if (serveSpatialTiles) await installSpatialTileArchive(page);
  // R03: presensi scan proxy (Nuxt server route) answered from the same in-browser state;
  // the staff-role check mirrors what the real route enforces via the Directus session.
  await page.route("**/api/operasional/pindai", async (playwrightRoute) => {
    const request = playwrightRoute.request();
    const peranAktif = roleFromRequestCookies(request, role);
    if (!["provinsi", "kabkota"].includes(peranAktif)) {
      await playwrightRoute.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ errors: [{ message: "Pemindai hanya untuk staf." }] }) });
      return;
    }
    const hasil = registrasiApiResponse({
      pathname: "/v1/program/registrasi/pindai",
      method: "POST",
      body: request.postDataJSON?.() ?? null,
      state: registrasiState,
      role: peranAktif,
      secretOk: true,
    });
    await playwrightRoute.fulfill({ status: hasil.status ?? 200, contentType: "application/json", body: JSON.stringify(hasil.body ?? hasil) });
  });
  await page.context().addCookies([
    {
      name: "mock_role",
      value: role,
      url: PLAYWRIGHT_BASE_URL,
    },
    // SSR (mock-directus-server.mjs) tidak melihat closure loggedIn milik
    // page.route; cookie ini menjadi sinyal terautentikasi untuk SSR.
    ...(authenticated ? [{ name: "mock_auth", value: "1", url: PLAYWRIGHT_BASE_URL }] : []),
  ]);
  await page.route("**/panel/**", async (playwrightRoute) => {
    const request = playwrightRoute.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const route = withEnvelope(playwrightRoute, path);
    if (path.startsWith("/panel/v1/auth/") || path.startsWith("/panel/auth/") || path === "/panel/users/me") {
      requests.push({ method: request.method(), path, body: request.postDataJSON?.() ?? null });
    }
    // R03: internal registration + facilitation through Directus, honouring the active mock role.
    if (path.startsWith("/panel/v1/program/registrasi")) {
      const hasil = registrasiApiResponse({
        pathname: path.replace(/^\/panel/, ""),
        method: request.method(),
        body: request.method() === "GET" ? null : (request.postDataJSON?.() ?? null),
        state: registrasiState,
        role: roleFromRequestCookies(request, role),
      });
      if (hasil) {
        if (hasil.buffer) {
          await route.fulfill({ status: hasil.status ?? 200, contentType: hasil.contentType, body: hasil.buffer });
          return;
        }
        await route.fulfill({ status: hasil.status ?? 200, contentType: "application/json", body: JSON.stringify(hasil.body ?? hasil) });
        return;
      }
    }
    if (path === "/panel/v1/program/fasilitasi") {
      const hasil = fasilitasiApiResponse(path.replace(/^\/panel/, ""), url.searchParams);
      await route.fulfill({ status: hasil.status ?? 200, contentType: "application/json", body: JSON.stringify(hasil.body ?? hasil) });
      return;
    }
    // Public agenda (Y07): the page reads its list, detail and reminder routes through Directus.
    if (path.startsWith("/panel/v1/program/kegiatan")) {
      const hasil = kegiatanApiResponse({
        pathname: path.replace(/^\/panel/, ""),
        searchParams: url.searchParams,
        method: request.method(),
        body: request.method() === "GET" ? null : (request.postDataJSON?.() ?? null),
        state: kegiatanState,
      });
      if (hasil) {
        await route.fulfill({ status: hasil.status ?? 200, contentType: "application/json", body: JSON.stringify(hasil.body ?? hasil) });
        return;
      }
    }
    if (path === "/panel/v1/auth/captcha/challenge") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(await mockCaptchaChallenge()) });
      return;
    }
    if (path === "/panel/auth/login") {
      const body = request.postDataJSON();
      if (!body?.captcha || !body?.email || body?.password === "wrong-password") {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ errors: [{ message: "Invalid user credentials.", extensions: { code: "INVALID_CREDENTIALS" } }] }),
        });
        return;
      }
      loggedIn = true;
      // Directus sets its session cookie on login (SESSION_COOKIE_NAME=diskuk_session). Without it a
      // full reload is server-rendered as anonymous and bounces to /sign-in.
      await page.context().addCookies([{ name: "diskuk_session", value: "mock", url: PLAYWRIGHT_BASE_URL, httpOnly: true }]);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { expires: 28_800_000 } }) });
      return;
    }
    if (path === "/panel/auth/password/request" || path === "/panel/auth/password/reset") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (path === "/panel/auth/logout") {
      loggedIn = false;
      await page.context().clearCookies({ name: "diskuk_session" });
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (path === "/panel/operasional/me") {
      // Sesi Directus nyata tidak melewati /panel/auth/login di browser ini;
      // kehadiran cookie sesi upstream (diskuk_session) menandakan sudah masuk.
      const hasSessionCookie = (request.headers().cookie || "").includes("diskuk_session=");
      if (!loggedIn && !hasSessionCookie) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ errors: [{ message: "unauthorized" }] }),
        });
        return;
      }
      const activeRole = roleFromRequestCookies(request, role);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: OPERATOR_FIXTURES[activeRole] }),
      });
      return;
    }
    if (path === "/panel/users/me" && request.method() === "PATCH" && loggedIn) {
      const body = request.postDataJSON();
      if (body?.password !== undefined && body?.current_password !== "current-password") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ errors: [{ message: "The current password is incorrect.", extensions: { code: "CURRENT_PASSWORD_INVALID" } }] }),
        });
        return;
      }
      // `app_role`/instansi/kota_scope/usaha mengikuti role mock aktif (cookie `mock_role`).
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: mockUserMe(roleFromRequestCookies(request, role)) }) });
      return;
    }
    if (path === "/panel/users/me") {
      if (!loggedIn) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ errors: [{ message: "unauthorized" }] }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: mockUserMe(roleFromRequestCookies(request, role)) }) });
      return;
    }
    if (!loggedIn) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ errors: [{ message: "unauthorized" }] }),
      });
      return;
    }
    if (path === "/panel/v1/auth/activity") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            { kind: "session", action: "login", collection: null, item: null, ip: "10.0.0.7", user_agent: "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0", reason: null, timestamp: "2026-09-26T08:00:00Z" },
            { kind: "session", action: "login_failed", collection: null, item: null, ip: "10.0.0.9", user_agent: "curl/8.0", reason: "INVALID_CREDENTIALS", timestamp: "2026-09-25T22:00:00Z" },
          ],
          meta: { page: 1, limit: 20, hasMore: false },
        }),
      });
      return;
    }
    if (path === "/panel/v1/analytics/tabular/options") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tabularOptionsResponse()) });
      return;
    }
    if (path === "/panel/v1/analytics/tabular/spasial/tileset") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: spatialTileset }) });
      return;
    }
    if (path === "/panel/v1/analytics/tabular/spasial") {
      const skala = url.searchParams.get("skala");
      const allPoints = Array.from({ length: 4 }, (_, index) => ({
        id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, "0")}`,
        nama: `Titik ${index + 1}`,
        skala: index < 3 ? "micro" : "small",
        produkUtama: "Keripik Singkong",
        kegiatanUtama: "Produksi makanan ringan",
        kodeKbli: "10794",
        kategoriKbli: "INDUSTRI PENGOLAHAN",
        kota: "Kabupaten Bogor",
        kecamatan: "Cibinong",
        latitude: -6.55 + index * 0.05,
        longitude: 106.8 + index * 0.05,
      }));
      const points = skala ? allPoints.filter((item) => item.skala === skala) : allPoints;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: points, meta: { filterCount: skala ? points.length : 12, mikro: points.filter((item) => item.skala === "micro").length, kecil: points.filter((item) => item.skala === "small").length, menengah: 0 } }) });
      return;
    }
    if (path === "/panel/v1/analytics/tabular/kelurahan") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [{ id: 111, nama: "Pakansari" }] }),
      });
      return;
    }
    // B08-web: daftar baris dibaca dari body POST /query (q bisa memuat NIK);
    // GET / dipertahankan untuk kompatibilitas. Keduanya memakai pembangun yang sama.
    const tabularRowsPayload = ({ skala, q, page, page_size }) => {
      const allRows = Array.from({ length: 12 }, (_, index) => ({
        id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
        nama: index === 1 ? "Wawan Leathercraft" : `Usaha ${String(index + 1).padStart(2, "0")}`,
        nib: index === 1 ? "9900000000001" : `123456789012${index}`,
        skala: index < 8 ? "micro" : index < 11 ? "small" : "medium",
        produkUtama: index % 2 === 0 ? "Keripik Singkong" : "Pakaian",
        kegiatanUtama:
          index % 2 === 0 ? "Produksi makanan ringan" : "Perdagangan pakaian",
        kodeKbli: index % 2 === 0 ? "10794" : "47112",
        kategoriKbli: index % 2 === 0 ? "INDUSTRI PENGOLAHAN" : "PERDAGANGAN",
        kota: "Kabupaten Bogor",
        kecamatan: "Cibinong",
        kelurahan: "Pakansari",
      }));
      const scale = skala ?? null;
      const keyword = String(q ?? "").toLowerCase().trim();
      let filteredRows = allRows;
      if (scale) {
        filteredRows = filteredRows.filter((item) => item.skala === scale);
      }
      if (keyword) {
        if (keyword === "9900000000001") {
          filteredRows = filteredRows.filter((item) => item.nib === "9900000000001" || item.nama.toLowerCase().includes("wawan"));
        } else {
          filteredRows = filteredRows.filter((item) =>
            item.nama.toLowerCase().includes(keyword) || (item.nib && item.nib.includes(keyword))
          );
        }
      }
      const pageNumber = Number(page || "1");
      const pageSize = Number(page_size || "10");
      const start = (pageNumber - 1) * pageSize;
      const data = filteredRows.slice(start, start + pageSize);
      return {
        data,
        meta: {
          filterCount: filteredRows.length,
          mikro: filteredRows.filter((item) => item.skala === "micro").length,
          kecil: filteredRows.filter((item) => item.skala === "small").length,
          menengah: filteredRows.filter((item) => item.skala === "medium")
            .length,
          page: pageNumber,
          pageSize,
          nextCursor:
            start + data.length < filteredRows.length ? "next-page" : null,
          hasNext: start + data.length < filteredRows.length,
        },
      };
    };
    if (path === "/panel/v1/analytics/tabular/query" && request.method() === "POST") {
      const body = request.postDataJSON?.() ?? {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(tabularRowsPayload({ ...Object.fromEntries(url.searchParams), ...body })),
      });
      return;
    }
    if (path === "/panel/v1/analytics/tabular/") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(tabularRowsPayload({
          skala: url.searchParams.get("skala"),
          q: url.searchParams.get("q"),
          page: url.searchParams.get("page"),
          page_size: url.searchParams.get("page_size"),
        })),
      });
      return;
    }
    if (path === "/panel/v1/analytics/infographic/") {
      const body = infographicResponse({ filtered: url.searchParams.has("skala"), renderMap });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      return;
    }
    if (path === "/panel/v1/analytics/analysis/metadata") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schemaVersion: 1,
          fields: [
            {
              id: "kota_nama",
              key: "kota_nama",
              label: "Nama kabupaten/kota",
              group: "Wilayah",
              order: 1,
              role: "dimension",
              type: "text",
              status: "active",
              privacy: "aggregate",
              capabilities: ["group"],
              schemaVersion: 1,
            },
            {
              id: "skala_dilaporkan",
              key: "skala_dilaporkan",
              label: "Skala",
              group: "Usaha",
              order: 2,
              role: "dimension",
              type: "text",
              status: "active",
              privacy: "aggregate",
              capabilities: ["group", "filter"],
              schemaVersion: 1,
            },
            {
              id: "omzet_tahunan",
              key: "omzet_tahunan",
              label: "Total omzet tahunan dilaporkan",
              group: "Usaha",
              order: 3,
              role: "metric",
              type: "number",
              status: "active",
              privacy: "aggregate",
              capabilities: ["sum"],
              schemaVersion: 1,
            },
            {
              id: "total_aset",
              key: "total_aset",
              label: "Total aset dilaporkan",
              group: "Usaha",
              order: 4,
              role: "metric",
              type: "number",
              status: "active",
              privacy: "aggregate",
              capabilities: ["sum"],
              schemaVersion: 1,
            },
            {
              id: "kota_id",
              key: "kota_id",
              label: "Kabupaten/kota",
              group: "Wilayah",
              order: 5,
              role: "dimension",
              type: "integer",
              status: "active",
              privacy: "aggregate",
              capabilities: ["group"],
              schemaVersion: 1,
            },
            {
              id: "kota_kode",
              key: "kota_kode",
              label: "Kode kabupaten/kota",
              group: "Wilayah",
              order: 6,
              role: "filter",
              type: "text",
              status: "active",
              privacy: "aggregate",
              capabilities: ["filter"],
              schemaVersion: 1,
            },
            {
              id: "kecamatan_id",
              key: "kecamatan_id",
              label: "Kecamatan",
              group: "Wilayah",
              order: 7,
              role: "dimension",
              type: "integer",
              status: "active",
              privacy: "aggregate",
              capabilities: ["group"],
              schemaVersion: 1,
            },
            {
              id: "kecamatan_nama",
              key: "kecamatan_nama",
              label: "Nama kecamatan",
              group: "Wilayah",
              order: 8,
              role: "dimension",
              type: "text",
              status: "active",
              privacy: "aggregate",
              capabilities: ["group"],
              schemaVersion: 1,
            },
          ],
          warnings: [],
        }),
      });
      return;
    }
    if (path === "/panel/v1/analytics/analysis/templates") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schemaVersion: 1,
          templates: [
            {
              id: "current-city",
              version: 1,
              label: "Sebaran UMKM Saat Ini",
              description: "",
              config: {
                metric: "jumlah_umkm",
                groupBy: "kota_nama",
                visual: "bar",
                filters: [],
              },
              workforce: { enabled: false },
              financial: { enabled: false },
            },
          ],
        }),
      });
      return;
    }
    if (path === "/panel/v1/analytics/analysis/query") {
      const config = request.postDataJSON() || {};
      const financial = config.metric === "omzet_tahunan";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          financial
            ? {
                meta: {
                  schemaVersion: 1,
                  dataAsOf: "2026-08-17T00:30:00Z",
                  generatedAt: "2026-08-17T00:31:00Z",
                  status: "current",
                  source: "analytics",
                  population: 3,
                  matched: 2,
                  coverage: {
                    matched: 2,
                    total: 3,
                    unknown: 0,
                    missing: 1,
                    needsVerification: 0,
                  },
                  warnings: [],
                },
                data: {
                  metric: {
                    key: "omzet_tahunan",
                    label: "Total omzet tahunan dilaporkan",
                    aggregation: "sum",
                    unit: "IDR",
                  },
                  total: 150000000,
                  groups: [
                    {
                      key: "bogor",
                      label: "Kabupaten Bogor",
                      value: 100000000,
                      share: 66.7,
                    },
                    {
                      key: "depok",
                      label: "Kota Depok",
                      value: 50000000,
                      share: 33.3,
                    },
                  ],
                },
              }
            : {
                meta: {
                  schemaVersion: 1,
                  dataAsOf: "2026-08-17T00:30:00Z",
                  generatedAt: "2026-08-17T00:31:00Z",
                  status: "current",
                  source: "analytics",
                  population: 3,
                  matched: 3,
                  coverage: { matched: 3, total: 3, unknown: 0 },
                  warnings: [],
                },
                data: {
                  metric: {
                    key: "jumlah_umkm",
                    label: "Jumlah UMKM",
                    aggregation: "count_distinct",
                    unit: "usaha",
                  },
                  total: 3,
                  groups: [
                    {
                      key: "bogor",
                      label: "Kabupaten Bogor",
                      value: 2,
                      share: 66.7,
                    },
                    {
                      key: "depok",
                      label: "Kota Depok",
                      value: 1,
                      share: 33.3,
                    },
                  ],
                },
              },
        ),
      });
      return;
    }
    if (path === "/panel/v1/analytics/analysis/records") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          meta: {
            schemaVersion: 1,
            dataAsOf: "2026-08-17T00:30:00Z",
            generatedAt: "2026-08-17T00:31:00Z",
            status: "current",
            source: "analytics",
            population: 3,
            matched: 3,
            coverage: { matched: 3, total: 3 },
            warnings: [],
          },
          data: { records: [], nextCursor: null },
        }),
      });
      return;
    }
    if (path.startsWith("/panel/v1/analytics/analysis/umkm/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          meta: {
            schemaVersion: 1,
            dataAsOf: "2026-08-17T00:30:00Z",
            generatedAt: "2026-08-17T00:31:00Z",
            status: "current",
            source: "analytics",
            population: 1,
            matched: 1,
            coverage: { matched: 1, total: 1 },
            warnings: [],
          },
          data: {
            id: "11111111-1111-4111-8111-111111111111",
            title: "Usaha Canari",
            badges: ["Aktif"],
            hero: { name: "Usaha Canari", location: "Bogor", image: null },
            sections: [
              {
                id: "ringkasan",
                label: "Ringkasan",
                fields: [
                  {
                    fieldId: "masked_nik",
                    label: "NIK",
                    value: "************1234",
                    displayValue: "************1234",
                    qualityStatus: "reported",
                    dataType: "text",
                  },
                ],
              },
            ],
            actions: {
              canEdit: true,
              canArchive: true,
              canRestore: false,
              editPath:
                "/dashboard/data-lapangan/11111111-1111-4111-8111-111111111111",
            },
            maskingVersion: 1,
          },
        }),
      });
      return;
    }
    if (path === "/panel/v1/analytics/analysis/metadata/options") {
      // Mock opsi filter: skala statis, wilayah dari daftar pendek.
      const fieldId = url.searchParams.get("fieldId") || "";
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const parent = url.searchParams.get("parent") || "";
      let options;
      if (fieldId === "skala_dilaporkan")
        options = [
          { id: "micro", label: "Mikro" },
          { id: "small", label: "Kecil" },
          { id: "medium", label: "Menengah" },
        ];
      else if (fieldId === "kota_nama")
        options = [
          { id: "1", label: "Kabupaten Bogor" },
          { id: "2", label: "Kota Depok" },
        ];
      else if (fieldId === "kecamatan_nama")
        options = parent ? [{ id: "11", label: "Cibinong" }] : [];
      else options = [];
      const filtered = search
        ? options.filter((option) =>
            option.label.toLowerCase().startsWith(search),
          )
        : options;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ fieldId, options: filtered }),
      });
      return;
    }
    if (path === "/panel/v1/analytics/infographic/map") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(infographicMapResponse()) });
      return;
    }
    if (path === "/panel/items/analitik_view") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
      return;
    }
    if (path.startsWith("/panel/items/usaha/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { status: "archived" } }),
      });
      return;
    }
    if (path === "/panel/files" && request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "44444444-4444-4444-8444-000000000001" } }),
      });
      return;
    }
    const usahaMatch = path.match(/^\/panel\/operasional\/usaha\/([0-9a-f-]{36})(\/verifikasi)?$/i);
    if (usahaMatch) {
      const verifiedByTest = (globalThis.__y02Verified ??= new Set());
      if (path.endsWith("/verifikasi") && request.method() === "POST") {
        verifiedByTest.add(usahaMatch[1]);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              id: usahaMatch[1],
              sidt: { nama: "Usaha 01" },
              atribut: { qris: true },
              verifikasi: {
                terverifikasiOleh: { id: "u-1", nama: "Admin" },
                terverifikasiPada: "2026-09-20T03:00:00.000Z",
              },
              diperbaruiPada: "2026-09-21T00:00:00.000Z",
            },
          }),
        });
        return;
      }
      if (request.method() === "PATCH") {
        const body = request.postDataJSON() || {};
        if (body?.sidt?.nib === "123") {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              errors: [{
                message: "Validasi gagal",
                extensions: { code: "VALIDATION_FAILED", fields: { nib: "NIB harus 13 digit" } },
              }],
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              id: usahaMatch[1],
              sidt: { nama: "Usaha 01", nib: body?.sidt?.nib ?? "1234567890123" },
              atribut: { qris: body?.atribut?.qris ?? null },
              verifikasi: { terverifikasiOleh: null, terverifikasiPada: null },
              diperbaruiPada: "2026-09-21T00:00:00.000Z",
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: usahaMatch[1],
            sidt: {
              nama: "Usaha 01",
              nib: "1234567890123",
              kegiatanUtama: "Produksi makanan ringan",
              produkUtama: "Keripik Singkong",
              kodeKbli: "10794",
              skala: "micro",
              omzetTahunan: 300000000,
              totalAset: null,
              latitude: -6.6,
              longitude: 106.8,
              status: "active",
            },
            wilayah: { kota: "Kabupaten Bogor", kecamatan: "Cibinong", kelurahan: "Pakansari", alamatJalan: "Jl. Raya" },
            pemilik: { nama: "Pemilik 01" },
            atribut: { npwpUsaha: true, qris: null },
            // Outcome klinik terverifikasi usaha ini; spec klinik menyuplainya dari state mock programnya (R04).
            hasilKonsultasi: hasilKonsultasi(usahaMatch[1]),
            verifikasi: (globalThis.__y02Verified ?? new Set()).has(usahaMatch[1])
              ? {
                  terverifikasiOleh: { id: "u-1", nama: "Admin" },
                  terverifikasiPada: "2026-09-20T03:00:00.000Z",
                }
              : { terverifikasiOleh: null, terverifikasiPada: null },
            diperbaruiPada: null,
          },
        }),
      });
      return;
    }
    const petaMatch = path.match(/^\/panel\/(?:v1\/program\/peta|operasional\/usaha)\/([0-9a-f-]{36})(?:\/ringkas)?$/i);
    if (petaMatch) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: petaMatch[1],
            nama: "Wawan Leathercraft",
            pemilik: "Wawan Setiawan",
            skala: "micro",
            kodeKbli: "15121",
            kegiatanUtama: "Industri Barang dari Kulit",
            deskripsiKbli: "Industri Barang dari Kulit",
            omzetTahunan: 780000000,
            sertifikasi: ["halal", "pirt", "hki"],
            talentStatus: "accelerator",
            talentBatch: "Batch 1",
            talenta: { status: "accelerator", batch: "Batch 1" },
            profilPath: `/dashboard/umkm/${petaMatch[1]}`,
          },
        }),
      });
      return;
    }
    if (path === "/panel/v1/analytics/analysis/exports" && request.method() === "POST") {
      const body = request.postDataJSON?.() ?? {};
      const jobId = "66666666-6666-4666-8666-000000000001";
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            jobId,
            status: "completed",
            exportType: body.exportType || "aggregate_pptx",
            downloadUrl: `/panel/v1/analytics/analysis/exports/${jobId}/download`,
            estimatedRows: 3,
          },
        }),
      });
      return;
    }
    const exportMatch = path.match(/^\/panel\/v1\/analytics\/analysis\/exports\/([^/]+)(\/download)?$/);
    if (exportMatch) {
      const [, jobId, isDownload] = exportMatch;
      if (isDownload) {
        const dummyPptx = Buffer.from("PK\x03\x04ppt/slides/slide1.xmlPK\x03\x04ppt/slides/slide2.xmlPK\x03\x04ppt/slides/slide3.xml");
        await route.fulfill({
          status: 200,
          headers: {
            "content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "content-disposition": `attachment; filename="analitik-rapat-${jobId}.pptx"`,
          },
          body: dummyPptx,
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            jobId,
            status: "completed",
            downloadUrl: `/panel/v1/analytics/analysis/exports/${jobId}/download`,
            estimatedRows: 3,
          },
        }),
      });
      return;
    }
    if (path === "/panel/v1/analytics/tabular/export" && request.method() === "POST") {
      const jobId = "77777777-7777-4777-8777-000000000001";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId,
          status: "completed",
          downloadUrl: `/panel/v1/analytics/tabular/export/${jobId}/download`,
        }),
      });
      return;
    }
    const tabularExportMatch = path.match(/^\/panel\/v1\/analytics\/tabular\/export\/([^/]+)(\/download)?$/);
    if (tabularExportMatch) {
      const [, jobId, isDownload] = tabularExportMatch;
      if (isDownload) {
        await route.fulfill({
          status: 200,
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": 'attachment; filename="data-umkm-jawa-barat.csv"',
          },
          body: "nama,skala,kota\nWawan Leathercraft,micro,Kabupaten Bogor\n",
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId,
          status: "completed",
          downloadUrl: `/panel/v1/analytics/tabular/export/${jobId}/download`,
        }),
      });
      return;
    }
    if (path === "/panel/v1/program/passport/pdf/summary" || path === "/panel/v1/program/passport/pdf/katalog") {
      const pdfSample = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n200\n%%EOF";
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${path.endsWith("summary") ? "executive-summary.pdf" : "katalog-ekspor.pdf"}"`,
        },
        body: pdfSample,
      });
      return;
    }
    // Fail loudly: an unmocked route must not look like an empty success.
    console.warn(`MOCK_ROUTE_MISSING ${request.method()} ${path}`);
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ errors: [{ message: `MOCK_ROUTE_MISSING ${request.method()} ${path}`, extensions: { code: "MOCK_ROUTE_MISSING" } }] }),
    });
  });
}

/**
 * Resolves once Nuxt has finished hydrating the server-rendered page. A click that lands before this
 * hits server HTML without Vue listeners (a native form submit or a dead button).
 */
export async function waitForHydration(page) {
  await page.waitForFunction(() => {
    const nuxtApp = document.querySelector("#__nuxt")?.__vue_app__?.config.globalProperties.$nuxt;
    return Boolean(nuxtApp) && nuxtApp.isHydrating === false;
  }, null, { timeout: 15000 });
}

/** The captcha widget mounts client-side only, so its presence means the form has hydrated. */
export async function waitForCaptchaForm(page) {
  await page.locator("altcha-widget").waitFor({ state: "attached", timeout: 15000 });
}

export async function loginMock(page, returnTo = "/dashboard", expectedPath = returnTo) {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email atau NIB").waitFor({ state: "visible", timeout: 15000 });
  // Prove hydration through behavior before filling. Values entered into the
  // SSR form can otherwise be replaced while Vue attaches v-model listeners.
  const passwordInput = page.locator("#password");
  const passwordToggle = page.getByRole("button", { name: "Tampilkan kata sandi" });
  const hydrationDeadline = Date.now() + 15000;
  while (Date.now() < hydrationDeadline && await passwordInput.getAttribute("type") !== "text") {
    await passwordToggle.click();
    await page.waitForTimeout(100);
  }
  if (await passwordInput.getAttribute("type") !== "text") {
    throw new Error("Sign-in form did not hydrate");
  }
  await page.getByRole("button", { name: "Sembunyikan kata sandi" }).click();
  // A submit click that lands before hydration (or a captcha reset race) leaves the form
  // on /sign-in; retry the whole fill+submit until the session navigation actually happens.
  await expect(async () => {
    await page.getByLabel("Email atau NIB").fill("analyst@example.invalid");
    await page
      .getByRole("textbox", { name: "Kata sandi" })
      .fill("not-a-real-secret");
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 3000 });
  }).toPass({ timeout: 30000 });
}

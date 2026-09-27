import { createChallenge, pbkdf2 } from "altcha/lib";

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

/** Profil operator per role dari kontrak `GET /panel/operasional/me` (Y01). */
export const OPERATOR_FIXTURES = {
  provinsi: {
    id: "user-1",
    email: "analyst@example.invalid",
    firstName: "Analis",
    lastName: "Provinsi",
    avatar: null,
    role: "provinsi",
    roleLabel: "Admin Provinsi",
    instansi: "DISKUK Provinsi Jawa Barat",
    kota: null,
    usaha: null,
  },
  kabkota: {
    id: "user-2",
    email: "dummy_admin.subang@jabarprov.go.id",
    firstName: "Analis",
    lastName: "Daerah",
    avatar: null,
    role: "kabkota",
    roleLabel: "Admin Kab/Kota",
    instansi: "Dinas KUK Kabupaten Bogor",
    kota: { id: 1, nama: "Kabupaten Bogor" },
    usaha: null,
  },
  pendamping: {
    id: "user-3",
    email: "dummy_coach.pendamping@jabarprov.go.id",
    firstName: "Pendamping",
    lastName: null,
    avatar: null,
    role: "pendamping",
    roleLabel: "Pendamping",
    instansi: "Program Pendampingan UMKM",
    kota: null,
    usaha: null,
  },
  umkm: {
    id: "user-4",
    email: "dummy_wawan.leathercraft@gmail.com",
    firstName: "Wawan",
    lastName: null,
    avatar: null,
    role: "umkm",
    roleLabel: "Pelaku UMKM",
    instansi: "Pelaku UMKM",
    kota: null,
    usaha: {
      id: "11111111-1111-4111-8111-000000000001",
      nama: "Wawan Leathercraft",
      nib: "9900000000001",
    },
  },
};

/** Role aktif dari cookie `mock_role` (fallback: opsi install `role`). */
function roleFromRequestCookies(request, fallbackRole) {
  const cookieHeader = request.headers().cookie || "";
  for (const cookie of cookieHeader.split(";")) {
    const [name, ...rest] = cookie.trim().split("=");
    if (name === "mock_role") {
      const value = rest.join("=");
      if (value && value in OPERATOR_FIXTURES) return value;
    }
  }
  return fallbackRole;
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
  role: "7d6d493c-1a6d-4c59-9e74-40d42a7862eb",
  app_role: "provinsi",
  instansi: "DISKUK Provinsi Jawa Barat",
};

export async function installMockDirectus(
  page,
  { authenticated = false, renderMap = false, spatialTileset = null, serveSpatialTiles = false, role = "provinsi", requests = [] } = {},
) {
  let loggedIn = authenticated;
  globalThis.__y02Verified = new Set();
  if (serveSpatialTiles) await installSpatialTileArchive(page);
  await page.context().addCookies([{
    name: "mock_role",
    value: role,
    url: PLAYWRIGHT_BASE_URL,
  }]);
  await page.route("**/panel/**", async (playwrightRoute) => {
    const request = playwrightRoute.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const route = withEnvelope(playwrightRoute, path);
    if (path.startsWith("/panel/v1/auth/") || path.startsWith("/panel/auth/") || path === "/panel/users/me") {
      requests.push({ method: request.method(), path, body: request.postDataJSON?.() ?? null });
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
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { expires: 28_800_000 } }) });
      return;
    }
    if (path === "/panel/auth/password/request" || path === "/panel/auth/password/reset") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (path === "/panel/auth/logout") {
      loggedIn = false;
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
    if (path === "/panel/operasional/aktivitas") {
      const hasSessionCookie = (request.headers().cookie || "").includes("diskuk_session=");
      if (!loggedIn && !hasSessionCookie) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ errors: [{ message: "unauthorized" }] }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 1,
            action: "login",
            collection: "directus_users",
            item: "user-1",
            timestamp: "2026-09-26T01:00:00.000Z",
            ip: "127.0.0.1",
            userAgent: "Playwright",
          },
        ]),
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
      // `app_role` mengikuti role mock aktif (cookie `mock_role`) agar matriks role Y01 terbaca.
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { ...MOCK_USER, app_role: roleFromRequestCookies(request, role) } }) });
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
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { ...MOCK_USER, app_role: roleFromRequestCookies(request, role) } }) });
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
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            kota: [{ id: 1, nama: "Kabupaten Bogor" }],
            kecamatan: [{ id: 11, nama: "Cibinong", kotaId: 1 }],
            kategori: ["PERDAGANGAN"],
            kbli: [{ kode: "47112", kategori: "PERDAGANGAN" }],
          },
        }),
      });
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
    if (path === "/panel/v1/analytics/tabular/") {
      const allRows = Array.from({ length: 12 }, (_, index) => ({
        id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
        nama: `Usaha ${String(index + 1).padStart(2, "0")}`,
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
      const scale = url.searchParams.get("skala");
      const filteredRows = scale
        ? allRows.filter((item) => item.skala === scale)
        : allRows;
      const pageNumber = Number(url.searchParams.get("page") || "1");
      const pageSize = Number(url.searchParams.get("page_size") || "10");
      const start = (pageNumber - 1) * pageSize;
      const data = filteredRows.slice(start, start + pageSize);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
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
        }),
      });
      return;
    }
    if (path === "/panel/v1/analytics/infographic/") {
      const filtered = url.searchParams.has("skala");
      const regions = renderMap
        ? Array.from({ length: 27 }, (_, index) => {
            const longitude = 106 + (index % 9) * 0.25;
            const latitude = -7.5 + Math.floor(index / 9) * 0.25;
            return {
              id: String(index + 1),
              name: `Wilayah ${index + 1}`,
              value: index + 1,
              code: `32.${String(index + 1).padStart(2, "0")}`,
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [longitude, latitude],
                    [longitude + 0.2, latitude],
                    [longitude + 0.2, latitude + 0.2],
                    [longitude, latitude + 0.2],
                    [longitude, latitude],
                  ],
                ],
              },
            };
          })
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            scales: filtered
              ? { total: 2, mikro: 2, kecil: 0, menengah: 0 }
              : { total: 3, mikro: 2, kecil: 1, menengah: 0 },
            regions: renderMap
              ? regions
              : [
                  { id: "1", name: "Kabupaten Bogor", value: 2 },
                  { id: "2", name: "Kota Depok", value: 1 },
                ],
            geometryReady: renderMap,
            sectors: filtered
              ? []
              : [
                  {
                    code: "G",
                    name: "Perdagangan Besar dan Eceran",
                    total: 1,
                    mikro: 1,
                    kecil: 0,
                    menengah: 0,
                    percentage: 33.3,
                  },
                  {
                    code: "C",
                    name: "Industri Pengolahan",
                    total: 2,
                    mikro: 1,
                    kecil: 1,
                    menengah: 0,
                    percentage: 66.7,
                  },
                ],
            topKbli: filtered
              ? []
              : [
                  {
                    code: "47112",
                    name: "Perdagangan eceran",
                    description: null,
                    total: 2,
                    mikro: 2,
                    kecil: 0,
                    menengah: 0,
                  },
                  {
                    code: "10794",
                    name: "Industri makanan",
                    description: null,
                    total: 1,
                    mikro: 0,
                    kecil: 1,
                    menengah: 0,
                  },
                ],
            kbli: [],
            sectorCoverage: filtered
              ? undefined
              : { mapped: 3, unclassified: 0 },
            nib: filtered
              ? undefined
              : {
                  total: 3,
                  withNib: 2,
                  withoutNib: 1,
                  withPercentage: 66.7,
                  withoutPercentage: 33.3,
                },
            marketingMethods: filtered
              ? undefined
              : [
                  {
                    key: "non-digital",
                    label: "Non-digital",
                    value: 2,
                    percentage: 66.7,
                  },
                  {
                    key: "digital",
                    label: "Digital",
                    value: 1,
                    percentage: 33.3,
                  },
                ],
            workforce: {
              male: 2,
              female: 1,
              total: 3,
              malePercentage: 66.7,
              femalePercentage: 33.3,
            },
            dataAsOf: "2026-08-17T00:30:00Z",
          },
        }),
      });
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
              label: "Kabupaten/kota",
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
      const regions = Array.from({ length: 27 }, (_, index) => {
        const longitude = 106 + (index % 9) * 0.25;
        const latitude = -7.5 + Math.floor(index / 9) * 0.25;
        return {
          id: String(index + 1),
          name: `Wilayah ${index + 1}`,
          code: `32.${String(index + 1).padStart(2, "0")}`,
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [longitude, latitude],
                [longitude + 0.2, latitude],
                [longitude + 0.2, latitude + 0.2],
                [longitude, latitude + 0.2],
                [longitude, latitude],
              ],
            ],
          },
        };
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            regions,
            regionLevel: "kota",
            geometryReady: true,
            geometryMissing: 0,
          },
        }),
      });
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });
}

/** The captcha widget mounts client-side only, so its presence means the form has hydrated. */
export async function waitForCaptchaForm(page) {
  await page.locator("altcha-widget").waitFor({ state: "attached", timeout: 15000 });
}

export async function loginMock(page, returnTo = "/dashboard", expectedPath = returnTo) {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email / NIB").waitFor({ state: "visible", timeout: 15000 });
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
  await page.getByLabel("Email / NIB").fill("analyst@example.invalid");
  await page
    .getByRole("textbox", { name: "Kata sandi" })
    .fill("not-a-real-secret");
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 10000 });
}

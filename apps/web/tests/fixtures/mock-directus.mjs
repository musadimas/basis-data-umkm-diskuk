import { createHmac } from "node:crypto";

const SESSION_POLICY_SECRET = process.env.NUXT_SESSION_POLICY_SECRET || "playwright-session-policy-secret";
const SESSION_POLICY_COOKIES = ["diskuk_session_started", "diskuk_session_last_activity"];
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

export async function installMockDirectus(
  page,
  { authenticated = false, renderMap = false, spatialTileset = null, serveSpatialTiles = false, role = "provinsi" } = {},
) {
  let loggedIn = authenticated;
  globalThis.__y02Verified = new Set();
  if (serveSpatialTiles) await installSpatialTileArchive(page);
  await page.context().addCookies([{
    name: "mock_role",
    value: role,
    url: PLAYWRIGHT_BASE_URL,
  }]);
  await page.route("**/panel/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === "/panel/auth/login") {
      loggedIn = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { expires: "2099-01-01T00:00:00Z" } }),
      });
      return;
    }
    if (path === "/panel/auth/logout") {
      loggedIn = false;
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (path === "/panel/auth/password/request") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
      return;
    }
    if (path === "/panel/auth/password/reset") {
      const resetToken = url.searchParams.get("token");
      // Mock uji e2e: token literal "bad" meniru tautan kedaluwarsa (403).
      if (resetToken === "bad") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ errors: [{ message: "forbidden" }] }),
        });
        return;
      }
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (path === "/panel/operasional/me") {
      // Login NIB nyata (POST /api/auth/login-nib) tidak melewati /panel/auth/login
      // di browser; kehadiran cookie sesi upstream menandakan sudah masuk.
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
    if (path === "/panel/users/me") {      if (!loggedIn) {
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
        body: JSON.stringify({
          data: {
            id: "user-1",
            email: "analyst@example.invalid",
            first_name: "Analis",
            role: "7d6d493c-1a6d-4c59-9e74-40d42a7862eb",
          },
        }),
      });
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
    if (path === "/panel/tabular/options") {
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
    if (path === "/panel/tabular/spasial/tileset") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: spatialTileset }) });
      return;
    }
    if (path === "/panel/tabular/spasial") {
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
    if (path === "/panel/tabular/kelurahan") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [{ id: 111, nama: "Pakansari" }] }),
      });
      return;
    }
    if (path === "/panel/tabular/") {
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
    if (path === "/panel/infografis/") {
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
    if (path === "/panel/analitik/metadata") {
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
    if (path === "/panel/analitik/templates") {
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
    if (path === "/panel/analitik/query") {
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
    if (path === "/panel/analitik/records") {
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
    if (path.startsWith("/panel/analitik/umkm/")) {
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
    if (path === "/panel/analitik/metadata/options") {
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
    if (path === "/panel/infografis/map") {
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
    const prefillMatch = path.match(/^\/panel\/operasional\/talenta\/prefill\/([0-9a-f-]{36})$/i);
    if (prefillMatch) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            usaha: {
              id: prefillMatch[1],
              nama: "Usaha 01",
              nib: "1234567890123",
              nikTersamar: "************1234",
              omzetTahunan: 300000000,
              alamat: "Jl. Raya, Pakansari, Cibinong, Kabupaten Bogor",
              kota: "Kabupaten Bogor",
            },
            talentaAktif: null,
          },
        }),
      });
      return;
    }
    if (path === "/panel/operasional/talenta/skor" && request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            finansial: 50,
            pasar: 87.5,
            legalitas: 80,
            sdm: 100,
            total: 79.38,
            rekomendasi: "Direkomendasikan Masuk Talent Pool",
            rubrikVersi: 1,
          },
        }),
      });
      return;
    }
    if (path === "/panel/operasional/talenta" && request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "33333333-3333-4333-8333-000000000001" } }),
      });
      return;
    }
    if (path === "/panel/operasional/talenta" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "33333333-3333-4333-8333-000000000001",
              usaha: { id: "11111111-1111-4111-8111-000000000001", nama: "Usaha 01" },
              kota: { id: 1, nama: "Kabupaten Bogor" },
              status: "dinilai",
              skorTotal: 79.38,
              rekomendasi: "Direkomendasikan Masuk Talent Pool",
              diajukanPada: "2026-09-20T00:00:00.000Z",
              beritaAcara: null,
            },
            {
              id: "33333333-3333-4333-8333-000000000002",
              usaha: { id: "11111111-1111-4111-8111-000000000002", nama: "Usaha 02" },
              kota: { id: 1, nama: "Kabupaten Bogor" },
              status: "diajukan",
              skorTotal: 50.44,
              rekomendasi: "Belum Direkomendasikan",
              diajukanPada: "2026-09-19T00:00:00.000Z",
              beritaAcara: null,
            },
          ],
          meta: { total: 2, page: 1, pageSize: 25 },
        }),
      });
      return;
    }
    const talentaMatch = path.match(/^\/panel\/operasional\/talenta\/([0-9a-f-]{36})(\/(nominasi|tolak))?$/i);
    if (talentaMatch) {
      const detail = {
        id: talentaMatch[1],
        usaha: { id: "11111111-1111-4111-8111-000000000001", nama: "Usaha 01" },
        kota: { id: 1, nama: "Kabupaten Bogor" },
        status: talentaMatch[3] === "nominasi" ? "dinilai" : talentaMatch[3] === "tolak" ? "ditolak" : "diajukan",
        form: {
          kapasitasProduksiBulanan: 500,
          satuanKapasitas: "unit",
          kesiapanHalal: true,
          kesiapanPirtBpom: true,
          kesiapanHki: false,
          adopsiQris: true,
          pencatatanKeuanganDigital: true,
        },
        skor: { finansial: 50, pasar: 87.5, legalitas: 80, sdm: 100, total: 79.38 },
        rubrikVersi: 1,
        rekomendasi: "Direkomendasikan Masuk Talent Pool",
        suratKomitmen: { id: "44444444-4444-4444-8444-000000000001", nama: "komitmen.png" },
        riwayat: [{ tahap: "diajukan", oleh: "u-1", pada: "2026-09-20T00:00:00.000Z" }],
        diajukanPada: "2026-09-20T00:00:00.000Z",
        beritaAcara: null,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: detail }),
      });
      return;
    }
    if (path === "/panel/operasional/berita-acara" && request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "ba-1", nomor: "BA-TS/2026/0001", tanggal: "2026-09-26", jumlah: 1 } }),
      });
      return;
    }
    if (path === "/panel/operasional/berita-acara" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{ id: "ba-1", nomor: "BA-TS/2026/0001", tanggal: "2026-09-26", catatan: null, jumlahTalenta: 1, diterbitkanOleh: "prov@example.invalid" }],
        }),
      });
      return;
    }
    // ── Y03: KPI mingguan (usaha-saya, laporan, binaan, akselerasi) ──
    if (path === "/panel/operasional/usaha-saya") {
      const hariIni = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const [Y, M, D] = hariIni.split("-").map(Number);
      const mulai = new Date(Date.UTC(Y, M - 1, D - 35));
      const ymd = mulai.toISOString().slice(0, 10);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            usaha: { id: "11111111-1111-4111-8111-000000000001", nama: "Wawan Leathercraft", nib: "9900000000001", kota: null, skala: "small", omzetTahunan: 780000000 },
            pemilik: { nama: "Wawan Setiawan" },
            talenta: {
              id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
              status: "accelerator",
              batch: { id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001", kode: "ACC-2026-B1", nama: "Batch 1", tahap: "accelerator", tanggalMulai: ymd, jumlahMinggu: 12 },
              pendamping: { id: "user-3", nama: "Rina Pendamping" },
              mingguBerjalan: 6,
              targetMingguan: 18000000,
              laporanMingguIni: null,
            },
          },
        }),
      });
      return;
    }
    if (path === "/panel/operasional/laporan-saya") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            { id: "eeeeeeee-eeee-4eee-8eee-000000000001", mingguKe: 4, omzet: 20100000, jumlahTransaksi: 55, target: 18000000, status: "disetujui", catatanPendamping: "Konsisten", dikirimPada: "2026-10-02T05:00:00.000Z", diverifikasiPada: "2026-10-03T05:00:00.000Z", bukti: { id: "44444444-4444-4444-8444-000000000001" } },
            { id: "eeeeeeee-eeee-4eee-8eee-000000000002", mingguKe: 5, omzet: 21000000, jumlahTransaksi: 58, target: 18000000, status: "menunggu", catatanPendamping: null, dikirimPada: "2026-10-02T05:00:00.000Z", diverifikasiPada: null, bukti: { id: "44444444-4444-4444-8444-000000000001" } },
          ],
        }),
      });
      return;
    }
    if (path === "/panel/operasional/laporan" && request.method() === "POST") {
      const body = request.postDataJSON() || {};
      globalThis.__y03Laporan = globalThis.__y03Laporan ?? { count: 0, seen: new Set() };
      if (body.mingguKe === 99) {
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ errors: [{ message: "Validasi gagal", extensions: { code: "VALIDATION_FAILED" } }] }) });
        return;
      }
      const dikirim = body.dikirimPada ? new Date(body.dikirimPada) : new Date();
      const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "long" }).format(dikirim);
      if (weekday !== "Friday") {
        await route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ errors: [{ message: "Laporan hanya dapat dibuat pada hari Jumat (WIB).", extensions: { code: "BUKAN_JUMAT" } }] }) });
        return;
      }
      if (globalThis.__y03Laporan.seen.has(body.clientUuid)) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id: "eeeeeeee-eeee-4eee-8eee-000000000001", mingguKe: body.mingguKe, status: "menunggu" }, meta: { idempoten: true } }) });
        return;
      }
      globalThis.__y03Laporan.seen.add(body.clientUuid);
      globalThis.__y03Laporan.count += 1;
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { id: "eeeeeeee-eeee-4eee-8eee-000000000001", mingguKe: body.mingguKe, omzet: body.omzet, status: "menunggu" } }) });
      return;
    }
    if (path === "/panel/operasional/binaan") {
      const mk = (id, nama, pemilik, statusMinggu) => ({
        talentaId: id, usaha: { id: `u-${id.slice(0, 4)}`, nama }, pemilik, kota: "KABUPATEN SUBANG",
        batch: { nama: "Batch 1" }, status: "accelerator", mingguBerjalan: 6, jumlahMinggu: 12,
        targetMingguan: 18000000, statusMingguIni: statusMinggu, rekomendasiPitching: false, layakRekomendasi: id.endsWith("1"),
      });
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          data: [
            mk("bbbbbbbb-bbbb-4bbb-8bbb-000000000001", "Wawan Leathercraft", "Wawan Setiawan", "menunggu"),
            mk("bbbbbbbb-bbbb-4bbb-8bbb-000000000002", "Tahu Sumedang Bu Ika", "Ika Kartika", "belum"),
            mk("bbbbbbbb-bbbb-4bbb-8bbb-000000000003", "Sambal Subang Mantap", "Yudi Permana", "disetujui"),
          ],
        }),
      });
      return;
    }
    if (path === "/panel/operasional/binaan/antrean") {
      const status = url.searchParams.get("status") || "menunggu";
      const base = { talentaId: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001", usaha: { id: "u-1", nama: "Wawan Leathercraft" }, mingguKe: 5, omzet: 21000000, target: 18000000, capaianPersen: 116.7, dikirimPada: "2026-10-02T05:00:00.000Z" };
      let data = [];
      if (status === "menunggu") data = [{ ...base, laporanId: "eeeeeeee-eeee-4eee-8eee-000000000001", status: "menunggu" }];
      else if (status === "disetujui") data = [{ ...base, laporanId: "eeeeeeee-eeee-4eee-8eee-000000000002", status: "disetujui" }];
      else data = [{ talentaId: base.talentaId, usaha: base.usaha, mingguKe: 6, status: "belum" }];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
      return;
    }
    const lapMatch = path.match(/^\/panel\/operasional\/laporan\/([0-9a-f-]{36})(\/verifikasi)?$/i);
    if (lapMatch) {
      if (lapMatch[2] === "/verifikasi" && request.method() === "POST") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { laporanId: lapMatch[1], status: "disetujui" } }) });
        return;
      }
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          data: {
            laporanId: lapMatch[1], talentaId: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001",
            usaha: { id: "u-1", nama: "Wawan Leathercraft" }, pemilik: "Wawan Setiawan",
            mingguKe: 5, omzet: 21000000, jumlahTransaksi: 58, target: 18000000, capaianPersen: 116.7,
            catatanKendala: null, bukti: { id: "44444444-4444-4444-8444-000000000001", tipe: "image/png" },
            status: "menunggu", catatanPendamping: null,
            dikirimPada: "2026-10-02T05:00:00.000Z", diverifikasiOleh: null, diverifikasiPada: null,
          },
        }),
      });
      return;
    }
    const binaanMatch = path.match(/^\/panel\/operasional\/binaan\/([0-9a-f-]{36})(\/rekomendasi)?$/i);
    if (binaanMatch) {
      const tren = Array.from({ length: 12 }, (_, i) => ({
        mingguKe: i + 1,
        target: 18000000,
        realisasi: i < 5 ? [16500000, 18200000, 19000000, 20100000, 21000000][i] ?? null : null,
        status: i < 4 ? "disetujui" : i === 4 ? "menunggu" : "belum",
      }));
      if (binaanMatch[2] === "/rekomendasi") {
        const body = request.postDataJSON() || {};
        const aktif = body.aktif !== false;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {
          talentaId: binaanMatch[1], usaha: { id: "u-1", nama: "Wawan Leathercraft" }, pemilik: "Wawan Setiawan",
          batch: { id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001", nama: "Batch 1", tahap: "accelerator" },
          status: "accelerator", mingguBerjalan: 6, jumlahMinggu: 12, targetMingguan: 18000000,
          tren,
          laporan: tren.filter((t) => t.realisasi !== null).map((t, i) => ({
            id: `eeeeeeee-eeee-4eee-8eee-00000000000${i + 1}`, mingguKe: t.mingguKe, omzet: t.realisasi,
            jumlahTransaksi: 50, target: 18000000,
            capaianPersen: Math.round((t.realisasi / 18000000) * 1000) / 10, status: t.status,
            catatanPendamping: null, dikirimPada: "2026-10-02T05:00:00.000Z", diverifikasiPada: "2026-10-03T05:00:00.000Z",
          })),
          rekomendasiPitching: aktif, rekomendasiOleh: aktif ? "user-3" : null, rekomendasiPada: aktif ? "2026-10-03T05:00:00.000Z" : null, layakRekomendasi: true,
        } }) });
        return;
      }
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          data: {
            talentaId: binaanMatch[1], usaha: { id: "u-1", nama: "Wawan Leathercraft" }, pemilik: "Wawan Setiawan",
            batch: { id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001", nama: "Batch 1", tahap: "accelerator" },
            status: "accelerator", mingguBerjalan: 6, jumlahMinggu: 12, targetMingguan: 18000000,
            tren,
            laporan: tren.filter((t) => t.realisasi !== null).map((t, i) => ({
              id: `eeeeeeee-eeee-4eee-8eee-00000000000${i + 1}`, mingguKe: t.mingguKe, omzet: t.realisasi,
              jumlahTransaksi: 50, target: 18000000,
              capaianPersen: Math.round((t.realisasi / 18000000) * 1000) / 10, status: t.status,
              catatanPendamping: null, dikirimPada: "2026-10-02T05:00:00.000Z", diverifikasiPada: "2026-10-03T05:00:00.000Z",
            })),
            rekomendasiPitching: false, rekomendasiOleh: null, rekomendasiPada: null, layakRekomendasi: true,
          },
        }),
      });
      return;
    }
    if (path === "/panel/operasional/batch") {
      if (request.method() === "POST") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001" } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001", kode: "ACC-2026-B1", nama: "Batch 1", tahap: "accelerator", tanggalMulai: "2026-09-28", jumlahMinggu: 12, faktorTarget: 1.2, jumlahPeserta: 3 }] }) });
      return;
    }
    if (path === "/panel/operasional/pendamping") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ id: "user-3", nama: "Rina Pendamping", email: "dummy_coach.pendamping@jabarprov.go.id" }] }) });
      return;
    }
    if (path === "/panel/operasional/akselerasi/peserta") {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          data: [
            { talentaId: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001", usaha: { id: "u-1", nama: "Wawan Leathercraft" }, kota: "KABUPATEN SUBANG", status: "accelerator", batch: { id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001", nama: "Batch 1", tahap: "accelerator" }, pendamping: { id: "user-3", nama: "Rina" }, mingguBerjalan: 6, jumlahMinggu: 12, targetMingguan: 18000000, rekomendasiPitching: true, laporanTerakhir: { mingguKe: 5, status: "menunggu" } },
            { talentaId: "bbbbbbbb-bbbb-4bbb-8bbb-000000000002", usaha: { id: "u-2", nama: "Kopi Gunung Garut" }, kota: "KABUPATEN GARUT", status: "talent_lab", batch: { id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002", nama: "TL 1", tahap: "talent_lab" }, pendamping: null, mingguBerjalan: 2, jumlahMinggu: 4, targetMingguan: null, rekomendasiPitching: false, laporanTerakhir: null },
          ],
        }),
      });
      return;
    }
    const tahapMatch = path.match(/^\/panel\/operasional\/talenta\/([0-9a-f-]{36})\/tahap$/i);
    if (tahapMatch && request.method() === "POST") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id: tahapMatch[1], status: "accelerator" } }) });
      return;
    }
    const berkasMatch = path.match(/^\/panel\/operasional\/berkas\/([0-9a-f-]{36})$/i);
    if (berkasMatch) {
      await route.fulfill({
        status: 200, headers: { "content-type": "image/png" },
        body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
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
  const issuedAt = Math.floor(Date.now() / 1000);
  await page.context().addCookies(SESSION_POLICY_COOKIES.map((name) => ({
    name,
    value: `${issuedAt}.${createHmac("sha256", SESSION_POLICY_SECRET).update(`${name}.${issuedAt}`).digest("base64url")}`,
    url: new URL(page.url()).origin,
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  })));
  await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 10000 });
}

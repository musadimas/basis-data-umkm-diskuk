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

export async function installMockDirectus(
  page,
  { authenticated = false, renderMap = false, spatialTileset = null, serveSpatialTiles = false } = {},
) {
  let loggedIn = authenticated;
  if (serveSpatialTiles) await installSpatialTileArchive(page);
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
    if (path === "/panel/users/me") {
      if (!loggedIn) {
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
                "/admin/content/usaha/11111111-1111-4111-8111-111111111111",
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });
}

export async function loginMock(page, returnTo = "/dashboard") {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email").waitFor({ state: "visible", timeout: 15000 });
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
  await page.getByLabel("Email").fill("analyst@example.invalid");
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
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((url) => url.pathname === returnTo, { timeout: 10000 });
}

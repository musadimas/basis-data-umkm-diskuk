import { expect, test } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

test("spasial applies filters to the point layer", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true });
  await loginMock(page, "/dashboard/spasial");

  await expect(page.getByText(/Menampilkan 4 titik dari 12 UMKM/)).toBeVisible();

  await page.getByRole("button", { name: "Buka filter data" }).click();
  const applyButton = page.getByRole("button", { name: "Terapkan Filter" });
  await expect(applyButton).toBeEnabled();

  await page.getByRole("combobox", { name: "Skala Usaha" }).click();
  await page.getByRole("option", { name: "Mikro", exact: true }).click();

  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/panel/tabular/spasial" && url.searchParams.get("skala") === "micro";
  });
  await applyButton.click();
  await filteredRequest;

  await expect(page.getByText(/Menampilkan 3 titik dari 3 UMKM/)).toBeVisible();
  await expect(page.getByLabel("Jumlah filter aktif")).toHaveText("1");
});

test("spasial serves all unfiltered points from a healthy PMTiles tileset", async ({ page }) => {
  const pointRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/panel/tabular/spasial") pointRequests.push(url.search);
  });

  await installMockDirectus(page, {
    authenticated: true,
    spatialTileset: { url: "/tiles/current.pmtiles", updatedAt: "2026-08-17T00:30:00Z", pointCount: 123456 },
    serveSpatialTiles: true,
  });
  await loginMock(page, "/dashboard/spasial");

  // Mode tileset: semua titik tampil tanpa batas, kontrol batas titik disembunyikan.
  await expect(page.getByText(/Menampilkan semua 123\.456 titik berkoordinat \(tileset\)/)).toBeVisible();
  await expect(page.getByLabel("Batas Titik")).toBeHidden();
  expect(pointRequests).toHaveLength(0);

  // Filter skala tidak bisa me-recluster tileset statis → kembali ke GeoJSON.
  await page.getByRole("button", { name: "Buka filter data" }).click();
  await page.getByRole("combobox", { name: "Skala Usaha" }).click();
  await page.getByRole("option", { name: "Mikro", exact: true }).click();

  const fallbackRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/panel/tabular/spasial" && url.searchParams.get("skala") === "micro";
  });
  await page.getByRole("button", { name: "Terapkan Filter" }).click();
  await fallbackRequest;
  await expect(page.getByText(/Menampilkan 3 titik dari 3 UMKM/)).toBeVisible();
});

test("spasial falls back to GeoJSON when the PMTiles archive fails", async ({ page }) => {
  await installMockDirectus(page, {
    authenticated: true,
    spatialTileset: { url: "/tiles/missing.pmtiles", updatedAt: "2026-08-17T00:30:00Z", pointCount: 123456 },
  });
  const fallbackRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname === "/panel/tabular/spasial");

  await loginMock(page, "/dashboard/spasial");
  await fallbackRequest;

  await expect(page.getByText(/Menampilkan 4 titik dari 12 UMKM/)).toBeVisible();
  await expect(page.getByText(/Menampilkan semua 123\.456 titik/)).toBeHidden();
});

test("spasial sends the applied kelurahan and keeps it as the back boundary", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true });
  await loginMock(page, "/dashboard/spasial");

  await page.getByRole("button", { name: "Buka filter data" }).click();
  await page.getByRole("combobox", { name: "Kabupaten/Kota" }).click();
  await page.getByRole("option", { name: "Kabupaten Bogor" }).click();
  await page.getByRole("combobox", { name: "Kecamatan" }).click();
  await page.getByRole("option", { name: "Cibinong" }).click();
  await page.getByRole("combobox", { name: "Desa/Kelurahan" }).click();
  await page.getByRole("option", { name: "Pakansari" }).click();

  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/panel/tabular/spasial"
      && url.searchParams.get("kota") === "1"
      && url.searchParams.get("kecamatan") === "11"
      && url.searchParams.get("kelurahan") === "111";
  });
  await page.getByRole("button", { name: "Terapkan Filter" }).click();
  await filteredRequest;

  await expect(page.getByLabel("Jumlah filter aktif")).toHaveText("3");
  await expect(page.getByRole("button", { name: "Kembali ke level sebelumnya" })).toBeHidden();
});

test("spasial zoom controls do not overlap the filter FAB", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true });
  await loginMock(page, "/dashboard/spasial");

  const fabBox = await page.getByRole("button", { name: "Buka filter data" }).boundingBox();
  const zoomInBox = await page.getByRole("button", { name: "Perbesar peta" }).boundingBox();
  const zoomOutBox = await page.getByRole("button", { name: "Perkecil peta" }).boundingBox();
  expect(fabBox).not.toBeNull();
  expect(zoomInBox).not.toBeNull();
  expect(zoomOutBox).not.toBeNull();
  if (!fabBox || !zoomInBox || !zoomOutBox) return;

  for (const zoomBox of [zoomInBox, zoomOutBox]) {
    const overlaps = !(
      fabBox.x + fabBox.width <= zoomBox.x ||
      zoomBox.x + zoomBox.width <= fabBox.x ||
      fabBox.y + fabBox.height <= zoomBox.y ||
      zoomBox.y + zoomBox.height <= fabBox.y
    );
    expect(overlaps).toBe(false);
  }
});

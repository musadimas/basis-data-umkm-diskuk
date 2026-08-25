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

test("spasial serves all points from the PMTiles tileset when only skala filters apply", async ({ page }) => {
  const pointRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/panel/tabular/spasial") pointRequests.push(url.search);
  });

  await installMockDirectus(page, {
    authenticated: true,
    spatialTileset: { url: "/tiles/current.pmtiles", updatedAt: "2026-08-17T00:30:00Z", pointCount: 123456 },
  });
  await loginMock(page, "/dashboard/spasial");

  // Mode tileset: semua titik tampil tanpa batas, kontrol batas titik disembunyikan.
  await expect(page.getByText(/Menampilkan semua 123\.456 titik berkoordinat \(tileset\)/)).toBeVisible();
  await expect(page.getByLabel("Batas Titik")).toBeHidden();
  expect(pointRequests).toHaveLength(0);

  // Filter KBLI tidak bisa dilayani tileset statis → kembali ke endpoint GeoJSON.
  await page.getByRole("button", { name: "Buka filter data" }).click();
  await page.getByRole("combobox", { name: "Kode KBLI" }).click();
  await page.getByRole("option", { name: "47112" }).click();

  const fallbackRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/panel/tabular/spasial" && url.searchParams.get("kbli") === "47112";
  });
  await page.getByRole("button", { name: "Terapkan Filter" }).click();
  await fallbackRequest;
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

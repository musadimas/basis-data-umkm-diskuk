import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

test("infografis renders the combined scale summary with NIB and marketing breakdowns", async ({
  page,
}) => {
  await installMockDirectus(page, { authenticated: true });
  await loginMock(page, "/dashboard");

  // Seksi "Data UMKM": tab default "Berdasarkan Kategori" (tabel kategori KBLI).
  const dataUmkmSection = page.locator("#data-umkm");
  await expect(
    dataUmkmSection.getByRole("heading", { name: /^Data UMKM/ }),
  ).toBeVisible();
  await expect(
    dataUmkmSection.getByRole("tab", { name: "Berdasarkan Kategori" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("cell", { name: /Perdagangan Besar dan Eceran/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: /Industri Pengolahan/ }),
  ).toBeVisible();

  // Tab "Data UMKM": tabel baris lengkap (25 baris default, semua 12 baris muat satu halaman).
  await dataUmkmSection.getByRole("tab", { name: "Data UMKM" }).click();
  await expect(page.getByText("1–12 dari 12 data")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Usaha 01", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Skala yang dilaporkan")).toBeVisible();
  const summary = page.getByLabel(
    "Rincian skala usaha, kepemilikan NIB, dan metode pemasaran",
  );
  await expect(summary).toBeVisible();
  await expect(summary.getByText("Kepemilikan NIB")).toBeVisible();
  await expect(
    summary.getByText("Memiliki NIB", { exact: true }),
  ).toBeVisible();
  await expect(summary.getByText(/^Metode Pemasaran/)).toBeVisible();
  await expect(
    summary.getByTitle("Non-digital", { exact: true }),
  ).toBeVisible();
});

test("infografis applies the reusable compact filter FAB", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installMockDirectus(page, { authenticated: true, renderMap: true });
  await loginMock(page, "/dashboard");

  const filterButton = page.getByRole("button", { name: "Buka filter data" });
  const mapCanvas = page.locator(".maplibregl-canvas");
  await expect(mapCanvas).toBeVisible();
  await mapCanvas.evaluate((element) =>
    element.scrollIntoView({ block: "end" }),
  );
  await expect(filterButton).toBeVisible();
  const buttonBox = await filterButton.boundingBox();
  const topElementLabel = await page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest("button")
        ?.getAttribute("aria-label"),
    {
      x: (buttonBox?.x ?? 0) + (buttonBox?.width ?? 0) / 2,
      y: (buttonBox?.y ?? 0) + (buttonBox?.height ?? 0) / 2,
    },
  );
  expect(topElementLabel).toBe("Buka filter data");

  await filterButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox")).toHaveCount(6);
  const box = await dialog.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  expect(box?.height).toBeLessThanOrEqual(812);

  await dialog.getByRole("combobox", { name: "Skala Usaha" }).click();
  await page.getByRole("option", { name: "Mikro", exact: true }).click();

  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/panel/v1/analytics/infographic/" &&
      url.searchParams.get("skala") === "micro"
    );
  });
  await dialog.getByRole("button", { name: "Terapkan Filter" }).click();
  await filteredRequest;

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(filterButton).toContainText("1");
});

test("infografis keeps the filter FAB interactive after a full reload", async ({
  page,
}) => {
  await installMockDirectus(page, { authenticated: true });
  await loginMock(page, "/dashboard");
  await page.reload();

  await page.getByRole("button", { name: "Buka filter data" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

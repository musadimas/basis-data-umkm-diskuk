import { expect, test } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

test("tabular renders rows and supports forward and backward pagination", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true });
  await loginMock(page, "/dashboard/tabular");

  await expect(page.getByRole("heading", { name: "Data Tabular UMKM" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Usaha 01", exact: true })).toBeVisible();
  // Default 25 baris/halaman; turunkan ke 10 agar paginasi bisa diuji.
  await page.getByRole("combobox", { name: "Baris per halaman" }).click();
  await page.getByRole("option", { name: "10", exact: true }).click();
  await expect(page.getByText("1–10 dari 12 data")).toBeVisible();

  const secondPageRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/panel/v1/analytics/tabular/" && url.searchParams.get("page") === "2";
  });
  await page.getByRole("button", { name: "Halaman berikutnya" }).click();
  await secondPageRequest;
  await expect(page.getByRole("cell", { name: "Usaha 11", exact: true })).toBeVisible();
  await expect(page.getByText("11–12 dari 12 data")).toBeVisible();

  const firstPageRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/panel/v1/analytics/tabular/" && url.searchParams.get("page") === "1";
  });
  await page.getByRole("button", { name: "Halaman sebelumnya" }).click();
  await firstPageRequest;
  await expect(page.getByRole("cell", { name: "Usaha 01", exact: true })).toBeVisible();
});

test("tabular applies filters and links each row to its UMKM profile", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true });
  await loginMock(page, "/dashboard/tabular");

  await page.getByRole("combobox", { name: "Skala Usaha" }).click();
  await page.getByRole("option", { name: "Mikro", exact: true }).click();

  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/panel/v1/analytics/tabular/" && url.searchParams.get("skala") === "micro";
  });
  await page.getByRole("button", { name: "Terapkan" }).click();
  await filteredRequest;

  await expect(page.getByText("1–8 dari 8 data")).toBeVisible();

  await page.getByRole("button", { name: "Aksi untuk Usaha 01" }).click();
  const profileLink = page.getByRole("menuitem", { name: "Lihat Profil UMKM" });
  await expect(profileLink).toHaveAttribute(
    "href",
    "/dashboard/umkm/11111111-1111-4111-8111-000000000001",
  );
});

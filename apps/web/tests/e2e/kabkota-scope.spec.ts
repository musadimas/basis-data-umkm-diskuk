import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

/**
 * Scoping wilayah Admin Kab/Kota pasca-merge (Y01):
 * app_role kabkota + kota_scope angka terkunci via lockedKotaId();
 * filter kota terkunci, request infografis/tabular membawa kota terkunci.
 */
test.describe("kabkota locked kota scope", () => {
  test("infografis is locked to the admin's kota", async ({ page }, testInfo) => {
    await installMockDirectus(page, { authenticated: true, role: "kabkota" });
    await loginMock(page, "/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);

    // Terapkan satu filter non-kota untuk memicu refetch infografis;
    // URL permintaan wajib membawa kota=1 (kota terkunci admin).
    const filterButton = page.getByRole("button", { name: "Buka filter data" });
    await expect(filterButton).toBeVisible();
    await filterButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Skala Usaha").click();
    await page.getByRole("option", { name: "Mikro", exact: true }).click();

    const infografisRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/panel/v1/analytics/infographic/" &&
        url.searchParams.get("skala") === "micro"
      );
    });
    await dialog.getByRole("button", { name: "Terapkan Filter" }).click();
    const request = await infografisRequest;
    expect(new URL(request.url()).searchParams.get("kota")).toBe("1");
    await expect(dialog).toBeHidden();

    // Dropdown Kabupaten/Kota nonaktif dan menampilkan kota terkunci.
    await filterButton.click();
    const kotaSelect = dialog.getByLabel("Kabupaten/Kota");
    await expect(kotaSelect).toBeDisabled();
    await expect(dialog).toContainText("Kabupaten Bogor");
    await page.keyboard.press("Escape");

    await page.screenshot({ path: testInfo.outputPath("infografis-kabkota.png") });
  });

  test("tabular kota select is disabled for kabkota", async ({ page }) => {
    await installMockDirectus(page, { authenticated: true, role: "kabkota" });
    // Navigasi klien-side agar opsi filter ter-intercept browser (bukan kosong dari SSR).
    await loginMock(page, "/dashboard/tabular");
    const kotaSelect = page.getByLabel("Kabupaten/Kota");
    await expect(kotaSelect).toBeDisabled();
    await expect(page.getByText("Kabupaten Bogor").first()).toBeVisible();
  });

  test("spasial kota select is locked for kabkota (B39)", async ({ page }) => {
    await installMockDirectus(page, { authenticated: true, role: "kabkota" });
    await loginMock(page, "/dashboard/spasial");
    await page.getByRole("button", { name: "Buka filter data" }).click();
    // Kunci wilayah kini datang dari useTabularFilters, bukan hanya TabularData.
    await expect(page.getByLabel("Kabupaten/Kota")).toBeDisabled();
    await expect(page.getByText("Kabupaten Bogor").first()).toBeVisible();
  });
});

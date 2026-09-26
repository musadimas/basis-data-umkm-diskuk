import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

/**
 * Matriks role Y01 pada mock Directus: beranda per role, guard route,
 * badge header, menu profil, login NIB, dan halaman spasial provinsi.
 */
test.describe("role matrix Y01", () => {
  test("provinsi lands on /dashboard with data menu and Admin Provinsi badge", async ({ page }, testInfo) => {
    await installMockDirectus(page, { authenticated: true, role: "provinsi" });
    await loginMock(page, "/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("link", { name: "Analitik" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Data Tabular UMKM" })).toBeVisible();
    await expect(page.getByText("Admin Provinsi")).toBeVisible();
    // Y01 M1-03: header menampilkan instansi dari sesi server, bukan hanya nama.
    await expect(page.getByText("DISKUK Provinsi Jawa Barat").first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("dashboard-header-provinsi.png") });
  });

  test("pendamping is redirected to the binaan home and cannot open analitik", async ({ page }, testInfo) => {
    await installMockDirectus(page, { authenticated: true, role: "pendamping" });
    await loginMock(page, "/dashboard", "/dashboard/binaan");
    await expect(page).toHaveURL(/\/dashboard\/binaan$/);
    await expect(page.getByRole("link", { name: "Dasbor Binaan Aktif" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Analitik" })).toHaveCount(0);
    await page.goto("/dashboard/analitik");
    await expect(page).toHaveURL(/\/dashboard\/binaan$/);
    await expect(page.getByText("Admin Provinsi")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("dashboard-header-pendamping.png") });
  });

  test("umkm lands on /dashboard/usaha inside the phone frame", async ({ page }, testInfo) => {
    await installMockDirectus(page, { authenticated: true, role: "umkm" });
    await loginMock(page, "/dashboard", "/dashboard/usaha");
    await expect(page.getByTestId("umkm-frame")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Beranda Usaha" })).toBeVisible();
    await expect(page.getByTestId("umkm-frame").getByRole("main").getByText("Wawan Leathercraft")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("umkm-beranda.png") });
  });

  test("kabkota lands on the full data dashboard (final phase 3 state)", async ({ page }, testInfo) => {
    await installMockDirectus(page, { authenticated: true, role: "kabkota" });
    await loginMock(page, "/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Admin Kab/Kota")).toBeVisible();
    await expect(page.getByText("Dinas KUK Kabupaten Bogor").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Dasbor Kewilayahan" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Data Lapangan" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("dashboard-header-kabkota.png") });
  });

  test("profile dropdown opens akun and audit-sesi pages", async ({ page }) => {
    await installMockDirectus(page, { authenticated: true, role: "provinsi" });
    await loginMock(page, "/dashboard");

    await page.getByRole("button", { name: "Menu profil" }).click();
    await page.getByRole("menuitem", { name: "Pengaturan Akun & Keamanan" }).click();
    await expect(page).toHaveURL(/\/dashboard\/akun$/);
    await expect(page.getByRole("heading", { name: "Akun Saya" })).toBeVisible();

    await page.getByRole("button", { name: "Menu profil" }).click();
    await page.getByRole("menuitem", { name: "Log Aktivitas Sesi" }).click();
    await expect(page).toHaveURL(/\/dashboard\/audit-sesi$/);
    await expect(page.getByRole("heading", { name: /Log Aktivitas Sesi/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Masuk" })).toBeVisible();
  });

  test("NIB login resolves the usaha account and reaches the umkm home", async ({ page }) => {
    await installMockDirectus(page, { authenticated: false, role: "umkm" });
    await page.goto("/sign-in?returnTo=/dashboard");
    await page.getByLabel("Email / NIB").waitFor({ state: "visible", timeout: 15000 });
    // Bukti hidrasi: toggle sandi mengubah tipe input sebelum nilai diisi.
    const passwordInput = page.locator("#password");
    const passwordToggle = page.getByRole("button", { name: "Tampilkan kata sandi" });
    await passwordToggle.click();
    // Dev server cold-hydration bisa lambat; beri waktu cukup.
    await expect(passwordInput).toHaveAttribute("type", "text", { timeout: 20000 });
    await page.getByRole("button", { name: "Sembunyikan kata sandi" }).click();

    await page.getByLabel("Email / NIB").fill("9900000000001");
    await page.getByRole("textbox", { name: "Kata sandi" }).fill("not-a-real-secret");
    const loginRequest = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/login-nib" &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
    expect((await loginRequest).status()).toBe(200);
    await expect(page).toHaveURL(/\/dashboard\/usaha$/);
    await expect(page.getByTestId("umkm-frame")).toBeVisible();
  });

  test("provinsi spasial page renders inside the dashboard layout", async ({ page }, testInfo) => {
    await installMockDirectus(page, { authenticated: true, role: "provinsi", renderMap: true, spatialTileset: null });
    // Navigasi klien-side langsung ke spasial agar data mock ter-intercept browser.
    await loginMock(page, "/dashboard/spasial");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("spasial-after.png") });
  });
});

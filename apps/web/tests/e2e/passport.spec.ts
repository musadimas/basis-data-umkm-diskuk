import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";
import { PASSPORT_KODE } from "../fixtures/katalog-data.mjs";
import { createProgramState, installMockProgram } from "../fixtures/mock-program.mjs";

test.describe("Modul 6 · Talent Passport", () => {
  test("a curator issues a passport with a downloadable QR code and radar", async ({ page }) => {
    const state = createProgramState();
    state.usaha.talentStatus = "talent_pool";
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/usaha/passport");

    await page.getByLabel("Cari usaha").fill("Usaha 01");
    await page.getByRole("button", { name: "Cari" }).click();
    await page.getByRole("button", { name: "Buka passport" }).click();
    await page.getByRole("button", { name: "Terbitkan Talent Passport" }).click();

    await expect(page.getByText(`Talent Passport ${PASSPORT_KODE} diterbitkan.`)).toBeVisible();
    await expect(page.getByTestId("passport-kode")).toHaveText(PASSPORT_KODE);
    await expect(page.getByText("Talent Pool Jawa Barat")).toBeVisible();
    const qr = page.getByAltText(`QR verifikasi ${PASSPORT_KODE}`);
    await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/);
    await expect(page.getByRole("link", { name: "Unduh QR (PNG)" })).toHaveAttribute("download", `talent-passport-${PASSPORT_KODE}.png`);
    await expect(page.getByRole("img", { name: /Radar skor: Finansial 35, Pasar 100/ })).toBeVisible();
  });

  test("a business outside the talent pool cannot get a passport yet", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/usaha/passport");
    await page.getByLabel("Cari usaha").fill("Usaha 01");
    await page.getByRole("button", { name: "Cari" }).click();
    await page.getByRole("button", { name: "Buka passport" }).click();
    await expect(page.getByText("Usaha belum masuk Talent Pool.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Terbitkan Talent Passport" })).toBeDisabled();
  });

  test("the public page shows a verified passport and its portfolio tabs", async ({ page }) => {
    await installMockDirectus(page);
    await page.goto(`/passport/${PASSPORT_KODE.toLowerCase()}`);
    await expect(page.getByText("Terverifikasi: tanda tangan digital DISKUK Jawa Barat valid")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keripik Siti" })).toBeVisible();
    await expect(page.getByText("Halal: Terverifikasi")).toBeVisible();

    await expect(async () => {
      await page.getByRole("tab", { name: "Spesifikasi Teknis" }).click();
      await expect(page.getByText("20 x 10 x 5 cm")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await page.getByRole("tab", { name: "Video" }).click();
    await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]')).toBeAttached();
  });

  test("a tampered or unknown passport is reported, not shown", async ({ page }) => {
    await installMockDirectus(page);
    await page.goto("/passport/TP0000000000");
    await expect(page.getByRole("heading", { name: "Talent Passport tidak valid" })).toBeVisible();
    await expect(page.getByText("Keripik Siti")).toHaveCount(0);
    await page.goto("/passport/TPZZZZZZZZZZ");
    await expect(page.getByRole("heading", { name: "Talent Passport tidak ditemukan" })).toBeVisible();
  });
});

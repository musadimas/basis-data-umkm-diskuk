// Login lewat form asli untuk spec real-API (`*.directus.spec.ts`): server mewajibkan ALTCHA, jadi
// widget harus benar-benar menyelesaikan tantangan sebelum tombol ditekan. Hidrasi Nuxt dapat
// menghapus isian yang diketik terlalu dini, karena itu pengisian diulang sampai widget terverifikasi.
import { expect, type Page } from "@playwright/test";

export async function loginReal(page: Page, identifier: string, password: string, returnTo = "/dashboard") {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.waitForLoadState("networkidle");
  const widget = page.locator("altcha-widget .altcha");
  await expect(async () => {
    await page.getByLabel("Email atau NIB").fill(identifier);
    await page.getByRole("textbox", { name: "Kata sandi" }).fill(password);
    await expect(page.getByLabel("Email atau NIB")).toHaveValue(identifier, { timeout: 1000 });
    if ((await widget.getAttribute("data-state")) !== "verified") await page.locator("altcha-widget label").click();
    await expect(widget).toHaveAttribute("data-state", "verified", { timeout: 15_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
  // Pathname, bukan regex URL: `/sign-in?returnTo=/dashboard` juga memuat "/dashboard".
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 30_000 });
}

export async function keluarReal(page: Page) {
  await page.getByRole("button", { name: "Menu akun" }).click();
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
}

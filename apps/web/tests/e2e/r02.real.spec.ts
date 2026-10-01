import { expect, test } from "@playwright/test";

const password = process.env.R02_BROWSER_PASSWORD || "";
const enabled = process.env.PLAYWRIGHT_USE_REAL_API === "1" && Boolean(password);

async function login(page: import("@playwright/test").Page, email: string, returnTo: string) {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email atau NIB").fill(email);
  await page.getByRole("textbox", { name: "Kata sandi" }).fill(password);
  await page.locator("altcha-widget label").click();
  await expect(page.locator("altcha-widget .altcha")).toHaveAttribute("data-state", "verified", { timeout: 20_000 });
  await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
  await page.waitForURL((url) => url.pathname === returnTo, { timeout: 20_000 });
}

test("R02 real API: executive monitoring shows verified data and red risk pin", async ({ page }, testInfo) => {
  test.skip(!enabled, "requires isolated disposable R02 stack and fixture password");
  await login(page, process.env.R02_PROVINCE_EMAIL || "dummy_admin@diskuk.jabarprov.go.id", "/dashboard/akselerasi");
  await expect(page.getByRole("heading", { name: "Monitoring Program Akselerasi" })).toBeVisible();
  await expect(page.getByText(/Target >95%/)).toBeVisible();
  await expect(page.getByTestId("kepatuhan-cakupan")).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Realisasi disetujui");
  await expect(page.getByTestId("at-risk-map")).toBeVisible();
  const fallbackPin = page.getByTestId("at-risk-map").locator("[data-risk-pin]");
  if (await fallbackPin.count()) await expect(fallbackPin).toHaveCount(1);
  else await expect(page.getByTestId("at-risk-map").locator("canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Buat tugas pendamping" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("r02-monitoring.png"), fullPage: true });
});

test("R02 real API: verified investor filters deals, opens card and downloads summary", async ({ page }, testInfo) => {
  test.skip(!enabled, "requires isolated disposable R02 stack and fixture password");
  await login(page, process.env.R02_INVESTOR_EMAIL || "r02-investor@example.com", "/investor");
  await page.getByLabel("Kebutuhan modal").selectOption("menengah");
  await page.getByLabel("Skema").selectOption("kur");
  await page.getByLabel("KBLI (awalan 2–5 digit)").fill(process.env.R02_INVESTOR_KBLI || "10794");
  await expect(page.getByRole("link", { name: "Lihat deal card" })).toHaveCount(1);
  await page.getByRole("link", { name: "Lihat deal card" }).click();
  await expect(page.getByRole("heading", { name: "Talent Index Score" })).toBeVisible();
  await expect(page.getByText("Deklarasi pelaku usaha")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh Executive Summary PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/^pdf-.*\.pdf$/);
  await page.getByPlaceholder("Jelaskan minat dan rencana kemitraan").fill("R02 browser fixture: minat kemitraan terverifikasi.");
  await page.getByRole("button", { name: "Kirim LOI" }).click();
  await expect(page.getByText("LOI tercatat dan dapat ditindaklanjuti kurator.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("r02-deal-card.png"), fullPage: true });
});

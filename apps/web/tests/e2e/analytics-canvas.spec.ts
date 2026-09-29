import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";
test.describe("canvas analitik", () => {
  test("manual controls wait for Terapkan while canvas selection applies immediately", async ({
    page,
  }) => {
    await installMockDirectus(page, { authenticated: true });
    const queryRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/panel/v1/analytics/analysis/query"))
        queryRequests.push(request.postData() || "");
    });
    await loginMock(page, "/dashboard/analitik");
    await expect(
      page.getByRole("heading", { name: "Kanvas analitik" }),
    ).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Kabupaten Bogor" }),
    ).toBeVisible();
    const initial = queryRequests.length;
    await page
      .getByLabel("Kelompokkan menurut")
      .selectOption("skala_dilaporkan");
    expect(queryRequests.length).toBe(initial);
    await page.getByRole("button", { name: "Terapkan" }).click();
    await expect.poll(() => queryRequests.length).toBeGreaterThan(initial);
    await page.getByRole("button", { name: /Kabupaten Bogor/ }).click();
    await expect(page.getByLabel("Filter aktif")).toContainText("Skala");
    await expect.poll(() => queryRequests.length).toBeGreaterThan(initial + 1);
    expect(new URL(page.url()).search).not.toMatch(/nik|phone|telepon|record/i);
  });
  test("visual selection lives on the canvas and applies immediately", async ({
    page,
  }) => {
    await installMockDirectus(page, { authenticated: true });
    await loginMock(page, "/dashboard/analitik");
    await expect(page.getByLabel("Ganti visual")).toBeVisible();
    await expect(page.getByLabel("Tampilan")).toHaveCount(0);
    await page.getByLabel("Ganti visual").selectOption("donut");
    await expect(
      page.getByRole("heading", { name: "Visualisasi donat" }),
    ).toBeVisible();
    await expect
      .poll(() => new URL(page.url()).search)
      .toContain("visual=donut");
  });
  test("financial metric is formatted as aggregate currency with explicit null coverage", async ({
    page,
  }) => {
    await installMockDirectus(page, { authenticated: true });
    await loginMock(page, "/dashboard/analitik");
    await page
      .getByLabel("Metrik", { exact: true })
      .selectOption("omzet_tahunan");
    await page.getByRole("button", { name: "Terapkan" }).click();
    await expect(page.getByLabel("Ringkasan metrik")).toContainText("Rp");
    await expect(page.getByLabel("Ringkasan metrik")).toContainText(
      "NULL, tidak dianggap nol",
    );
    await expect(
      page.getByText("memiliki nilai yang dapat diagregasi"),
    ).toBeVisible();
  });
  test("keyboard and table alternative are present on mobile", async ({
    page,
  }) => {
    await installMockDirectus(page, { authenticated: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await loginMock(page, "/dashboard/analitik");
    await page.getByRole("button", { name: "Lihat tabel" }).click();
    await expect(page.locator("#analytics-data-table")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
  });
  test("desktop canvas fits in one viewport", async ({ page }) => {
    await installMockDirectus(page, { authenticated: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginMock(page, "/dashboard/analitik");
    await expect(
      page.getByRole("heading", { name: "Kanvas analitik" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(720);
  });
  test("wheel over result panels continues scrolling the page", async ({
    page,
  }) => {
    await installMockDirectus(page, { authenticated: true });
    await page.setViewportSize({ width: 390, height: 600 });
    await loginMock(page, "/dashboard/analitik");
    for (const id of ["visual-title", "records-title"]) {
      const panel = page.locator(`section[aria-labelledby="${id}"]`);
      await panel.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -100));
      await panel.hover({ position: { x: 20, y: 100 } });
      const before = await page.evaluate(() => window.scrollY);
      await page.mouse.wheel(0, 100);
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(before);
    }
  });
  test("browser back and forward restore only applied URL state", async ({
    page,
  }) => {
    await installMockDirectus(page, { authenticated: true });
    await loginMock(page, "/dashboard/analitik");
    const group = page.getByLabel("Kelompokkan menurut");
    await group.selectOption("skala_dilaporkan");
    await page.getByRole("button", { name: "Terapkan" }).click();
    await expect
      .poll(() => new URL(page.url()).search)
      .toContain("skala_dilaporkan");
    await page.goBack();
    await expect(group).toHaveValue("kota_nama");
    await page.goForward();
    await expect(group).toHaveValue("skala_dilaporkan");
  });
});

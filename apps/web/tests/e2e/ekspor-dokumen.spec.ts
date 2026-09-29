import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";
import { PASSPORT_PAYLOAD } from "../fixtures/katalog-data.mjs";
import { USAHA_ID, createProgramState, installMockProgram } from "../fixtures/mock-program.mjs";

test("Canvas Analitik supports aggregate PPTX export option", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 1280) < 600, "Export dialog submit is not clickable at phone width");
  await installMockDirectus(page, { authenticated: true });
  await loginMock(page, "/dashboard/analitik");
  await expect(page.locator('section[aria-labelledby="visual-title"] svg').first()).toBeVisible();

  await page.getByRole("button", { name: "Ekspor" }).click();
  const dialog = page.getByRole("dialog", { name: "Ekspor privat" });
  await expect(dialog).toBeVisible();

  const formatSelect = dialog.getByLabel("Format");
  await expect(formatSelect.locator('option[value="aggregate_pptx"]')).toHaveText("Slide PPT (rapat pimpinan)");

  await formatSelect.selectOption("aggregate_pptx");
  await dialog.getByLabel("Judul dokumen").fill("Rapat Pimpinan Triwulan III");

  const exportRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/panel/v1/analytics/analysis/exports" && request.method() === "POST";
  });

  await dialog.getByRole("button", { name: "Mulai ekspor" }).click();
  const req = await exportRequest;
  const postData = req.postDataJSON();
  expect(postData.exportType).toBe("aggregate_pptx");
  // Judul dokumen ikut dikirim supaya worker tidak memakai judul bawaan (B26).
  expect(postData.title).toBe("Rapat Pimpinan Triwulan III");

  const downloadLink = dialog.getByRole("link", { name: "Unduh" });
  await expect(downloadLink).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    downloadLink.click(),
  ]);

  const filePath = (await download.path())!;
  const content = await readFile(filePath);
  expect(content.subarray(0, 2).toString("latin1")).toBe("PK");
});

test("Talent Passport allows downloading Executive Summary PDF and Katalog Ekspor PDF", async ({ page }) => {
  const state = createProgramState();
  state.usaha.talentStatus = "talent_pool";
  state.passport = {
    id: "99999999-9999-4999-8999-000000000001",
    kode: PASSPORT_PAYLOAD.kode,
    status: "aktif",
    statusBadge: PASSPORT_PAYLOAD.statusBadge,
    skor: PASSPORT_PAYLOAD.skor,
    payload: PASSPORT_PAYLOAD,
    diterbitkanAt: PASSPORT_PAYLOAD.diterbitkanAt,
  };
  await installMockDirectus(page, { authenticated: true });
  await installMockProgram(page, state);
  await loginMock(page, `/dashboard/usaha/passport?usaha=${USAHA_ID}`, "/dashboard/usaha/passport");

  await expect(page.getByRole("heading", { name: "Talent Passport" })).toBeVisible();
  await expect(page.getByTestId("passport-kode")).toBeVisible();

  // 1. Download Executive Summary PDF
  const summaryBtn = page.getByRole("button", { name: "Unduh Executive Summary & Business Scorecard (PDF)" });
  await expect(summaryBtn).toBeVisible();

  const [summaryDownload] = await Promise.all([
    page.waitForEvent("download"),
    summaryBtn.click(),
  ]);

  expect(summaryDownload.suggestedFilename()).toMatch(/\.pdf$/i);
  const summaryContent = await readFile((await summaryDownload.path())!);
  expect(summaryContent.subarray(0, 4).toString("latin1")).toBe("%PDF");

  // 2. Download Katalog Ekspor PDF
  const katalogBtn = page.getByRole("button", { name: "Unduh Katalog Ekspor Resmi (PDF)" });
  await expect(katalogBtn).toBeVisible();

  const [katalogDownload] = await Promise.all([
    page.waitForEvent("download"),
    katalogBtn.click(),
  ]);

  expect(katalogDownload.suggestedFilename()).toMatch(/\.pdf$/i);
  const katalogContent = await readFile((await katalogDownload.path())!);
  expect(katalogContent.subarray(0, 4).toString("latin1")).toBe("%PDF");
});

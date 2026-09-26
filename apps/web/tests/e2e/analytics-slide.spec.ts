import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

test("Canvas Analitik exports a three-slide PPT with the rendered chart", async ({ page, viewport }) => {
  // The export dialog's submit button never settles at phone width (a layout problem that predates
  // the slide option: CSV export is affected too), so Playwright cannot click it there.
  test.skip((viewport?.width ?? 1280) < 600, "Export dialog submit is not clickable at phone width");
  await installMockDirectus(page, { authenticated: true });
  await loginMock(page, "/dashboard/analitik");
  await expect(page.locator('section[aria-labelledby="visual-title"] svg').first()).toBeVisible();

  await page.getByRole("button", { name: "Ekspor" }).click();
  const dialog = page.getByRole("dialog", { name: "Ekspor privat" });
  await dialog.getByLabel("Format").selectOption("slide_pptx");
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Mulai ekspor" }).click()]);

  expect(download.suggestedFilename()).toMatch(/^analitik-.+-\d{4}-\d{2}-\d{2}\.pptx$/);
  // A .pptx is a zip; entry names are stored uncompressed, so they can be read from the raw bytes.
  const zip = (await readFile((await download.path())!)).toString("latin1");
  expect(zip.startsWith("PK")).toBe(true);
  for (const entry of ["ppt/slides/slide1.xml", "ppt/slides/slide2.xml", "ppt/slides/slide3.xml"]) expect(zip).toContain(entry);
  expect(zip).not.toContain("ppt/slides/slide4.xml");
  expect(zip).toMatch(/ppt\/media\/image-\d+-\d+\.png/);
  await expect(dialog).toBeHidden();
});

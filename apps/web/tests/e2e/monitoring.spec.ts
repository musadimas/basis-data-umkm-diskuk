import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

test("BUG-015: kartu kepatuhan menjelaskan cakupan dan laporan minggu berjalan", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true });
  await loginMock(page, "/dashboard/akselerasi");
  // loginMock mendarat lewat navigasi klien; muat ulang agar data dibaca saat SSR dari mock-directus-server.mjs.
  await page.goto("/dashboard/akselerasi");
  await expect(page.getByRole("heading", { name: "Monitoring Program Akselerasi" })).toBeVisible();
  await expect(page.getByText("67 dari 72 laporan · Target >95%")).toBeVisible();
  await expect(page.getByTestId("kepatuhan-cakupan")).toHaveText("Dihitung dari minggu program yang sudah selesai.");
  await expect(page.getByTestId("kepatuhan-minggu-berjalan")).toHaveText("3 laporan disetujui pada minggu berjalan belum dihitung.");
});

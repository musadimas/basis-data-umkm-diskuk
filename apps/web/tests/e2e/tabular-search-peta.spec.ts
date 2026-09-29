import { expect, test } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

test.describe("Pencarian Tabular dan Peta Spasial (Phase Y05)", () => {
  test("tabular search validates length and filters by keyword or NIB", async ({ page }) => {
    await installMockDirectus(page, { authenticated: true, role: "provinsi" });
    await loginMock(page, "/dashboard/tabular");

    await expect(page.getByRole("heading", { name: "Data Tabular UMKM" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Usaha 01", exact: true })).toBeVisible();

    const searchInput = page.getByRole("searchbox", { name: "Cari NIK, NIB, nama usaha, atau nama pemilik" });
    const cariBtn = page.getByRole("button", { name: "Cari", exact: true });

    // 1. Minimum 3 characters validation without request
    let requestFired = false;
    const requestListener = (req: { url: () => string }) => {
      if (req.url().includes("/panel/v1/analytics/tabular/query")) {
        requestFired = true;
      }
    };
    page.on("request", requestListener);

    await searchInput.fill("ab");
    await cariBtn.click();
    await expect(page.getByRole("alert")).toHaveText("Kata kunci minimal 3 karakter");
    expect(requestFired).toBe(false);

    page.off("request", requestListener);

    // 2. Search keyword "leather" — B08-web: q travels in the POST body, never in the URL.
    const searchRequest = page.waitForRequest((req) => {
      const url = new URL(req.url());
      return (
        req.method() === "POST" &&
        url.pathname === "/panel/v1/analytics/tabular/query" &&
        req.postDataJSON?.()?.q === "leather" &&
        !url.searchParams.has("q")
      );
    });
    await searchInput.fill("leather");
    await cariBtn.click();
    await searchRequest;

    await expect(page.getByRole("cell", { name: "Wawan Leathercraft", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Usaha 01", exact: true })).toBeHidden();

    // 3. Search exact 13-digit NIB — also body-only, so no raw identifier hits the URL.
    const nibRequest = page.waitForRequest((req) => {
      const url = new URL(req.url());
      return (
        req.method() === "POST" &&
        url.pathname === "/panel/v1/analytics/tabular/query" &&
        req.postDataJSON?.()?.q === "9900000000001" &&
        !url.searchParams.has("q")
      );
    });
    await searchInput.fill("9900000000001");
    await cariBtn.click();
    await nibRequest;

    await expect(page.getByRole("cell", { name: "Wawan Leathercraft", exact: true })).toBeVisible();

    // 4. Clear search — the rows request carries no q at all.
    const resetRequest = page.waitForRequest((req) => {
      const url = new URL(req.url());
      return (
        req.method() === "POST" &&
        url.pathname === "/panel/v1/analytics/tabular/query" &&
        !("q" in (req.postDataJSON?.() ?? {}))
      );
    });
    await page.getByRole("button", { name: "Hapus", exact: true }).click();
    await resetRequest;
    await expect(page.getByRole("cell", { name: "Usaha 01", exact: true })).toBeVisible();
  });

  test("satellite basemap switcher toggles state on spatial map", async ({ page }) => {
    await installMockDirectus(page, { authenticated: true, renderMap: true, role: "provinsi" });
    await loginMock(page, "/dashboard/spasial");

    const satSwitch = page.getByRole("switch", { name: "Citra Satelit" });
    await expect(satSwitch).toBeVisible();
    await expect(satSwitch).toHaveAttribute("aria-checked", "false");

    await satSwitch.click();
    await expect(satSwitch).toHaveAttribute("aria-checked", "true");

    await satSwitch.click();
    await expect(satSwitch).toHaveAttribute("aria-checked", "false");
  });

  test("map pin card API serves role-scoped business details without leaking raw NIK or phone", async ({ page }) => {
    await installMockDirectus(page, { authenticated: true, role: "provinsi" });
    await loginMock(page, "/dashboard/spasial");

    const json = await page.evaluate(async () => {
      const res = await fetch("/panel/v1/program/peta/11111111-1111-4111-8111-000000000001");
      return res.json();
    });
    const card = json.data;
    expect(card.nama).toBe("Wawan Leathercraft");
    expect(card.pemilik).toBe("Wawan Setiawan");
    expect(card.kodeKbli).toBe("15121");
    expect(card.omzetTahunan).toBe(780000000);
    expect(card.sertifikasi).toContain("halal");
    expect(card.talentStatus).toBe("accelerator");
    // Ensure no raw NIK or personal phone in pin card payload
    expect(card).not.toHaveProperty("nik");
    expect(card).not.toHaveProperty("telepon");
    expect(card).not.toHaveProperty("nomor_telepon");
  });
});

import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";
import { createProgramState, installMockProgram } from "../fixtures/mock-program.mjs";

/**
 * BUG-016..018: kurasi investor memakai tab dengan jumlah dari server, aksi per status,
 * dialog cabut yang tahan gagal, dan status berubah yang memuat ulang daftar.
 */
test.describe("Modul 8 · Kurasi Investor", () => {
  test("tab investor menampilkan jumlah dan tombol sesuai status", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/investor-kurasi");

    await expect(page.getByRole("tab", { name: "Menunggu kurasi (1)" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("li", { hasText: "Keripik Menunggu" }).getByRole("button", { name: "Setujui", exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Disetujui (1)" }).click();
    const disetujui = page.locator("li", { hasText: "Batik Disetujui" });
    await expect(disetujui.getByRole("button", { name: "Setujui", exact: true })).toHaveCount(0);
    await expect(disetujui.getByRole("button", { name: "Cabut persetujuan", exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Belum disetujui usaha (1)" }).click();
    await expect(page.locator("li", { hasText: "Kopi Belum Setuju" }).getByRole("button")).toHaveCount(0);

    await page.getByRole("tab", { name: "Persetujuan dicabut (1)" }).click();
    await expect(page.locator("li", { hasText: "Tas Dicabut" }).getByRole("button", { name: "Setujui ulang", exact: true })).toBeVisible();
  });

  test("cabut persetujuan lewat dialog, gagal mempertahankan dialog, lalu berhasil", async ({ page }) => {
    const state = createProgramState();
    state.gagalKurasiInvestor = true;
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/investor-kurasi");

    await page.getByRole("tab", { name: "Disetujui (1)" }).click();
    await page.locator("li", { hasText: "Batik Disetujui" }).getByRole("button", { name: "Cabut persetujuan", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Cabut persetujuan Batik Disetujui?" })).toBeVisible();
    await dialog.getByRole("button", { name: "Ya, cabut" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveText("Keputusan tidak dapat disimpan. Coba lagi.");

    state.gagalKurasiInvestor = false;
    await dialog.getByRole("button", { name: "Ya, cabut" }).click();
    await expect(page.getByText("Persetujuan Batik Disetujui dicabut.")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Persetujuan dicabut (2)" })).toBeVisible();
    await expect(dialog).toHaveCount(0);
  });

  test("status berubah di tab lain → pesan dan daftar dimuat ulang", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/investor-kurasi");

    const baris = page.locator("li", { hasText: "Keripik Menunggu" });
    await expect(baris.getByRole("button", { name: "Setujui", exact: true })).toBeVisible();
    state.investorProfil[0].disetujui_kurator_pada = new Date().toISOString();
    await baris.getByRole("button", { name: "Setujui", exact: true }).click();

    await expect(page.getByText("Status profil sudah berubah oleh petugas lain. Daftar dimuat ulang.")).toBeVisible();
    await expect(page.getByText("Keripik Menunggu")).toHaveCount(0);
  });

  test("klik ganda Setujui hanya mengirim satu permintaan", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/investor-kurasi");

    await page.locator("li", { hasText: "Keripik Menunggu" }).getByRole("button", { name: "Setujui", exact: true }).dblclick();
    await expect(page.getByText("Keripik Menunggu disetujui.")).toBeVisible();
    expect(state.requests.filter((request) => request.method === "POST" && /\/executive\/investor\/profil\/.+\/kurasi$/.test(request.path))).toHaveLength(1);
  });
});

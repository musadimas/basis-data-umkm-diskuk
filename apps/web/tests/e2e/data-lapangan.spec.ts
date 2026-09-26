import { test, expect } from "@playwright/test"
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs"

const USAHA = "11111111-1111-4111-8111-000000000001"

test("data lapangan: ubah atribut, validasi NIB, verifikasi", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true })
  await loginMock(page, "/dashboard/tabular")
  await page.getByRole("button", { name: "Aksi untuk Usaha 01" }).first().click()
  await page.getByRole("menuitem", { name: "Ubah Data Lapangan" }).click()
  await expect(page).toHaveURL(new RegExp(`/dashboard/data-lapangan/${USAHA}`))
  await expect(page.getByRole("heading", { name: /Ubah Data Lapangan/ })).toBeVisible()

  await page.getByLabel("NIB (13 digit)").fill("123")
  await page.getByRole("button", { name: "Simpan Perubahan" }).click()
  await expect(page.getByText("NIB harus 13 digit")).toBeVisible()

  await page.getByLabel("NIB (13 digit)").fill("1234567890123")
  await page.getByRole("button", { name: "Simpan Perubahan" }).click()
  await expect(page.getByText("Data lapangan tersimpan.")).toBeVisible()

  await page.getByRole("button", { name: "Tandai Terverifikasi" }).click()
  await expect(page.getByText(/Terverifikasi oleh/)).toBeVisible()
  await page.screenshot({ path: "test-results/data-lapangan.png" })
})

test("profil menampilkan tautan Ubah Data Lapangan", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true })
  await loginMock(page, "/dashboard/umkm/11111111-1111-4111-8111-111111111111")
  await expect(page.getByRole("link", { name: "Ubah Data Lapangan" })).toBeVisible()
  await page.screenshot({ path: "test-results/umkm-profile-actions.png" })
})

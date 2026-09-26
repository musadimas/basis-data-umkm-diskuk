import { test, expect } from "@playwright/test"
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs"

const USAHA = "11111111-1111-4111-8111-000000000001"
const DETAIL = "33333333-3333-4333-8333-000000000001"

test("talent scouting: ajukan dari Tabular, hitung skor, kirim", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true })
  await loginMock(page, "/dashboard/tabular")
  await page.getByRole("button", { name: "Aksi untuk Usaha 01" }).first().click()
  await page.getByRole("menuitem", { name: "Ajukan ke Talent Scouting" }).click()
  await expect(page).toHaveURL(new RegExp(`/dashboard/talenta/ajukan/${USAHA}`))

  await expect(page.getByText("Data Bawaan SIDT (read-only)")).toBeVisible()
  await expect(page.getByTestId("nik-tersamar")).toContainText("************1234")
  await expect(page.getByText("1234567890123456")).toHaveCount(0)

  await page.getByLabel("Kapasitas Produksi Bulanan").fill("500")
  await page.getByLabel("Adopsi QRIS").check()
  await page.getByLabel("Pencatatan Keuangan Digital").check()
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  )
  await page.locator('input[type="file"]').setInputFiles({
    name: "komitmen.png",
    mimeType: "image/png",
    buffer: png,
  })
  await expect(page.getByText(/Terunggah: komitmen\.png/)).toBeVisible()

  await page.getByRole("button", { name: "Hitung Skor" }).click()
  await expect(page.getByText("Talent Index Score: 79.38 / 100.00")).toBeVisible()
  await expect(page.getByText("(Status: Direkomendasikan Masuk Talent Pool)")).toBeVisible()

  await page.getByRole("button", { name: "Ajukan ke Talent Scouting" }).click()
  await expect(page).toHaveURL(new RegExp(`/dashboard/talenta/${DETAIL}`))
  await page.screenshot({ path: "test-results/talenta-ajukan.png" })
})

test("talent scouting: provinsi menerbitkan BA; daftar menampilkan status", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true })
  await loginMock(page, "/dashboard/talenta")
  await expect(page.getByRole("heading", { name: "Talent Scouting" })).toBeVisible()
  await page.getByRole("checkbox", { name: "Pilih Usaha 01" }).check()
  await page.getByRole("button", { name: "Terbitkan Berita Acara" }).click()
  await expect(page.getByText("Berita Acara BA-TS/2026/0001 terbit")).toBeVisible()
  await page.screenshot({ path: "test-results/talenta-daftar.png" })
})

import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock, waitForCaptchaForm } from "../fixtures/mock-directus.mjs";
import { PRODUK_ID } from "../fixtures/katalog-data.mjs";
import { USAHA_ID, createProgramState, installMockProgram, navigateSidebar } from "../fixtures/mock-program.mjs";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Modul 7.1 · Katalog", () => {
  test("public catalogue renders curated products with the five chips, all 27 regions and a shareable URL", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page);
    await installMockProgram(page, state);
    await page.goto("/katalog");

    const cards = page.getByTestId("product-card");
    await expect(cards).toHaveCount(2);
    await expect(page.getByTestId("katalog-total")).toHaveText("2");

    const keripik = cards.filter({ hasText: "Keripik Singkong Balado" });
    for (const badge of ["Rekomendasi Marketplace", "Talent Pool", "HALAL", "PIRT", "PDN Deklarasi", "Ramah Disabilitas"]) {
      await expect(keripik.getByText(badge, { exact: true })).toBeVisible();
    }
    await expect(keripik.getByText("Rp 12.000 - Rp 15.000")).toBeVisible();
    await expect(keripik.getByText("MOQ 50")).toBeVisible();

    // M7-03: both catalogue actions live on the card.
    await expect(keripik.getByRole("link", { name: "Lihat Detail Produk" })).toHaveAttribute("href", `/katalog/${PRODUK_ID}`);
    await expect(keripik.getByRole("link", { name: "Hubungi Produsen via WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/6281234567890\?text=/);
    // The Batik record has no sales number: no link is created at all.
    const batik = cards.filter({ hasText: "Batik Tulis Mega Mendung" });
    await expect(batik.getByText("Kontak penjualan belum tersedia")).toBeVisible();
    await expect(batik.getByRole("link", { name: "Hubungi Produsen via WhatsApp" })).toHaveCount(0);

    // M7-02: the region filter lists the reference regions, not only the published ones.
    // Halaman SSR: klik pertama bisa terjadi sebelum hidrasi menautkan handler combobox.
    await expect(async () => {
      if ((await page.locator("#filter-wilayah").getAttribute("aria-expanded")) !== "true")
        await page.locator("#filter-wilayah").click();
      await expect(page.getByRole("option")).toHaveCount(28);
    }).toPass({ timeout: 15_000 });
    // A region with no published product is offered and says so, instead of silently missing.
    await expect(page.getByRole("option", { name: "Kabupaten Bandung (0)" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Kota Bandung (1)" })).toBeVisible();
    await page.keyboard.press("Escape");

    // The page is server-rendered; retry until hydration has attached the chip's click handler.
    await expect(async () => {
      await page.getByRole("button", { name: "Fesyen & Tekstil", exact: true }).click();
      await expect(cards).toHaveCount(1, { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await expect(cards.first()).toContainText("Batik Tulis Mega Mendung");
    const listRequest = state.requests.filter((request) => request.path === "/panel/items/produk" && !request.query?.aggregate).at(-1);
    expect(JSON.parse(listRequest!.query!.filter!)).toEqual({ _and: [{ kategori: { _in: ["fashion"] } }] });
    // The filter state is shareable: it is part of the URL, not hidden in component state.
    await expect(page).toHaveURL(/kategori=fesyen/);

    // A reload of that URL server-renders the same filtered result.
    await page.goto(page.url());
    await expect(page.getByTestId("product-card")).toHaveCount(1);
    await expect(page.getByTestId("katalog-total")).toHaveText("1");
  });

  test("search reaches the server query for product, business and KBLI", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page);
    await installMockProgram(page, state);
    await page.goto("/katalog");

    // The page is server-rendered; retry until hydration has attached the search input.
    await expect(async () => {
      await page.getByLabel("Cari produk").fill("Keripik Siti");
      const request = state.requests.filter((item) => item.path === "/panel/items/produk" && !item.query?.aggregate).at(-1);
      expect(request, "search request").toBeTruthy();
      expect(JSON.parse(request!.query!.filter!)).toEqual({
        _and: [
          {
            _or: [
              { nama: { _icontains: "Keripik Siti" } },
              { usaha_nama: { _icontains: "Keripik Siti" } },
              { kbli: { _contains: "Keripik Siti" } },
            ],
          },
        ],
      });
    }).toPass({ timeout: 20_000 });
    await expect(page).toHaveURL(/q=Keripik\+Siti|q=Keripik%20Siti/);
  });

  test("region and chip combine, and an empty combination says so", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page);
    await installMockProgram(page, state);
    await page.goto("/katalog?kategori=fesyen&kota=9&sort=nama");

    // The shared URL is the state: chip, region and sort survive a full page load.
    await expect(page.getByTestId("product-card")).toHaveCount(1);
    await expect(page.getByTestId("product-card").first()).toContainText("Batik Tulis Mega Mendung");
    await expect(page.getByRole("button", { name: "Fesyen & Tekstil" })).toHaveAttribute("aria-pressed", "true");

    // Switching to Kota Bandung (whose product is not fashion) empties the result and says why.
    await expect(async () => {
      await page.keyboard.press("Escape");
      await page.locator("#filter-wilayah").click();
      // Tunggu animasi popper selesai agar klik tidak mendarat di opsi yang bergeser.
      await page.getByRole("option", { name: "Kota Bandung (1)" }).waitFor({ state: "visible" });
      await page.waitForTimeout(300);
      await page.getByRole("option", { name: "Kota Bandung (1)" }).click();
      await expect(page.getByTestId("katalog-total")).toHaveText("0", { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByText("Tidak ada produk yang cocok dengan kombinasi filter ini.")).toBeVisible();
    const request = state.requests.filter((item) => item.path === "/panel/items/produk" && !item.query?.aggregate).at(-1);
    expect(JSON.parse(request!.query!.filter!)).toEqual({
      _and: [{ kategori: { _in: ["fashion"] } }, { usaha_kota: { _eq: 7 } }],
    });
    expect(request!.query!.sort).toBe("nama");
    await expect(page).toHaveURL(/kategori=fesyen/);
    await expect(page).toHaveURL(/kota=7/);
  });

  test("product detail shows every group with an explicit empty state, the spec PDF and one LOI per intent", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page);
    await installMockProgram(page, state);
    await page.goto(`/katalog/${PRODUK_ID}`);

    await expect(page.getByRole("heading", { name: "Keripik Singkong Balado" })).toBeVisible();
    // M7-04: legality status/number from the public product copy.
    await expect(page.getByText("NIB:")).toBeVisible();
    await expect(page.getByText("1234567890123")).toBeVisible();
    await expect(page.getByText("Terverifikasi · Nomor ID3210000123456")).toBeVisible();
    await expect(page.getByText("Belum ada", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("PDN:")).toBeVisible();
    await expect(page.getByText("Deklarasi mandiri pelaku usaha")).toBeVisible();
    await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]')).toBeAttached();
    await expect(page.getByText("85%")).toBeVisible();
    // Fields the record does not carry are declared empty instead of being faked.
    const stokRow = page.locator("dl > div", { has: page.getByText("Stok", { exact: true }) });
    await expect(stokRow).toContainText("Belum tersedia");
    const kapasitasRow = page.locator("dl > div", { has: page.getByText("Kapasitas produksi bulanan", { exact: true }) });
    await expect(kapasitasRow).toContainText("2.000 pcs");

    // M7-05 / M7-04: the three detail actions.
    await expect(page.getByRole("link", { name: "Ajukan Minat Kemitraan (LOI)" })).toHaveAttribute("href", "#loi");
    await expect(page.getByRole("link", { name: "Kontak Penjualan Resmi (WhatsApp)" })).toHaveAttribute("href", /^https:\/\/wa\.me\/6281234567890\?text=/);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Unduh Lembar Spesifikasi (PDF)" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("spesifikasi-produk.pdf");

    await waitForCaptchaForm(page);
    await page.getByLabel("Nama", { exact: true }).fill("Pembeli Grosir");
    await page.getByLabel("Email").fill("beli@contoh.id");
    await page.getByLabel("Perkiraan jumlah (mis. 1.000 pcs per bulan)").fill("1.000 pcs");
    await page.getByLabel("Pesan", { exact: true }).fill("Kami tertarik untuk kerja sama.");
    // Consent is required before the letter can be sent.
    await page.getByRole("button", { name: "Kirim LOI" }).click();
    await expect(page.getByText("Centang persetujuan untuk dihubungi kembali sebelum mengirim.")).toBeVisible();
    expect(state.loi).toHaveLength(0);

    await page.getByRole("checkbox", { name: "Persetujuan dihubungi kembali" }).check();
    await page.getByRole("button", { name: "Kirim LOI" }).click();
    await expect(page.getByText("Letter of Intent terkirim.")).toBeVisible({ timeout: 15_000 });
    expect(state.loi).toHaveLength(1);
    expect(state.loi[0]).toMatchObject({ produk: PRODUK_ID, nama: "Pembeli Grosir", email: "beli@contoh.id", persetujuanKontak: true });
    expect(state.loi[0].clientUuid).toBeTruthy();
    expect(state.loi[0].captcha).toBeTruthy();

    // Sending the same intent twice stores exactly one letter and says so.
    await page.getByLabel("Nama", { exact: true }).fill("Pembeli Grosir");
    await page.getByLabel("Email").fill("beli@contoh.id");
    await page.getByLabel("Perkiraan jumlah (mis. 1.000 pcs per bulan)").fill("1.000 pcs");
    await page.getByLabel("Pesan", { exact: true }).fill("Kami tertarik untuk kerja sama.");
    await page.getByRole("checkbox", { name: "Persetujuan dihubungi kembali" }).check();
    await page.getByRole("button", { name: "Kirim LOI" }).click();
    await expect(page.getByText("Letter of Intent ini sudah pernah terkirim.")).toBeVisible({ timeout: 15_000 });
    expect(state.loi).toHaveLength(1);
  });

  test("an unpublished product is not found", async ({ page }) => {
    await installMockDirectus(page);
    await page.goto("/katalog/66666666-6666-4666-8666-000000000099");
    await expect(page.getByRole("heading", { name: "Produk tidak ditemukan" })).toBeVisible();
  });

  test("a business submits a product with photos in the public folder and a curator publishes it", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/usaha/produk");

    await page.getByLabel("Cari usaha").fill("Usaha 01");
    await page.getByRole("button", { name: "Cari" }).click();
    await page.getByRole("button", { name: "Kelola produk" }).click();
    await page.getByRole("button", { name: "Tambah Produk" }).click();

    await page.getByTestId("foto-produk-input").setInputFiles({ name: "produk.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByAltText("Foto produk 1")).toBeVisible();
    await page.getByLabel("Nama produk").fill("Keripik Pedas");
    await page.getByRole("combobox", { name: "Kategori" }).click();
    await page.getByRole("option", { name: "Makanan", exact: true }).click();
    await page.getByLabel("Harga retail (Rp)").fill("15000");
    await page.getByLabel("TKDN (%)").fill("80");
    await page.getByRole("checkbox", { name: /deklarasi mandiri Produk Dalam Negeri/ }).click();
    await page.getByRole("button", { name: "Ajukan ke Kurasi" }).click();

    await expect(page.getByText("Produk diajukan ke kurasi DISKUK.")).toBeVisible();
    // Photos wait in the private curation folder until a curator publishes the product (Y04).
    expect(state.uploadFolders).toEqual(["6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f11"]);
    const created = state.requests.find((request) => request.method === "POST" && request.path === "/katalog/produk");
    expect(created?.body).toMatchObject({ usaha: USAHA_ID, nama: "Keripik Pedas", kategori: "makanan", hargaRetail: 15000, tkdnPersen: 80, pdnDeklarasi: true, foto: [state.uploads[0]] });

    await navigateSidebar(page, "Kurasi Katalog", "/dashboard/katalog/kurasi");
    await page.getByRole("button", { name: "Kurasi" }).click();
    await page.getByRole("button", { name: "Tolak" }).click();
    await expect(page.getByText("Tulis alasan penolakan untuk pelaku usaha.")).toBeVisible();
    await page.getByRole("button", { name: "Tayangkan" }).click();
    await expect(page.getByText("Keripik Pedas: Tayang.")).toBeVisible();
    expect(state.produk[0].statusKurasi).toBe("tayang");
  });
});

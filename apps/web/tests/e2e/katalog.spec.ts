import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock, waitForCaptchaForm } from "../fixtures/mock-directus.mjs";
import { PRODUK_ID } from "../fixtures/katalog-data.mjs";
import { USAHA_ID, createProgramState, installMockProgram, navigateSidebar } from "../fixtures/mock-program.mjs";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** Produk lengkap seperti objek `created` di handler mock, satu per status kurasi (BUG-019). */
const produkKurasi = (id: string, nama: string, statusKurasi: string, catatanKurasi: string | null = null) => ({
  id, usaha: USAHA_ID, nama, deskripsi: "Produk uji kurasi.", kategori: "makanan", kbli: "10794",
  hargaRetail: 15000, hargaGrosir: 12000, moq: 50, videoUrl: null, dimensi: null, berat: null, shelfLife: null,
  bahanBaku: null, tkdnPersen: 80, kapasitasBulanan: null, leadTime: null, ujiLab: null, persenBahanLokal: null,
  pdnDeklarasi: false, foto: [], statusKurasi, catatanKurasi, dikurasiAt: null, usahaNama: "Usaha 01",
  usahaKota: "Kabupaten Bogor", dateCreated: "2026-09-20T00:00:00Z", dateUpdated: "2026-09-21T00:00:00Z",
});

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
    // Wilayah memakai combobox reka-ui: buka trigger sampai opsi stabil, klik, ulangi bila perlu.
    const kotaBandung = page.getByRole("option").filter({ hasText: "Kota Bandung (" });
    await expect(async () => {
      if ((await page.locator("#filter-wilayah").getAttribute("aria-expanded")) !== "true") await page.locator("#filter-wilayah").click();
      await expect(kotaBandung).toBeVisible({ timeout: 1_500 });
      await page.waitForTimeout(200);
      await kotaBandung.click();
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

  test("kurator hanya melihat aksi yang sah untuk tiap status (BUG-019)", async ({ page }) => {
    const state = createProgramState();
    state.produk.push(
      produkKurasi("dddddddd-0000-4000-8000-000000000001", "Produk Tayang", "tayang"),
      produkKurasi("dddddddd-0000-4000-8000-000000000002", "Produk Rekomendasi", "rekomendasi_marketplace"),
      produkKurasi("dddddddd-0000-4000-8000-000000000003", "Produk Ditolak", "ditolak", "Foto buram"),
    );
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/katalog/kurasi");

    // Tab Tayang: tanpa "Tayangkan", dengan "Turunkan" dan tautan ke katalog publik.
    await page.getByRole("tab", { name: "Tayang", exact: true }).click();
    await page.locator("li", { hasText: "Produk Tayang" }).getByRole("button", { name: "Lihat" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Produk Tayang" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Tayangkan", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Turunkan", exact: true })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Lihat di katalog" })).toHaveAttribute("href", "/katalog/dddddddd-0000-4000-8000-000000000001");

    // Turunkan tanpa catatan ditolak dengan pesan yang sama seperti server; dialog tetap terbuka.
    await dialog.getByRole("button", { name: "Turunkan", exact: true }).click();
    await expect(dialog.getByText("Tulis alasan penolakan untuk pelaku usaha.")).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(state.requests.filter((request) => request.method === "POST" && request.path.endsWith("/kurasi"))).toHaveLength(0);

    await dialog.getByLabel("Catatan kurasi").fill("Stok sedang kosong.");
    await dialog.getByRole("button", { name: "Turunkan", exact: true }).click();
    await expect(page.getByText("Produk Tayang: Ditolak.")).toBeVisible();
    await expect(dialog).toHaveCount(0);

    // Tab Ditolak: read-only dengan catatan kurasi dan hanya tombol "Tutup".
    await page.getByRole("tab", { name: "Ditolak", exact: true }).click();
    await page.locator("li", { hasText: "Produk Ditolak" }).getByRole("button", { name: "Lihat" }).click();
    const dialogDitolak = page.getByRole("dialog");
    await expect(dialogDitolak.getByText("Foto buram")).toBeVisible();
    await expect(dialogDitolak.getByLabel("Catatan kurasi")).toHaveCount(0);
    await expect(dialogDitolak.getByRole("button", { name: "Tutup", exact: true })).toBeVisible();
    await expect(dialogDitolak.getByRole("button", { name: "Tolak", exact: true })).toHaveCount(0);
  });

  test("LOI dapat dibuka, dihubungi, dan ditindaklanjuti (BUG-020)", async ({ page }) => {
    const state = createProgramState();
    state.loi.push(
      {
        id: "eeeeeeee-0000-4000-8000-000000000001", produk: "dddddddd-0000-4000-8000-000000000001", produkNama: "Produk Tayang",
        usahaNama: "Usaha 01", nama: "Pembeli Konsen", instansi: "PT Contoh", email: "beli@contoh.id", telepon: "0812345678",
        jumlah: "1.000 pcs", pesan: "Minat kerja sama.", persetujuanKontak: true, status: "baru", dateCreated: "2026-09-25T02:00:00Z",
      },
      {
        id: "eeeeeeee-0000-4000-8000-000000000002", produk: "dddddddd-0000-4000-8000-000000000001", produkNama: "Produk Tayang",
        usahaNama: "Usaha 01", nama: "Pembeli Tanpa Kontak", instansi: null, email: "rahasia@contoh.id", telepon: null,
        jumlah: null, pesan: "Saya tidak ingin dihubungi.", persetujuanKontak: false, status: "baru", dateCreated: "2026-09-24T02:00:00Z",
      },
    );
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/katalog/kurasi");

    await page.getByRole("tab", { name: "Letter of Intent", exact: true }).click();
    const baris = page.locator("li", { hasText: "Pembeli Konsen" });
    await expect(baris.getByText("Baru", { exact: true })).toBeVisible();
    await baris.getByRole("button", { name: "Detail" }).click();

    // Kontak hanya tampil sebagai tautan bila pengirim menyetujui dihubungi.
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: "beli@contoh.id" })).toHaveAttribute("href", "mailto:beli@contoh.id");
    await expect(dialog.getByRole("link", { name: "0812345678" })).toHaveAttribute("href", "tel:0812345678");

    await dialog.getByRole("button", { name: "Tandai ditindaklanjuti" }).click();
    await expect(dialog.getByText("Ditindaklanjuti", { exact: true })).toBeVisible();
    await expect(page.getByText("LOI ditindaklanjuti.")).toBeVisible();

    await dialog.getByRole("button", { name: "Tutup LOI" }).click();
    await expect(dialog.getByText("Ditutup", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Tutup", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Tutup", exact: true }).click();
    await expect(dialog).toHaveCount(0);

    // LOI lama tanpa persetujuan kontak: dijelaskan, tanpa tautan mailto (data campuran).
    await page.locator("li", { hasText: "Pembeli Tanpa Kontak" }).getByRole("button", { name: "Detail" }).click();
    const dialogKedua = page.getByRole("dialog");
    await expect(dialogKedua.getByText("Pengirim tidak menyetujui kontaknya dibagikan.")).toBeVisible();
    await expect(dialogKedua.locator('a[href^="mailto:"]')).toHaveCount(0);

    // R4: penyimpanan gagal mempertahankan dialog dan menaruh error inline di dalamnya.
    state.gagalLoi = true;
    await dialogKedua.getByRole("button", { name: "Tutup LOI" }).click();
    await expect(dialogKedua).toBeVisible();
    await expect(dialogKedua.getByRole("alert")).toHaveText("Status LOI tidak dapat disimpan. Coba lagi.");
  });
});

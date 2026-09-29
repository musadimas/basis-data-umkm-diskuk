// Bukti runtime Y06 pada stack disposable (PLAYWRIGHT_USE_REAL_API=1).
// Prasyarat: migrasi A–R sudah diterapkan dan seed Y06 di `scripts/seed-dummy-operasional.sql`
// dijalankan (27 kabupaten/kota, satu produk tayang, satu produk draft, kontak penjualan
// terverifikasi, satu sertifikat halal terbit). Tanpa stack: skip, bukan `done`.
import { expect, test } from "@playwright/test";

const PRODUK_TAYANG = process.env.DUMMY_PRODUK_TAYANG || "e1000000-0000-4000-8000-000000000001";
const PRODUK_DRAFT = process.env.DUMMY_PRODUK_DRAFT || "e1000000-0000-4000-8000-000000000002";
const PRODUK_TAYANG_NAMA = "Keripik Nanas Subang Premium";
const PRODUK_DRAFT_NAMA = "Keripik Nanas Subang Uji Coba";
const NIB = "9900000000005";
const WHATSAPP = "6281200000005";
const NOMOR_HALAL = "ID3210000123456";
// PII yang tidak boleh muncul di respons publik mana pun (ADR-004, phase Y06).
const TERLARANG_DI_PUBLIK = ["dummy_0000000005", "Siti Aminah", "240000000", "\"nik\"", "omzet_tahunan", "pelaku_usaha"];

test.describe("Y06 katalog publik pada stack disposable", () => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");

  test("anonim: produk tayang muncul dari DB, draft tidak pernah, dan respons bebas PII", async ({ page }) => {
    await page.goto("/katalog");
    await expect(page.getByTestId("katalog-total")).not.toHaveText("0");

    // Kata kunci dikirim ke query server; hasilnya record DB, bukan fixture.
    await expect(async () => {
      await page.getByLabel("Cari produk").fill(PRODUK_TAYANG_NAMA);
      await expect(page.getByTestId("product-card")).toHaveCount(1, { timeout: 2000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByTestId("product-card")).toContainText(PRODUK_TAYANG_NAMA);

    // Draft dengan nama mirip tidak pernah muncul di katalog.
    await expect(async () => {
      await page.getByLabel("Cari produk").fill(PRODUK_DRAFT_NAMA);
      await expect(page.getByTestId("katalog-total")).toHaveText("0", { timeout: 2000 });
    }).toPass({ timeout: 30_000 });

    // Policy publik: draft tidak terbaca anonim, dan filter status 'menunggu' mengembalikan nol baris.
    expect((await page.request.get(`/panel/items/produk/${PRODUK_DRAFT}`)).status()).toBe(403);
    const menunggu = await page.request.get("/panel/items/produk?filter[status_kurasi][_eq]=menunggu&limit=5");
    expect(JSON.parse(await menunggu.text()).data).toEqual([]);

    // Pemindaian PII atas payload publik (list + detail).
    const list = await page.request.get(`/panel/items/produk?filter[nama][_eq]=${encodeURIComponent(PRODUK_TAYANG_NAMA)}&limit=5`);
    const detail = await page.request.get(`/panel/items/produk/${PRODUK_TAYANG}`);
    for (const respons of [await list.text(), await detail.text()]) {
      for (const terlarang of TERLARANG_DI_PUBLIK) {
        expect(respons.toLowerCase(), `payload publik memuat ${terlarang}`).not.toContain(terlarang.toLowerCase());
      }
      // NIB dan nomor sertifikat memang bagian dari salinan publik (M7-04).
      expect(respons).toContain(NIB);
      expect(respons).toContain(NOMOR_HALAL);
    }
  });

  test("filter wilayah menawarkan 27 kabupaten/kota dan mengubah hasil serta count", async ({ page }) => {
    await page.goto("/katalog");
    const opsi = page.locator("#filter-wilayah option");
    await expect(opsi).toHaveCount(28); // "Semua Kab/Kota" + 27 wilayah Jawa Barat
    const label = (await opsi.allTextContents()).join(" | ");
    for (const nama of ["Kabupaten Subang", "Kota Bandung", "Kota Banjar", "Kabupaten Pangandaran", "Kabupaten Bogor"]) {
      expect(label).toContain(nama);
    }

    const subang = page.locator("#filter-wilayah option", { hasText: "Kabupaten Subang (" });
    const nilai = await subang.first().getAttribute("value");
    await expect(async () => {
      await page.locator("#filter-wilayah").selectOption(nilai!);
      await expect(page.getByTestId("katalog-total")).not.toHaveText("0", { timeout: 2000 });
    }).toPass({ timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`kota=${nilai}`));

    // Chip brief + wilayah dapat digabung, dan kombinasi kosong dinyatakan jelas.
    await page.getByRole("button", { name: "Kerajinan", exact: true }).click();
    await expect(page.getByTestId("katalog-total")).toHaveText("0", { timeout: 15_000 });
    await expect(page.getByText("Tidak ada produk yang cocok dengan kombinasi filter ini.")).toBeVisible();
    await expect(page).toHaveURL(/kategori=kerajinan/);
  });

  test("detail: legalitas bernomor, field kosong dinyatakan, PDF publik, dan kontak penjualan terverifikasi", async ({ page }) => {
    await page.goto(`/katalog/${PRODUK_TAYANG}`);
    await expect(page.getByRole("heading", { name: PRODUK_TAYANG_NAMA })).toBeVisible();
    await expect(page.getByText(NIB)).toBeVisible();
    await expect(page.getByText(`Nomor ${NOMOR_HALAL}`)).toBeVisible();
    // Seed sengaja mengosongkan masa kedaluwarsa: halaman menyatakannya, bukan mengarang.
    await expect(page.locator("dl > div", { has: page.getByText("Masa kedaluwarsa", { exact: true }) })).toContainText("Belum tersedia");
    await expect(page.locator("dl > div", { has: page.getByText("Stok", { exact: true }) })).toContainText("Belum tersedia");
    await expect(page.getByRole("link", { name: "Kontak Penjualan Resmi (WhatsApp)" })).toHaveAttribute("href", new RegExp(`wa\\.me/${WHATSAPP}`));

    // PDF lembar spesifikasi terbuka untuk anonim, terparse, dan memuat data yang sama.
    const pdf = await page.request.get(`/panel/v1/program/katalog/produk/${PRODUK_TAYANG}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect(pdf.headers()["content-disposition"]).toContain("spesifikasi-keripik-nanas-subang-premium.pdf");
    const bytes = await pdf.body();
    expect(bytes.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(bytes.subarray(-6).toString("latin1").trimEnd()).toBe("%%EOF");
    const teks = bytes.toString("latin1");
    for (const baris of ["Lembar Spesifikasi Produk", PRODUK_TAYANG_NAMA, `NIB: ${NIB}`, `HALAL nomor ${NOMOR_HALAL}`, "Masa kedaluwarsa: Belum tersedia"]) {
      expect(teks).toContain(baris);
    }
    // Shop-nya sendiri tidak pernah membocorkan kontak pribadi pemilik.
    for (const terlarang of TERLARANG_DI_PUBLIK) expect(teks.toLowerCase()).not.toContain(terlarang.toLowerCase());

    // Produk draft tidak punya lembar spesifikasi.
    expect((await page.request.get(`/panel/v1/program/katalog/produk/${PRODUK_DRAFT}/pdf`)).status()).toBe(404);
  });

  test("LOI dikirim dua kali: satu surat tersimpan dan umpan baliknya jelas", async ({ page }) => {
    await page.goto(`/katalog/${PRODUK_TAYANG}`);
    await expect(page.locator("altcha-widget")).toBeAttached();

    // Marker unik per run supaya pengiriman pertama selalu baru di DB disposable.
    const tanda = Date.now();
    const email = `pembeli.y06.${tanda}@contoh.id`;
    const pesan = `Kami ingin menjadi distributor Subang (${tanda}).`;

    const isi = async () => {
      await page.getByLabel("Nama", { exact: true }).fill("Pembeli Grosir Y06");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Perkiraan jumlah pesanan").fill("500 pcs per bulan");
      await page.getByLabel("Pesan", { exact: true }).fill(pesan);
      await page.getByRole("checkbox", { name: "Persetujuan dihubungi kembali" }).check();
    };

    await isi();
    await page.getByRole("button", { name: "Kirim LOI" }).click();
    await expect(page.getByText("Letter of Intent terkirim.")).toBeVisible({ timeout: 30_000 });

    await isi();
    await page.getByRole("button", { name: "Kirim LOI" }).click();
    await expect(page.getByText("Letter of Intent ini sudah pernah terkirim.")).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("Y06 katalog pada layar ponsel", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");

  test("kartu, chip, dan kedua CTA terbaca pada viewport ponsel", async ({ page }) => {
    await page.goto("/katalog");
    const kartu = page.getByTestId("product-card").filter({ hasText: PRODUK_TAYANG_NAMA });
    await expect(kartu.first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Kuliner & Makanan Olahan" })).toBeVisible();
    await expect(page.locator("#filter-wilayah")).toBeVisible();
    for (const aksi of ["Lihat Detail Produk", "Hubungi Produsen via WhatsApp"]) {
      const tombol = kartu.first().getByRole("link", { name: aksi });
      await tombol.scrollIntoViewIfNeeded();
      await expect(tombol).toBeVisible();
    }

    await page.goto(`/katalog/${PRODUK_TAYANG}`);
    for (const aksi of ["Ajukan Minat Kemitraan / Order B2B", "Kontak Penjualan Resmi (WhatsApp)", "Unduh Lembar Spesifikasi (PDF)"]) {
      const link = page.getByRole("link", { name: aksi });
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: /Ajukan Minat Kemitraan/ })).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";
import { installMockDirectus, waitForCaptchaForm } from "../fixtures/mock-directus.mjs";
import { installMockProgram } from "../fixtures/mock-program.mjs";
import { tungguHidrasi } from "../fixtures/kegiatan-data.mjs";

// Modul 7.2 · Agenda publik: kalender bulanan, filter server, CTA per status, detail, pengingat.
// Mock mengimpor aturan server yang sama (status temporal, DTO, 27 dinas) sehingga alur browser
// tidak menyimpang dari endpoint yang diwakilinya.

const hariIni = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const labelBulanBerikut = (offsetHari: number) =>
  new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(Date.now() + offsetHari * 86_400_000));

async function bukaAgenda(page: import("@playwright/test").Page) {
  await installMockDirectus(page);
  const state = await installMockProgram(page);
  await page.goto("/kegiatan");
  await tungguHidrasi(page);
  await expect(page.getByTestId("bulan")).toBeVisible();
  return state;
}

test("the agenda groups events by server status and offers every dinas", async ({ page }) => {
  await bukaAgenda(page);

  await expect(page.getByTestId("status-berjalan")).toContainText("Pelatihan Pemasaran Digital");
  await expect(page.getByTestId("status-pendaftaran")).toContainText("Sertifikasi Halal Gratis");
  await expect(page.getByTestId("status-pendaftaran")).toContainText("Pameran Produk Unggulan");
  await expect(page.getByTestId("status-segera")).toContainText("Temu Bisnis Ekspor");
  await expect(page.getByTestId("status-segera")).toContainText("Akselerasi UMKM Talent Batch 2");
  await expect(page.getByTestId("status-selesai")).toContainText("Seminar Literasi Digital");
  // An event withdrawn after curation is not public anywhere.
  await expect(page.getByText("Pelatihan Dibatalkan")).toHaveCount(0);

  // M7-08: the 27 kabupaten/kota dinas are always offered, whatever is published.
  const opsi = await page.getByTestId("filter-penyelenggara").locator("option").allInnerTexts();
  expect(opsi.filter((text) => text.startsWith("Dinas KUMKM "))).toHaveLength(27);
  expect(opsi).toContain("Kementerian/Lembaga");
  await expect(page.getByTestId("jumlah-hasil")).toContainText("12 kegiatan sesuai filter");

  // M7-09: the day focus card opens by tap as well as hover and carries the brief's fields.
  const hari = hariIni();
  await page.getByTestId(`hari-${hari}`).click();
  const fokus = page.getByTestId(`fokus-${hari}`);
  await expect(fokus).toBeVisible();
  await expect(fokus).toContainText("Pelatihan Pemasaran Digital");
  await expect(fokus).toContainText("Daring");
  await expect(fokus).toContainText("Sisa 63 dari 100 kuota");
});

test("the month calendar navigates, marks today and reports an empty month", async ({ page }) => {
  await bukaAgenda(page);
  await expect(page.getByTestId("bulan")).toHaveText(labelBulanBerikut(0));

  await page.getByRole("button", { name: "Bulan berikutnya" }).click();
  await expect(page.getByTestId("bulan")).not.toHaveText(labelBulanBerikut(0));

  // An event two months out is found by the month query, not by luck of the loaded window.
  const target = labelBulanBerikut(60);
  for (let i = 0; i < 6 && (await page.getByTestId("bulan").innerText()) !== target; i += 1) {
    await page.getByRole("button", { name: "Bulan berikutnya" }).click();
  }
  await expect(page.getByTestId("bulan")).toHaveText(target);
  await expect(page.getByRole("region", { name: "Kalender bulanan" }).getByRole("button", { name: "Pameran Akhir Tahun" }).first()).toBeVisible();

  for (let i = 0; i < 11; i += 1) await page.getByRole("button", { name: "Bulan berikutnya" }).click();
  await expect(page.getByTestId("kalender-kosong")).toBeVisible();

  await page.getByRole("button", { name: "Hari ini" }).click();
  await expect(page.getByTestId("bulan")).toHaveText(labelBulanBerikut(0));
  await expect(page.getByRole("region", { name: "Kalender bulanan" }).getByText(`Hari ini: ${hariIni()} (WIB)`)).toBeVisible();
});

test("filters go to the server, the count follows and the URL stays shareable", async ({ page }) => {
  const state = await bukaAgenda(page);

  await page.getByTestId("filter-metode").selectOption("luring");
  await expect(page.getByTestId("status-berjalan")).not.toContainText("Pelatihan Pemasaran Digital");
  // R03: tiga kegiatan internal luring ikut terhitung.
  await expect(page.getByTestId("jumlah-hasil")).toContainText("9 kegiatan sesuai filter");
  const permintaan = state.requests.filter((item) => item.path === "/kegiatan").at(-1);
  expect(permintaan?.query?.metode).toBe("luring");

  await page.getByTestId("filter-kategori").selectOption("sertifikasi");
  await expect(page.getByTestId("jumlah-hasil")).toContainText("1 kegiatan sesuai filter");
  await expect(page.getByTestId("status-pendaftaran")).toContainText("Sertifikasi Halal Gratis");
  await expect(page.getByTestId("status-pendaftaran")).not.toContainText("Pameran Produk Unggulan");
  await expect.poll(() => new URL(page.url()).searchParams.get("kategori")).toBe("sertifikasi");
  expect(new URL(page.url()).searchParams.get("metode")).toBe("luring");

  await page.getByTestId("filter-penyelenggara").selectOption("Dinas KUMKM Kabupaten Subang");
  await expect(page.getByTestId("status-pendaftaran")).toContainText("Sertifikasi Halal Gratis");

  await page.getByTestId("reset-filter").click();
  await expect(page.getByTestId("jumlah-hasil")).toContainText("12 kegiatan sesuai filter");
  await expect.poll(() => new URL(page.url()).searchParams.get("kategori")).toBeNull();
});

test("each status has its own call to action; internal events register in-app (R03)", async ({ page }) => {
  await bukaAgenda(page);

  // Berjalan → official streaming/presence link.
  await expect(page.getByTestId("cta-aa000000-0000-4000-8000-000000000001")).toHaveAttribute("href", "https://zoom.example.invalid/pemasaran-digital");
  // Pendaftaran → the official form, and an honest disabled button when it does not exist yet.
  await expect(page.getByTestId("cta-aa000000-0000-4000-8000-000000000002")).toHaveAttribute("href", "https://daftar.example.invalid/halal");
  const tanpaTautan = page.getByTestId("status-pendaftaran").locator("article", { hasText: "Pameran Produk Unggulan" });
  await expect(tanpaTautan.getByRole("button", { name: "Daftar Sekarang" })).toBeDisabled();
  await expect(tanpaTautan).toContainText("Tautan pendaftaran resmi belum tersedia");
  await expect(tanpaTautan).not.toContainText("Pendaftaran online segera hadir");
  // R03: kegiatan pendaftaran_internal menawarkan form di aplikasi, bukan URL eksternal.
  const internal = page.getByTestId("cta-ae000000-0000-4000-8000-0000000000b1");
  await expect(internal).toHaveAttribute("href", "/kegiatan/ae000000-0000-4000-8000-0000000000b1");
  // Segera datang → reminder; finished → materials or an honest note.
  await expect(page.getByTestId("status-segera").getByRole("button", { name: "Ingatkan saya" }).first()).toBeVisible();
  await expect(page.getByTestId("cta-aa000000-0000-4000-8000-000000000006")).toHaveAttribute("href", "https://materi.example.invalid/seminar-literasi");
  const bazar = page.getByTestId("status-selesai").locator("article", { hasText: "Bazar Ramadan" });
  await expect(bazar.getByRole("button", { name: "Materi belum diunggah" })).toBeDisabled();
});

test("the detail dialog shows requirements, documents and only safe official links", async ({ page }) => {
  await bukaAgenda(page);

  await page.getByTestId("status-pendaftaran").getByRole("button", { name: /Sertifikasi Halal Gratis/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Alur sertifikasi halal dan audit dapur")).toBeVisible();
  await expect(dialog.getByText("BPJPH dan pendamping halal")).toBeVisible();
  await expect(dialog.getByText("Pendampingan berkas dan sertifikat")).toBeVisible();
  await expect(dialog.getByText("Skala usaha: Mikro, Kecil")).toBeVisible();
  await expect(dialog.getByText("Wilayah: Kabupaten Subang")).toBeVisible();
  await expect(dialog.getByText("Wajib memiliki NIB")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Dokumen pendukung" })).toHaveAttribute("href", "https://dokumen.example.invalid/panduan-halal.pdf");
  await expect(dialog.getByRole("link", { name: "Tautan pendaftaran resmi" })).toHaveAttribute("href", "https://daftar.example.invalid/halal");
  await page.keyboard.press("Escape");

  // An http:// document and a javascript: registration link are dropped by the API, not rendered.
  await page.getByTestId("status-pendaftaran").getByRole("button", { name: /Pameran Mitra Daerah/ }).click();
  const dialog2 = page.getByRole("dialog");
  await expect(dialog2.getByRole("link", { name: "Tautan pendaftaran resmi" })).toHaveCount(0);
  await expect(dialog2.getByRole("link", { name: "Dokumen pendukung" })).toHaveCount(0);
  await expect(dialog2.locator('a[href^="http://"], a[href^="javascript:"]')).toHaveCount(0);
  await expect(dialog2.getByTestId("cta-detail")).toBeDisabled();
});

test("the reminder opt-in is idempotent, honest about WhatsApp and can be cancelled", async ({ page }) => {  const state = await bukaAgenda(page);

  const segera = page.getByTestId("status-segera").locator("article", { hasText: "Temu Bisnis Ekspor" });
  await segera.getByRole("button", { name: "Ingatkan saya" }).click();
  const dialog = page.getByRole("dialog");
  // The captcha widget mounts client-side inside the dialog; only then can the form be sent.
  await waitForCaptchaForm(page);
  await dialog.getByLabel("Alamat email").fill("Wawan@Gmail.com");
  await dialog.getByRole("button", { name: "Simpan pengingat" }).click();
  await expect(dialog.getByText(/Pengingat untuk w\*\*\*@gmail\.com aktif/)).toBeVisible({ timeout: 15_000 });
  expect(state.kegiatan.pengingat).toHaveLength(1);
  expect(state.kegiatan.pengingat[0].tujuan).toBe("wawan@gmail.com");
  await page.keyboard.press("Escape");
  await expect(segera.getByTestId("pengingat-aktif-aa000000-0000-4000-8000-000000000004")).toContainText("w***@gmail.com");

  // Asking again with the same address updates the same reminder instead of queueing a second one.
  await segera.getByRole("button", { name: "Ubah" }).click();
  await dialog.getByLabel("Alamat email").fill("wawan@gmail.com");
  await dialog.getByRole("button", { name: "Simpan pengingat" }).click();
  await expect(dialog.getByText(/Pengingat untuk w\*\*\*@gmail\.com aktif/)).toBeVisible({ timeout: 15_000 });
  expect(state.kegiatan.pengingat).toHaveLength(1);
  await page.keyboard.press("Escape");

  // WhatsApp has no gateway in this stack: the request is stored, delivery is not claimed.
  await segera.getByRole("button", { name: "Ubah" }).click();
  await dialog.getByLabel("Kanal pengingat").selectOption("whatsapp");
  await dialog.getByLabel("Nomor WhatsApp").fill("081234567890");
  await dialog.getByRole("button", { name: "Simpan pengingat" }).click();
  await expect(dialog.getByText(/gateway resmi belum tersedia/)).toBeVisible({ timeout: 15_000 });
  expect(state.kegiatan.pengingat.at(-1)).toMatchObject({ kanal: "whatsapp", status: "menunggu_gateway" });
  await page.keyboard.press("Escape");

  // Cancelling the reminder removes it from the queue, idempotently on the server.
  await segera.getByRole("button", { name: "Batalkan" }).click();
  await expect(page.getByTestId("pesan-aksi")).toHaveText("Pengingat dibatalkan.");
  await expect(segera.getByRole("button", { name: "Ingatkan saya" })).toBeVisible();
  expect(state.kegiatan.pengingat.at(-1)).toMatchObject({ kanal: "whatsapp", status: "dibatalkan" });
  // The e-mail reminder of the same event stays queued: only the chosen one was cancelled.
  expect(state.kegiatan.pengingat[0]).toMatchObject({ kanal: "email", status: "menunggu" });
});

// M7-07/M7-09 on a phone viewport: the calendar opens the focus card by tap (hover alone would hide
// the quota/deadline on touch devices) and the detail dialog stays inside the screen.
test.describe("agenda on a phone viewport", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("tap opens the day focus card and the detail dialog fits the screen", async ({ page }) => {
    await bukaAgenda(page);

    const hari = hariIni();
    await page.getByTestId(`hari-${hari}`).tap();
    const fokus = page.getByTestId(`fokus-${hari}`);
    await expect(fokus).toBeVisible();
    await expect(fokus).toContainText("Pelatihan Pemasaran Digital");
    await expect(fokus).toContainText("Sisa 63 dari 100 kuota");

    // A second tap closes it again, so the card never blocks the calendar.
    await page.getByTestId(`hari-${hari}`).tap();
    await expect(fokus).toBeHidden();

    // The timeline stacks on one column and its CTA is tappable.
    const timeline = page.getByRole("region", { name: "Linimasa kegiatan" });
    await expect(timeline).toBeVisible();
    const cta = page.getByTestId("cta-aa000000-0000-4000-8000-000000000002");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "https://daftar.example.invalid/halal");
    // Tapping the official form opens it in a new tab, so the agenda stays where it was.
    const [popup] = await Promise.all([page.waitForEvent("popup"), cta.tap()]);
    await popup.close();

    await page.getByTestId("status-pendaftaran").getByRole("button", { name: /Sertifikasi Halal Gratis/ }).tap();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Skala usaha: Mikro, Kecil")).toBeVisible();
    const kotak = await dialog.boundingBox();
    expect(kotak?.width ?? 0).toBeLessThanOrEqual(390);
  });
});

// Bukti runtime pada stack disposable (PLAYWRIGHT_USE_REAL_API=1 + PLAYWRIGHT_BASE_URL): agenda
// dibaca dari Directus sungguhan dengan kegiatan dummy hasil seed, bukan fixture.
// Prasyarat: migrasi 20260927A + `scripts/seed-dummy-operasional.sql` (agenda Y07).
test.describe("agenda pada stack disposable", () => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack (PLAYWRIGHT_USE_REAL_API=1)");

  const STATUS_SEED = {
    berjalan: "Pelatihan Pemasaran Digital UMKM",
    pendaftaran: "Sertifikasi Halal Gratis Gelombang 3",
    segera: "Temu Bisnis Ekspor Rempah",
    selesai: "Seminar Literasi Digital Batch 2",
  };

  test("kalender, filter server, detail, dan CTA dari data nyata", async ({ page }) => {
    await page.goto("/kegiatan");
    await tungguHidrasi(page);

    await expect(page.getByTestId("status-berjalan")).toContainText(STATUS_SEED.berjalan);
    await expect(page.getByTestId("status-pendaftaran")).toContainText(STATUS_SEED.pendaftaran);
    await expect(page.getByTestId("status-segera")).toContainText(STATUS_SEED.segera);
    await expect(page.getByTestId("status-selesai")).toContainText(STATUS_SEED.selesai);
    // Baris dibatalkan tidak pernah publik.
    await expect(page.getByText("Pelatihan yang Dibatalkan Kurator")).toHaveCount(0);

    // Opsi penyelenggara selalu memuat 27 dinas kabupaten/kota (M7-08).
    const opsi = await page.getByTestId("filter-penyelenggara").locator("option").allInnerTexts();
    expect(opsi.filter((teks) => teks.startsWith("Dinas KUMKM "))).toHaveLength(27);

    // Filter dihitung server: kategori sertifikasi hanya menyisakan satu kegiatan.
    await page.getByTestId("filter-kategori").selectOption("sertifikasi");
    await expect(page.getByTestId("status-pendaftaran")).toContainText(STATUS_SEED.pendaftaran);
    await expect(page.getByTestId("status-pendaftaran")).not.toContainText("Pameran Produk Unggulan Jawa Barat");
    await expect(page.getByTestId("jumlah-hasil")).toContainText("1 kegiatan sesuai filter");
    expect(new URL(page.url()).searchParams.get("kategori")).toBe("sertifikasi");

    // Detail membawa silabus, narasumber, syarat, dan tautan resmi yang aman.
    await page.getByTestId("status-pendaftaran").getByRole("button", { name: /Sertifikasi Halal Gratis/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Alur sertifikasi halal dan audit dapur.")).toBeVisible();
    await expect(dialog.getByText("BPJPH dan pendamping halal")).toBeVisible();
    await expect(dialog.getByText("Skala usaha: Mikro, Kecil")).toBeVisible();
    await expect(dialog.getByText("Wilayah: Kabupaten Subang")).toBeVisible();
    await expect(dialog.getByText("Wajib memiliki NIB", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Tautan pendaftaran resmi" })).toHaveAttribute("href", "https://daftar.example.invalid/halal-gelombang-3");
    await page.keyboard.press("Escape");

    // Kegiatan tanpa tautan pendaftaran: tombol mati dengan pesan jujur.
    await page.getByTestId("reset-filter").click();
    await expect(page.getByTestId("jumlah-hasil")).toContainText("5 kegiatan sesuai filter");
    const pameran = page.getByTestId("status-pendaftaran").locator("article", { hasText: "Pameran Produk Unggulan Jawa Barat" });
    await expect(pameran.getByRole("button", { name: "Daftar Sekarang" })).toBeDisabled();
    await expect(pameran).toContainText("Tautan pendaftaran resmi belum tersedia");
    // Berjalan → tautan streaming resmi; selesai → materi.
    await expect(page.getByTestId("cta-f1000000-0000-4000-8000-000000000001")).toHaveAttribute("href", "https://streaming.example.invalid/pemasaran-digital");
    await expect(page.getByTestId("cta-f1000000-0000-4000-8000-000000000005")).toHaveAttribute("href", "https://materi.example.invalid/seminar-literasi-batch-2");
  });

  test("pengingat email dari browser tersimpan dan tampil tersamarkan", async ({ page }) => {
    await page.goto("/kegiatan");
    await tungguHidrasi(page);

    // "Segera Datang" (pendaftaran tutup/kuota penuh) yang menawarkan pengingat.
    const segera = page.getByTestId("status-segera").locator("article", { hasText: STATUS_SEED.segera });
    const alamat = `dummy_browser_${Date.now()}@contoh.invalid`;
    await segera.getByRole("button", { name: "Ingatkan saya" }).click();
    const dialog = page.getByRole("dialog");
    await waitForCaptchaForm(page);
    await dialog.getByLabel("Alamat email").fill(alamat);
    await dialog.getByRole("button", { name: "Simpan pengingat" }).click();
    await expect(dialog.getByText(/Pengingat untuk d\*\*\*@contoh\.invalid aktif/)).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press("Escape");
    await expect(segera.getByTestId("pengingat-aktif-f1000000-0000-4000-8000-000000000004")).toContainText("d***@contoh.invalid");

    // WhatsApp tanpa gateway: permintaan tersimpan, pengiriman tidak diklaim.
    await segera.getByRole("button", { name: "Ubah" }).click();
    await dialog.getByLabel("Kanal pengingat").selectOption("whatsapp");
    await dialog.getByLabel("Nomor WhatsApp").fill("081234567890");
    await dialog.getByRole("button", { name: "Simpan pengingat" }).click();
    await expect(dialog.getByText(/gateway resmi belum tersedia/)).toBeVisible({ timeout: 60_000 });
    await expect(dialog.getByText("menunggu_gateway")).toHaveCount(0);
  });

  test.describe("ponsel", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test("kalender dan detail terbaca pada viewport ponsel", async ({ page }) => {
      await page.goto("/kegiatan");
      await tungguHidrasi(page);

      const hari = hariIni();
      await page.getByTestId(`hari-${hari}`).tap();
      await expect(page.getByTestId(`fokus-${hari}`)).toContainText(STATUS_SEED.berjalan);
      await page.getByTestId(`hari-${hari}`).tap();

      await page.getByTestId("status-pendaftaran").getByRole("button", { name: /Sertifikasi Halal Gratis/ }).tap();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Skala usaha: Mikro, Kecil")).toBeVisible();
      const kotak = await dialog.boundingBox();
      expect(kotak?.width ?? 0).toBeLessThanOrEqual(390);
    });
  });
});

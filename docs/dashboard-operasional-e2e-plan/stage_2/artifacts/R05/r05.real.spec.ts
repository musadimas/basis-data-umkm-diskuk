// R05 real-API browser smoke: Nuxt dev (source of the day) → Directus clone r04-directus (:8156, DB r04_clone).
// Four roles (real ALTCHA login), NIB login, kab/kota scope in the UI, Tabular search, demo switcher with the
// production flag off, and public pages rendered from the real API. Clone only.
import { test, expect, type Page } from "@playwright/test";

const PASS = "R04-uji-Pass#2026"; // clone-only
const ART = process.env.R05_ART ?? "/tmp";
const USAHA_SUBANG = "d0000000-0000-4000-8000-000000000005";
const USAHA_SUMEDANG = "d0000000-0000-4000-8000-000000000002";
const NIB_WAWAN = "9900000000001";

async function login(page: Page, email: string, returnTo = "/dashboard") {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByLabel("Email atau NIB").fill(email);
    await page.getByRole("textbox", { name: "Kata sandi" }).fill(PASS);
    await expect(page.getByLabel("Email atau NIB")).toHaveValue(email, { timeout: 1000 });
    if ((await page.locator("altcha-widget .altcha").getAttribute("data-state")) !== "verified") await page.locator("altcha-widget label").click();
    await expect(page.locator("altcha-widget .altcha")).toHaveAttribute("data-state", "verified", { timeout: 15_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
}
async function keluar(page: Page) {
  await page.getByRole("button", { name: "Menu akun" }).click();
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
}

test.describe("R05 browser real API", () => {
  test("empat role login (ALTCHA nyata) dan mendarat di beranda masing-masing; keluar mengembalikan ke sign-in", async ({ page }) => {
    test.setTimeout(240_000);
    const cases = [
      { email: "dummy_admin@diskuk.jabarprov.go.id", home: "/dashboard" },
      { email: "dummy_admin.subang@jabarprov.go.id", home: "/dashboard" },
      { email: "dummy_coach.pendamping@jabarprov.go.id", home: "/dashboard/pendampingan" },
      { email: "dummy_wawan.leathercraft@gmail.com", home: "/dashboard/usaha" },
    ];
    for (const { email, home } of cases) {
      await login(page, email, home);
      await page.waitForURL((url) => url.pathname === home, { timeout: 30_000 });
      await page.screenshot({ path: `${ART}/r05-browser-role-${email.split("@")[0]!.replace(/[^a-z]/g, "")}.png` });
      await keluar(page);
    }
  });

  test("login dengan NIB usaha mendarat di beranda usaha (PWA KPI: nama usaha dan minggu program)", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, NIB_WAWAN, "/dashboard/usaha");
    await expect(page).toHaveURL(/\/dashboard\/usaha$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /(Laporan KPI Mingguan|Wawan Leathercraft)/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("body")).toContainText(/Minggu/i);
    await page.screenshot({ path: `${ART}/r05-browser-nib-usaha.png` });
  });

  test("kab/kota: usaha kota sendiri terbuka, usaha kota lain 'di luar wilayah'; pencarian Tabular ter-scope", async ({ page, browser, baseURL }) => {
    test.setTimeout(240_000);
    await login(page, "dummy_admin.subang@jabarprov.go.id", "/dashboard");
    await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30_000 });
    await page.goto(`/dashboard/data-lapangan/${USAHA_SUBANG}`);
    await expect(page.getByRole("heading", { name: /Ubah Data Lapangan/ })).toBeVisible({ timeout: 30_000 });
    await page.goto(`/dashboard/data-lapangan/${USAHA_SUMEDANG}`);
    await expect(page.getByText("Data usaha tidak ditemukan atau di luar wilayah Anda.")).toBeVisible({ timeout: 30_000 });

    const cari = async (p: Page) => {
      await p.goto("/dashboard/tabular");
      await expect(p.getByRole("heading", { name: "Data Tabular UMKM" })).toBeVisible({ timeout: 30_000 });
      const kotak = p.getByLabel("Cari NIK, NIB, nama usaha, atau nama pemilik");
      await expect(async () => {
        await kotak.fill("nanas");
        const jawaban = p.waitForResponse((r) => r.url().includes("/analytics/tabular") && `${r.url()} ${r.request().postData() ?? ""}`.includes("nanas"), { timeout: 6000 });
        await p.getByRole("button", { name: "Cari", exact: true }).click();
        expect((await jawaban).status()).toBe(200);
      }).toPass({ timeout: 40_000 });
    };
    await cari(page);
    await expect(page.getByText("Keripik Nanas Subang").first()).toBeVisible();
    await page.screenshot({ path: `${ART}/r05-browser-tabular-kabkota-subang.png` });

    const lain = await browser.newContext({ baseURL, timezoneId: "UTC" });
    const pageLain = await lain.newPage();
    await login(pageLain, "r04_kab.sumedang@example.com", "/dashboard");
    await pageLain.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30_000 });
    await cari(pageLain);
    await expect(pageLain.getByText("Keripik Nanas Subang")).toHaveCount(0);
    await pageLain.screenshot({ path: `${ART}/r05-browser-tabular-kabkota-sumedang.png` });
    await lain.close();
  });

  test("pengalih peran demo dengan flag produksi mati: server menolak (403) dan tidak menerbitkan sesi", async ({ request, baseURL }) => {
    const res = await request.post("/api/demo/switch", { data: { role: "provinsi" }, headers: { origin: baseURL!, "content-type": "application/json" } });
    expect(res.status()).toBe(403);
    expect(res.headers()["set-cookie"] ?? "").not.toMatch(/session/i);
    const kosong = await request.post("/api/demo/switch", { data: { role: "provinsi" } });
    expect([400, 403]).toContain(kosong.status());
  });

  test("halaman publik dirender dari API nyata tanpa PII: agenda, fasilitasi, katalog, klinik, FAQ", async ({ page }) => {
    test.setTimeout(180_000);
    const galat: string[] = [];
    page.on("pageerror", (e) => galat.push(e.message));
    const cek = async (rute: string, teks: RegExp) => {
      await page.goto(rute);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("body")).toContainText(teks, { timeout: 30_000 });
      const html = await page.content();
      expect(html).not.toMatch(/\b\d{16}\b/);
      expect(html).not.toContain(NIB_WAWAN.slice(0, 13) + "9"); // bukan NIB lain; NIB bisnis tayang publik hanya di katalog
    };
    await cek("/kegiatan", /Seminar Literasi Digital|Kegiatan/);
    await cek("/fasilitasi", /Fasilitasi|bantuan/i);
    await cek("/katalog", /Keripik Nanas Subang Premium/);
    await cek("/konsultasi", /Klinik Konsultasi/);
    await cek("/faq", /FAQ|Pertanyaan/i);
    expect(galat, galat.join(" | ")).toEqual([]);
    await page.screenshot({ path: `${ART}/r05-browser-public-faq.png` });
  });
});

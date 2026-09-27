// Runtime proof Y01+Y02 pada disposable stack (PLAYWRIGHT_USE_REAL_API=1).
// Tanpa stack: skip (verdict not runtime-proven, bukan done).
// Prasyarat: migrasi C+E, seed Y01 (akun + usaha dummy) + seed Y02 (atribut).
import { test, expect } from "@playwright/test";

const KABKOTA_EMAIL = process.env.DUMMY_KABKOTA_EMAIL || "dummy_admin.subang@jabarprov.go.id";
const KABKOTA_PASSWORD = process.env.DUMMY_KABKOTA_PASSWORD || "";
const PROVINSI_EMAIL = process.env.DUMMY_PROVINSI_EMAIL || "dummy_admin@diskuk.jabarprov.go.id";
const USAHA_SUBANG = process.env.DUMMY_USAHA_SUBANG || "d0000000-0000-4000-8000-000000000005";
const USAHA_LUAR = process.env.DUMMY_USAHA_LUAR || "d0000000-0000-4000-8000-000000000003";
const NIB_USAHA = process.env.DUMMY_NIB_USAHA || "9900000000001";
const USAHA_EMAIL = process.env.DUMMY_UMKM_EMAIL || "dummy_wawan.leathercraft@gmail.com";
const PENDAMPING_EMAIL = process.env.DUMMY_PENDAMPING_EMAIL || "dummy_coach.pendamping@jabarprov.go.id";

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email / NIB").fill(email);
  await page.getByRole("textbox", { name: "Kata sandi" }).fill(password);
  await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("Y02 data lapangan: kabkota ubah atribut usaha sendiri; usaha luar → 404", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!KABKOTA_PASSWORD, "butuh DUMMY_KABKOTA_PASSWORD");
  await login(page, KABKOTA_EMAIL, KABKOTA_PASSWORD);
  await page.goto(`/dashboard/data-lapangan/${USAHA_SUBANG}`);
  await expect(page.getByRole("heading", { name: /Ubah Data Lapangan/ })).toBeVisible();
  await page.getByLabel("Pembukuan Digital").selectOption("false");
  await page.getByRole("button", { name: "Simpan Perubahan" }).click();
  await expect(page.getByText("Data lapangan tersimpan.")).toBeVisible();
  expect((await page.request.get(`/panel/operasional/usaha/${USAHA_LUAR}`)).status()).toBe(404);
});

// ── Y01: identitas, login per role, NIB, dan reset kata sandi ───────────────

const DEMO_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "";

test("Y01 login empat role dummy mendarat di beranda masing-masing", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!DEMO_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");
  const cases = [
    { email: PROVINSI_EMAIL, home: "/dashboard" },
    { email: KABKOTA_EMAIL, home: "/dashboard" },
    { email: PENDAMPING_EMAIL, home: "/dashboard/pendampingan" },
    { email: USAHA_EMAIL, home: "/dashboard/usaha" },
  ];
  for (const { email, home } of cases) {
    await page.goto("/sign-in");
    await page.getByLabel("Email / NIB").fill(email);
    await page.getByRole("textbox", { name: "Kata sandi" }).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(home.replace(/\//g, "\\/") + "$"));
    await page.getByRole("button", { name: "Menu profil" }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  }
});

test("Y01 login NIB usaha dummy mendarat di beranda usaha", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!DEMO_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");
  await page.goto("/sign-in?returnTo=/dashboard");
  await page.getByLabel("Email / NIB").fill(NIB_USAHA);
  await page.getByRole("textbox", { name: "Kata sandi" }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/usaha$/);
  await expect(page.getByTestId("phone-frame")).toBeVisible();
});

test("Y01 lupa kata sandi: tautan Mailpit → reset → login sandi baru", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!DEMO_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");
  const mailpit = process.env.MAILPIT_API_URL || "http://127.0.0.1:8025";
  test.skip(!process.env.MAILPIT_API_URL, "butuh MAILPIT_API_URL");

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(USAHA_EMAIL);
  await page.getByRole("button", { name: "Kirim Tautan Pemulihan" }).click();
  await expect(page.getByText("Tautan pemulihan telah dikirim bila email terdaftar.")).toBeVisible();

  // Ambil token dari tautan reset pada pesan Mailpit terbaru untuk email tsb.
  const inbox = await page.request.get(`${mailpit}/api/v1/messages`);
  expect(inbox.status()).toBe(200);
  // SAFETY: bentuk respons API Mailpit /api/v1/messages adalah { messages: [...] }.
  const inboxJson = await inbox.json() as { messages: { ID: string; To: { Address: string }[] }[] };
  const message = inboxJson.messages.find((m) =>
    m.To.some((to) => to.Address.toLowerCase() === USAHA_EMAIL.toLowerCase()),
  );
  expect(message, "email reset belum masuk ke Mailpit").toBeTruthy();
  // SAFETY: bentuk respons API Mailpit /api/v1/message/:id membawa HTML/Text.
  const detail = await (await page.request.get(`${mailpit}/api/v1/message/${message!.ID}`)).json() as { HTML?: string; Text?: string };
  const tokenMatch = (detail.HTML || detail.Text || "").match(/[?&]token=([A-Za-z0-9_-]+)/);
  expect(tokenMatch, "tautan reset tidak memuat token").toBeTruthy();

  await page.goto(`/forgot-password?token=${tokenMatch![1]}`);
  await page.getByLabel("Kata sandi baru", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByLabel("Konfirmasi kata sandi baru").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Simpan Kata Sandi Baru" }).click();
  await expect(page).toHaveURL(/\/sign-in/);

  await page.goto("/sign-in?returnTo=/dashboard");
  await page.getByLabel("Email / NIB").fill(USAHA_EMAIL);
  await page.getByRole("textbox", { name: "Kata sandi" }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/usaha$/);

  await page.getByRole("button", { name: "Menu profil" }).click();
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  expect((await page.request.get("/panel/infografis/")).status()).toBe(401);
});

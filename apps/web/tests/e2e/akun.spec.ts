import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock, waitForCaptchaForm } from "../fixtures/mock-directus.mjs";

type CapturedRequest = { method: string; path: string; body: { email?: string; captcha?: string; password?: string; mode?: string } | null };

test.describe("Modul 1 · autentikasi & akun", () => {
  test("login with NIB solves the captcha and posts it once to the native /auth/login", async ({ page }) => {
    const requests: CapturedRequest[] = [];
    await installMockDirectus(page, { requests });
    await page.goto("/sign-in?returnTo=/dashboard/akun");
    await waitForCaptchaForm(page);
    await page.getByLabel("Email atau NIB").fill("1234567890123");
    await page.getByRole("textbox", { name: "Kata sandi" }).fill("not-a-real-secret");
    await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard\/akun$/);
    const logins = requests.filter((request) => request.path === "/panel/auth/login");
    expect(logins).toHaveLength(1);
    expect(logins[0]!.body?.email).toBe("1234567890123");
    expect(logins[0]!.body?.mode).toBe("session");
    const decoded = JSON.parse(Buffer.from(logins[0]!.body?.captcha ?? "", "base64").toString("utf8"));
    expect(decoded.challenge.parameters.algorithm).toBe("PBKDF2/SHA-256");
    expect(decoded.solution.derivedKey).toMatch(/^[0-9a-f]+$/);
  });

  test("rejects a malformed NIB before contacting the server", async ({ page }) => {
    const requests: CapturedRequest[] = [];
    await installMockDirectus(page, { requests });
    await page.goto("/sign-in");
    await waitForCaptchaForm(page);
    await page.getByLabel("Email atau NIB").fill("12345");
    await page.getByRole("textbox", { name: "Kata sandi" }).fill("x");
    await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();
    await expect(page.getByRole("alert")).toHaveText("NIB terdiri dari 13 digit angka.");
    expect(requests.some((request) => request.path === "/panel/auth/login")).toBe(false);
  });

  test("failed login shows a generic message and renews the captcha", async ({ page }) => {
    const requests: CapturedRequest[] = [];
    await installMockDirectus(page, { requests });
    await page.goto("/sign-in");
    await waitForCaptchaForm(page);
    await page.getByLabel("Email atau NIB").fill("analyst@example.invalid");
    await page.getByRole("textbox", { name: "Kata sandi" }).fill("wrong-password");
    await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();
    await expect(page.getByRole("alert")).toHaveText("Email/NIB atau kata sandi tidak sesuai.");
    await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();
    await expect(page.getByRole("alert")).toHaveText("Email/NIB atau kata sandi tidak sesuai.");
    const payloads = requests.filter((request) => request.path === "/panel/auth/login").map((request) => request.body?.captcha);
    expect(payloads).toHaveLength(2);
    expect(payloads[0]).not.toBe(payloads[1]);
  });

  test("forgot password sends identifier with captcha and confirms neutrally", async ({ page }) => {
    const requests: CapturedRequest[] = [];
    await installMockDirectus(page, { requests });
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Lupa Kata Sandi?" }).click();
    await expect(page).toHaveURL(/\/lupa-kata-sandi$/);
    await waitForCaptchaForm(page);
    await page.getByLabel("Email atau NIB").fill("analyst@example.invalid");
    await page.getByRole("button", { name: "Kirim Tautan Reset" }).click();
    await expect(page.getByRole("status")).toContainText("Bila akun terdaftar");
    const sent = requests.find((request) => request.path === "/panel/auth/password/request");
    expect(sent?.body?.email).toBe("analyst@example.invalid");
    expect(sent?.body?.captcha).toBeTruthy();
  });

  test("reset page sets a new password from the emailed token", async ({ page }) => {
    const requests: CapturedRequest[] = [];
    await installMockDirectus(page, { requests });
    await page.goto("/reset-kata-sandi?token=reset-token");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Kata sandi baru", { exact: true }).fill("kata-sandi-baru-123");
    await page.getByLabel("Ulangi kata sandi baru").fill("kata-sandi-baru-123");
    await page.getByRole("button", { name: "Simpan Kata Sandi" }).click();
    await expect(page.getByRole("status")).toContainText("Kata sandi berhasil diperbarui");
    expect(requests.find((request) => request.path === "/panel/auth/password/reset")?.body).toEqual({
      token: "reset-token",
      password: "kata-sandi-baru-123",
    });
  });

  test("profile header shows identity, role badge, and account menu", async ({ page }) => {
    await installMockDirectus(page);
    await loginMock(page);
    const menu = page.getByRole("button", { name: "Menu akun" });
    await expect(menu).toBeVisible();
    await menu.click();
    const dropdown = page.getByRole("menu");
    await expect(dropdown).toContainText("Analis Provinsi");
    await expect(dropdown).toContainText("DISKUK Provinsi Jawa Barat");
    await expect(dropdown).toContainText("Provinsi");
    await dropdown.getByRole("menuitem", { name: "Log Aktivitas Sesi" }).click();
    await expect(page).toHaveURL(/\/dashboard\/akun\/aktivitas$/);
    await expect(page.getByRole("cell", { name: "Percobaan masuk gagal (kredensial tidak sesuai)" })).toBeVisible();

    await page.getByRole("button", { name: "Menu akun" }).click();
    await page.getByRole("menuitem", { name: "Pengaturan Akun & Keamanan" }).click();
    await expect(page).toHaveURL(/\/dashboard\/akun$/);
    await page.getByLabel("Kata sandi saat ini").fill("salah");
    await page.getByLabel("Kata sandi baru", { exact: true }).fill("kata-sandi-baru-123");
    await page.getByLabel("Ulangi kata sandi baru").fill("kata-sandi-baru-123");
    await page.getByRole("button", { name: "Perbarui Kata Sandi" }).click();
    await expect(page.getByRole("alert")).toHaveText("Kata sandi saat ini tidak sesuai.");

    await page.getByRole("button", { name: "Menu akun" }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

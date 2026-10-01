// Y04 + Y09 real-API browser proof against the isolated y49 clone (Directus :8255 via nuxt dev :3255).
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

const ART = process.env.Y49_ART!;
const PASS = "Y49-pass-Tmp!";
const USAHA6 = "d0000000-0000-4000-8000-000000000006";
const sql = (q: string) => execFileSync("docker", ["exec", "-i", "diskuk-operasional-e2e-postgis-1", "psql", "-U", "diskuk_app", "-d", "y49_clone", "-Atc", q], { encoding: "utf8" }).trim();
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function login(page: Page, email: string, returnTo: string) {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.waitForLoadState("networkidle");
  // Values typed before hydration are dropped; retry the whole form until the widget verifies.
  await expect(async () => {
    await page.getByLabel("Email atau NIB").fill(email);
    await page.getByRole("textbox", { name: "Kata sandi" }).fill(PASS);
    await expect(page.getByLabel("Email atau NIB")).toHaveValue(email, { timeout: 1000 });
    if ((await page.locator("altcha-widget .altcha").getAttribute("data-state")) !== "verified") await page.locator("altcha-widget label").click();
    await expect(page.locator("altcha-widget .altcha")).toHaveAttribute("data-state", "verified", { timeout: 15_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
  await page.waitForURL((url) => url.pathname === returnTo.split("?")[0], { timeout: 30_000 });
}
async function decodeQr(png: Buffer) {
  const req = createRequire(`${process.env.Y49_QR_DIR}/`);
  const { PNG: P } = req("pngjs");
  const jsQR = req("jsqr");
  const img = P.sync.read(png);
  return jsQR(new Uint8ClampedArray(img.data), img.width, img.height)?.data ?? null;
}

test.describe.serial("Y04 produk -> kurasi -> passport -> QR -> verifikasi -> cabut (real API)", () => {
  let kode = "";
  test("umkm uploads a real photo and submits a product (lands in private curation folder)", async ({ page }) => {
    await login(page, "y49_umkm6@example.com", "/dashboard/usaha/produk");
    await page.goto(`/dashboard/usaha/produk?usaha=${USAHA6}`);
    await expect(async () => {
      await page.getByRole("button", { name: "Tambah Produk" }).click();
      await expect(page.getByText("dilarang memanipulasi transaksi maupun ulasan")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 20_000 });
    await page.getByLabel("Nama produk").fill("Madu Browser Y49");
    await page.locator('input[data-testid="foto-produk-input"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await page.getByLabel("Sertifikasi uji lab").fill("Lab Browser Y49");
    await page.getByRole("button", { name: "Ajukan ke Kurasi" }).click();
    await expect(page.getByText("Produk diajukan ke kurasi DISKUK.")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${ART}/y04-browser-1-umkm-submit.png` });
    expect(sql(`select status_kurasi from produk where nama='Madu Browser Y49'`)).toBe("menunggu");
    expect(sql(`select f.folder from produk p join produk_foto pf on pf.produk_id=p.id join directus_files f on f.id=pf.directus_files_id where p.nama='Madu Browser Y49'`)).toBe("6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f11");
  });
  test("curator (provinsi) approves it in the kurasi UI; decision read back in SQL", async ({ page }) => {
    await login(page, "dummy_admin@diskuk.jabarprov.go.id", "/dashboard/katalog/kurasi");
    await expect(page.getByText("Madu Browser Y49")).toBeVisible({ timeout: 20_000 });
    await expect(async () => {
      await page.getByRole("row", { name: /Madu Browser Y49/ }).or(page.locator("li,tr,article").filter({ hasText: "Madu Browser Y49" })).getByRole("button", { name: /Kurasi/ }).first().click();
      await expect(page.getByRole("button", { name: "Tayangkan", exact: true })).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 20_000 });
    await page.screenshot({ path: `${ART}/y04-browser-2-kurasi-open.png` });
    await page.getByRole("button", { name: "Tayangkan", exact: true }).click();
    await expect(page.getByText("Madu Browser Y49: Tayang.")).toBeVisible({ timeout: 20_000 });
    expect(sql(`select status_kurasi from produk where nama='Madu Browser Y49'`)).toBe("tayang");
    expect(sql(`select f.folder from produk p join produk_foto pf on pf.produk_id=p.id join directus_files f on f.id=pf.directus_files_id where p.nama='Madu Browser Y49'`)).toBe("6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10");
  });
  test("provinsi issues the passport in the UI (after the API-issued one is revoked in SQL)", async ({ page }) => {
    sql(`update talent_passport set status='dicabut', dicabut_at=now() where usaha='${USAHA6}' and status='aktif'`);
    await login(page, "dummy_admin@diskuk.jabarprov.go.id", "/dashboard/usaha/passport");
    await page.goto(`/dashboard/usaha/passport?usaha=${USAHA6}`);
    await expect(async () => {
      await page.getByRole("button", { name: "Terbitkan Talent Passport" }).click();
      await expect(page.getByTestId("passport-kode")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });
    kode = (await page.getByTestId("passport-kode").innerText()).trim();
    expect(kode).toMatch(/^TP[0-9A-Z]{10}$/);
    await expect(page.getByTestId("badge-pdn_deklarasi")).toHaveAttribute("data-terverifikasi", "false");
    await page.screenshot({ path: `${ART}/y04-browser-3-passport-issued.png`, fullPage: true });
    expect(sql(`select count(*) from talent_passport where usaha='${USAHA6}' and status='aktif' and kode='${kode}'`)).toBe("1");
  });
  test("QR (PNG download + PDF rasterised) decodes to the public verification URL; public page valid without login", async ({ page, browser }, testInfo) => {
    await login(page, "y49_umkm6@example.com", "/dashboard/usaha/passport");
    await page.goto(`/dashboard/usaha/passport?usaha=${USAHA6}`);
    await expect(page.getByTestId("passport-kode")).toHaveText(kode, { timeout: 30_000 });
    const img = page.locator(`img[alt="QR verifikasi ${kode}"]`);
    await expect(img).toBeVisible();
    const dl = page.waitForEvent("download");
    await page.getByRole("link", { name: /Unduh QR \(PNG\)/ }).click();
    const png = readFileSync((await (await dl).path())!);
    writeFileSync(`${ART}/y04-qr-download.png`, png);
    const decoded = await decodeQr(png);
    console.log("QR PNG decodes to:", decoded);
    expect(decoded).toBe(`http://127.0.0.1:3255/passport/${kode}`);
    const dlPdf = page.waitForEvent("download");
    await page.getByTestId("unduh-qr-pdf").click();
    const pdfDl = await dlPdf;
    const pdfPath = `${ART}/y04-qr-${kode}.pdf`;
    writeFileSync(pdfPath, readFileSync((await pdfDl.path())!));
    expect(readFileSync(pdfPath).subarray(0, 5).toString()).toBe("%PDF-");
    execFileSync("sips", ["-s", "format", "png", "-s", "dpiWidth", "300", "-s", "dpiHeight", "300", pdfPath, "--out", `${ART}/y04-qr-pdf-raster.png`]);
    const rasterDecoded = await decodeQr(readFileSync(`${ART}/y04-qr-pdf-raster.png`));
    console.log("QR in PDF (rasterised) decodes to:", rasterDecoded);
    // anonymous context: follow the decoded URL
    const anon = await browser.newContext();
    const p2 = await anon.newPage();
    await p2.goto(decoded!);
    await expect(p2.getByText("Tanda tangan digital DISKUK Jawa Barat valid")).toBeVisible({ timeout: 30_000 });
    await expect(p2.getByText(kode).first()).toBeVisible();
    await p2.screenshot({ path: `${ART}/y04-browser-4-public-verify-valid.png`, fullPage: true });
    // tamper in DB -> public page invalid
    sql(`update talent_passport set payload = jsonb_set(payload,'{skor,finansial}','99') where kode='${kode}'`);
    await p2.reload();
    await expect(p2.getByText("Talent Passport tidak valid")).toBeVisible({ timeout: 30_000 });
    await p2.screenshot({ path: `${ART}/y04-browser-5-public-verify-tampered.png` });
    await anon.close();
    expect(rasterDecoded).toBe(`http://127.0.0.1:3255/passport/${kode}`);
  });
  test("provinsi revokes in the UI; public page says revoked", async ({ page, browser }) => {
    // restore the tampered payload from the signed hash is impossible; re-issue a clean passport instead
    sql(`update talent_passport set status='dicabut', dicabut_at=now() where usaha='${USAHA6}' and status='aktif'`);
    await login(page, "dummy_admin@diskuk.jabarprov.go.id", "/dashboard/usaha/passport");
    await page.goto(`/dashboard/usaha/passport?usaha=${USAHA6}`);
    await expect(async () => {
      await page.getByRole("button", { name: "Terbitkan Talent Passport" }).click();
      await expect(page.getByTestId("passport-kode")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });
    const k2 = (await page.getByTestId("passport-kode").innerText()).trim();
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cabut passport" }).click();
    await expect.poll(() => sql(`select status from talent_passport where kode='${k2}'`), { timeout: 20_000 }).toBe("dicabut");
    const anon = await browser.newContext();
    const p2 = await anon.newPage();
    await p2.goto(`/passport/${k2}`);
    await expect(p2.getByText("Talent Passport sudah dicabut")).toBeVisible({ timeout: 30_000 });
    await p2.screenshot({ path: `${ART}/y04-browser-6-public-verify-revoked.png` });
    await anon.close();
    await p2.context();
  });
});

// ── Y09 ─────────────────────────────────────────────────────────────────────
const made = JSON.parse(readFileSync(process.env.Y49_MADE!, "utf8")) as Record<"s1" | "s6" | "m2" | "m2b" | "anon", string>;
function nextWeekday(offset: number) {
  const date = new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

test.describe.serial("Y09 klinik (real API)", () => {
  let nomorBaru = "";
  test("public visitor books a ticket through the 4-step form and reads it back by number + WhatsApp", async ({ page }) => {
    await page.goto("/konsultasi");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("poli-kartu")).toHaveCount(6, { timeout: 30_000 });
    await page.screenshot({ path: `${ART}/y09-browser-1-landing-6-poli.png`, fullPage: true });
    await expect(async () => {
      await page.getByLabel("Nama usaha").fill("Warung Browser Y49");
      await page.getByLabel("Nama narahubung").fill("Bu Browser");
      await page.getByLabel("Nomor WhatsApp").fill("085555555555");
      await page.getByRole("button", { name: "Lanjut" }).click();
      await expect(page.getByLabel("Ceritakan permasalahan usaha Anda")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 30_000 });
    await page.getByRole("radio", { name: /Legalitas & Standardisasi Produk/ }).check();
    await page.getByLabel("Ceritakan permasalahan usaha Anda").fill("Kami butuh bantuan mengurus sertifikat halal dan PIRT untuk produk baru.");
    await page.getByRole("button", { name: "Lanjut" }).click();
    await page.getByLabel("Tanggal (Senin–Jumat)").fill(nextWeekday(20));
    await page.getByRole("radio", { name: "14:30" }).click();
    await page.getByRole("button", { name: "Lanjut" }).click();
    await page.screenshot({ path: `${ART}/y09-browser-2-form-step4.png`, fullPage: true });
    const widget = page.locator("altcha-widget label");
    if (await widget.count()) { await widget.click(); await expect(page.locator("altcha-widget .altcha")).toHaveAttribute("data-state", "verified", { timeout: 30_000 }); }
    await page.getByRole("checkbox").first().check().catch(() => {});
    await page.getByRole("button", { name: "Kirim Tiket" }).click();
    await expect(page.getByTestId("nomor-tiket")).toHaveText(/KLN-\d{4}-\d{2}-\d{4}/, { timeout: 30_000 });
    nomorBaru = (await page.getByTestId("nomor-tiket").innerText()).trim();
    await expect(page.getByTestId("status-notifikasi")).toContainText(/Menunggu (dikirim|gateway)/);
    await page.screenshot({ path: `${ART}/y09-browser-3-ticket-number.png`, fullPage: true });
    expect(sql(`select sumber_identitas||'|'||status from konsultasi_tiket where nomor='${nomorBaru}'`)).toBe("manual|masuk");
    // read back with the right and a wrong number
    await page.getByRole("button", { name: "Lacak status tiket" }).click();
    await expect(page.getByRole("region", { name: "Lacak tiket konsultasi" })).toBeVisible();
    await expect(async () => {
      await page.getByLabel("Nomor tiket").fill(nomorBaru);
      await page.getByLabel("Nomor WhatsApp").fill("085555555555");
      await page.getByRole("button", { name: "Lacak" }).click();
      await expect(page.getByTestId("hasil-lacak")).toBeVisible({ timeout: 8000 });
    }).toPass({ timeout: 60_000 });
    const hasil = await page.getByTestId("hasil-lacak").innerText();
    expect(hasil).toContain("Tiket Masuk");
    expect(hasil).not.toMatch(/085555555555|6285555555555|Bu Browser|sertifikat halal/);
    await page.screenshot({ path: `${ART}/y09-browser-4-track-result.png`, fullPage: true });
    await expect(async () => {
      await page.getByLabel("Nomor WhatsApp").fill("081200000000");
      await page.getByRole("button", { name: "Lacak" }).click();
      await expect(page.getByRole("alert")).toContainText("tidak cocok", { timeout: 8000 });
    }).toPass({ timeout: 60_000 });
    await expect(page.getByTestId("hasil-lacak")).toHaveCount(0);
  });

  test("kabkota Subang kanban shows only Subang tickets; kabkota Sumedang only Sumedang", async ({ browser }) => {
    for (const [email, own, other, shot] of [
      ["dummy_admin.subang@jabarprov.go.id", [made.s1, made.s6], [made.m2, made.m2b, made.anon], "y09-browser-5-kab-subang-kanban"],
      ["y49_kab_sumedang@example.com", [made.m2, made.m2b], [made.s1, made.s6, made.anon], "y09-browser-6-kab-sumedang-kanban"],
    ] as const) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, email, "/dashboard/klinik");
      await expect(page.getByTestId("kolom-masuk")).toBeVisible({ timeout: 30_000 });
      for (const n of own) await expect(page.getByText(n).first()).toBeVisible({ timeout: 20_000 });
      for (const n of other) await expect(page.getByText(n)).toHaveCount(0);
      const body = await page.locator("main").innerText();
      expect(body).not.toContain(nomorBaru); // manual (no city) ticket is province-level triage
      await page.screenshot({ path: `${ART}/${shot}.png`, fullPage: true });
      await ctx.close();
    }
  });

  test("umkm account gets the read-back form, not the staff kanban", async ({ page }) => {
    await login(page, "y49_umkm2@example.com", "/dashboard/klinik");
    await expect(page.getByRole("region", { name: "Lacak tiket konsultasi" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("kolom-masuk")).toHaveCount(0);
    await page.screenshot({ path: `${ART}/y09-browser-7-umkm-no-kanban.png` });
  });

  test("provinsi works a ticket: claim, save, then a stale save by a second session gets the conflict message; audit trail visible", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    await login(a, "dummy_admin@diskuk.jabarprov.go.id", "/dashboard/klinik");
    const ctxB2 = ctxB;
    const b2 = b;
    await login(b2, "dummy_admin@diskuk.jabarprov.go.id", "/dashboard/klinik");
    for (const p of [a, b2]) {
      await expect(p.getByText(nomorBaru).first()).toBeVisible({ timeout: 30_000 });
      await expect(async () => {
        await p.getByRole("button", { name: "Warung Browser Y49" }).first().click();
        await expect(p.getByTestId("pilih-status")).toBeVisible({ timeout: 1500 });
      }).toPass({ timeout: 20_000 });
    }
    await a.getByRole("button", { name: "Ambil tiket ini" }).click();
    await expect(a.getByText("Pendamping: Admin DISKUK Provinsi")).toBeVisible({ timeout: 20_000 });
    await expect(a.getByRole("button", { name: "Ambil tiket ini" })).toHaveCount(0);
    await a.getByLabel("Rencana aksi").fill("Rencana A (browser)");
    await a.getByRole("button", { name: "Simpan" }).click();
    await expect(a.getByTestId("riwayat-tiket")).toContainText("Catatan", { timeout: 20_000 });
    await a.screenshot({ path: `${ART}/y09-browser-8-detail-audit.png`, fullPage: true });
    // second session still holds the old version
    await b2.getByLabel("Catatan internal").fill("Catatan B (stale)");
    await b2.getByRole("button", { name: "Simpan" }).click();
    await expect(b2.getByText("sudah diubah petugas lain", { exact: false })).toBeVisible({ timeout: 20_000 });
    await b2.screenshot({ path: `${ART}/y09-browser-9-stale-conflict.png`, fullPage: true });
    expect(sql(`select coalesce(catatan,'-') from konsultasi_tiket where nomor='${nomorBaru}'`)).toBe("-");
    expect(sql(`select count(*) from konsultasi_tiket_audit a join konsultasi_tiket t on t.id=a.tiket where t.nomor='${nomorBaru}'`)).toBe("2");
    await ctxA.close(); await ctxB2.close();
  });
});

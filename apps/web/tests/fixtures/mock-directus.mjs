export async function installMockDirectus(page, { authenticated = false } = {}) {
  let loggedIn = authenticated;
  await page.route("**/panel/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/panel/auth/login") {
      loggedIn = true;
      await route.fulfill({ status: 200, contentType: "application/json", headers: { "set-cookie": "diskuk_session_started=x; Path=/; HttpOnly" }, body: JSON.stringify({ data: { expires: "2099-01-01T00:00:00Z" } }) });
      return;
    }
    if (path === "/panel/auth/logout") { loggedIn = false; await route.fulfill({ status: 204, body: "" }); return; }
    if (path === "/panel/users/me") {
      if (!loggedIn) { await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ errors: [{ message: "unauthorized" }] }) }); return; }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id: "user-1", email: "analyst@example.invalid", first_name: "Analis", role: "7d6d493c-1a6d-4c59-9e74-40d42a7862eb" } }) });
      return;
    }
    if (!loggedIn) { await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ errors: [{ message: "unauthorized" }] }) }); return; }
    if (path === "/panel/infografis/") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { scales: { total: 3, mikro: 2, kecil: 1, menengah: 0 }, regions: [], sectors: [], topKbli: [], kbli: [], nib: { total: 3, withNib: 2, withoutNib: 1, withPercentage: 66.7, withoutPercentage: 33.3 }, marketingMethods: [{ key: "non-digital", label: "Non-digital", value: 2, percentage: 66.7 }, { key: "digital", label: "Digital", value: 1, percentage: 33.3 }], dataAsOf: "2026-08-17T00:30:00Z" } }) });
      return;
    }
    if (path === "/panel/analitik/metadata") { await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schemaVersion: 1, fields: [{ id: "kota_nama", key: "kota_nama", label: "Kabupaten/kota", group: "Wilayah", order: 1, role: "dimension", type: "text", status: "active", privacy: "aggregate", capabilities: ["group"], schemaVersion: 1 }, { id: "skala_dilaporkan", key: "skala_dilaporkan", label: "Skala", group: "Usaha", order: 2, role: "dimension", type: "text", status: "active", privacy: "aggregate", capabilities: ["group", "filter"], schemaVersion: 1 }], warnings: [] }) } ); return; }
    if (path === "/panel/analitik/templates") { await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schemaVersion: 1, templates: [{ id: "current-city", version: 1, label: "Sebaran UMKM Saat Ini", description: "", config: { metric: "jumlah_umkm", groupBy: "kota_nama", visual: "bar", filters: [] }, workforce: { enabled: false }, financial: { enabled: false } }] }) }); return; }
    if (path === "/panel/analitik/query") { await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ meta: { schemaVersion: 1, dataAsOf: "2026-08-17T00:30:00Z", generatedAt: "2026-08-17T00:31:00Z", status: "current", source: "analytics", population: 3, matched: 3, coverage: { matched: 3, total: 3, unknown: 0 }, warnings: [] }, data: { metric: { key: "jumlah_umkm", label: "Jumlah UMKM", aggregation: "count_distinct" }, groups: [{ key: "bogor", label: "Kabupaten Bogor", value: 2, share: 66.7 }, { key: "depok", label: "Kota Depok", value: 1, share: 33.3 }] } }) }); return; }
    if (path === "/panel/analitik/records") { await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ meta: { schemaVersion: 1, dataAsOf: "2026-08-17T00:30:00Z", generatedAt: "2026-08-17T00:31:00Z", status: "current", source: "analytics", population: 3, matched: 3, coverage: { matched: 3, total: 3 }, warnings: [] }, data: { records: [], nextCursor: null } }) }); return; }
    if (path.startsWith("/panel/analitik/umkm/")) { await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ meta: { schemaVersion: 1, dataAsOf: "2026-08-17T00:30:00Z", generatedAt: "2026-08-17T00:31:00Z", status: "current", source: "analytics", population: 1, matched: 1, coverage: { matched: 1, total: 1 }, warnings: [] }, data: { id: "11111111-1111-4111-8111-111111111111", title: "Usaha Canari", badges: ["Aktif"], hero: { name: "Usaha Canari", location: "Bogor", image: null }, sections: [{ id: "ringkasan", label: "Ringkasan", fields: [{ fieldId: "masked_nik", label: "NIK", value: "************1234", displayValue: "************1234", qualityStatus: "reported", dataType: "text" }] }], actions: { canEdit: true, canArchive: true, canRestore: false, editPath: "/admin/content/usaha/11111111-1111-4111-8111-111111111111" }, maskingVersion: 1 } }) }); return; }
    if (path === "/panel/items/analitik_view") { await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }); return; }
    if (path.startsWith("/panel/items/usaha/")) { await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { status: "archived" } }) }); return; }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {} }) });
  });
}

export async function loginMock(page, returnTo="/dashboard"){await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);await page.getByLabel("Email").waitFor({state:"visible",timeout:15000});await page.waitForTimeout(2500);await page.getByLabel("Email").fill("analyst@example.invalid");await page.getByRole("textbox",{name:"Kata sandi"}).fill("not-a-real-secret");await page.getByRole("button",{name:"Masuk"}).click();await page.waitForURL((url)=>url.pathname===returnTo,{timeout:10000});}

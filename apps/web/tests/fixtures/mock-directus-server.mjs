import { createServer } from "node:http";
import { PNG_1PX, katalogResponse, passportResponse, portalResponse } from "./katalog-data.mjs";
import { createKegiatanState, kegiatanApiResponse } from "./kegiatan-data.mjs";
import { createRegistrasiState, fasilitasiApiResponse, registrasiApiResponse } from "./registrasi-data.mjs";
import { klinikApiResponse } from "./klinik-data.mjs";
import { infographicMapResponse, infographicResponse, tabularOptionsResponse } from "./analytics-data.mjs";
import { OPERATOR_FIXTURES, mockUserMe, roleFromCookieHeader } from "./operator-fixtures.mjs";

const host = "127.0.0.1";
const port = 3101;

const ROLE_BY_EMAIL = {
  "dummy_admin@diskuk.jabarprov.go.id": "provinsi",
  "dummy_admin.subang@jabarprov.go.id": "kabkota",
  "dummy_coach.pendamping@jabarprov.go.id": "pendamping",
  "dummy_wawan.leathercraft@gmail.com": "umkm",
};

function roleFromCookies(cookieHeader) {
  return roleFromCookieHeader(cookieHeader, "provinsi");
}

/** Agenda fixtures of this mock server run; each suite start gets its own reminder rows. */
const KEGIATAN_STATE = createKegiatanState();
/** R03 registration + facilitation fixtures of this run (SSR reads and the scan proxy). */
const REGISTRASI_STATE = createRegistrasiState();

function readJsonBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}"));
      } catch {
        resolve({});
      }
    });
    request.on("error", () => resolve({}));
  });
}

const server = createServer(async (request, response) => {
  response.setHeader("cache-control", "private, no-store");
  if (request.url === "/server/ping") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("pong");
    return;
  }

  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (url.pathname.startsWith("/assets/")) {
    response.writeHead(200, { "content-type": "image/png" });
    response.end(PNG_1PX);
    return;
  }
  // Public catalogue reads (Directus Public policy) are server-rendered.
  const katalog = katalogResponse(url.pathname, url.searchParams) ?? passportResponse(url.pathname) ?? portalResponse(url.pathname);
  if (katalog) {
    response.writeHead(katalog.status ?? 200, { "content-type": "application/json" });
    response.end(JSON.stringify(katalog));
    return;
  }

  const method = (request.method || "GET").toUpperCase();
  const path = (request.url || "/").split("?")[0];

  response.setHeader("content-type", "application/json");

  // Public agenda endpoint (Y07): the SSR render of /kegiatan reads it, exactly like the real one.
  const agenda = kegiatanApiResponse({
    pathname: url.pathname,
    searchParams: url.searchParams,
    method,
    body: method === "GET" ? null : await readJsonBody(request),
    state: KEGIATAN_STATE,
  });
  if (agenda) {
    response.writeHead(agenda.status ?? 200, { "content-type": "application/json" });
    response.end(JSON.stringify(agenda.body ?? agenda));
    return;
  }

  // R03: registration + facilitation (SSR render of /kegiatan/:id and /fasilitasi reads these).
  const registrasi = registrasiApiResponse({
    pathname: url.pathname,
    method,
    body: method === "GET" ? null : await readJsonBody(request),
    state: REGISTRASI_STATE,
    role: roleFromCookies(request.headers.cookie),
    // Jalur pindai hanya dipakai lewat proxy server Nuxt yang menyertakan rahasia internal.
    secretOk: Boolean(process.env.OPERASIONAL_INTERNAL_SECRET) && request.headers["x-operasional-internal-secret"] === process.env.OPERASIONAL_INTERNAL_SECRET,
  });
  if (registrasi) {
    response.writeHead(registrasi.status ?? 200, { "content-type": registrasi.contentType ?? "application/json" });
    response.end(registrasi.buffer ?? JSON.stringify(registrasi.body ?? registrasi));
    return;
  }
  const fasilitasi = fasilitasiApiResponse(url.pathname, url.searchParams);
  if (fasilitasi) {
    response.writeHead(fasilitasi.status ?? 200, { "content-type": "application/json" });
    response.end(JSON.stringify(fasilitasi.body ?? fasilitasi));
    return;
  }

  // Public clinic desks (Y08/Y09): the landing is server-rendered, so SSR needs this list too.
  const klinik = klinikApiResponse({ pathname: url.pathname, searchParams: url.searchParams });
  if (klinik) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(klinik));
    return;
  }

  if (method === "POST" && path === "/auth/login") {
    const body = await readJsonBody(request);
    const role = ROLE_BY_EMAIL[String(body.email || "").toLowerCase()] || "provinsi";
    response.setHeader("set-cookie", [
      "diskuk_session=mock; Path=/; HttpOnly",
      `mock_role=${role}; Path=/`,
    ]);
    response.end(JSON.stringify({ data: {} }));
    return;
  }

  if (method === "POST" && path === "/auth/logout") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (method === "POST" && path === "/auth/password/request") {
    response.statusCode = 200;
    response.end();
    return;
  }

  if (method === "POST" && path === "/auth/password/reset") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (method === "GET" && path === "/operasional/me") {
    const role = roleFromCookies(request.headers.cookie);
    response.end(JSON.stringify({ data: OPERATOR_FIXTURES[role] }));
    return;
  }

  if (method === "GET" && path.startsWith("/users/me")) {
    // SSR tidak melihat closure loggedIn milik page.route; cookie mock_auth
    // dari installMockDirectus menjadi sinyal terautentikasi untuk SSR.
    // Tanpa cookie ini (kasus anonim), kembalikan 401 agar middleware
    // mengarahkan ke /sign-in.
    const cookies = String(request.headers.cookie || "");
    if (!cookies.includes("mock_auth=1") && !cookies.includes("diskuk_session=")) {
      response.statusCode = 401;
      response.end(JSON.stringify({ errors: [{ message: "unauthorized" }] }));
      return;
    }
    // Same /users/me shape as the browser mock (app_role, instansi, kota_scope, usaha per mock role).
    response.end(JSON.stringify({ data: mockUserMe(roleFromCookies(request.headers.cookie)) }));
    return;
  }

  // Dashboard reads a server-rendered page makes. The analytics ones share their fixtures with the
  // browser mock; the programme lists have no per-test state here, so they answer like the real
  // endpoints do for an account with no rows. Specs that need state navigate client-side.
  if (method === "GET" && path === "/v1/analytics/tabular/options") {
    response.end(JSON.stringify(tabularOptionsResponse()));
    return;
  }
  if (method === "GET" && path === "/v1/analytics/infographic/") {
    response.end(JSON.stringify(infographicResponse({ filtered: url.searchParams.has("skala") })));
    return;
  }
  if (method === "GET" && path === "/v1/analytics/infographic/map") {
    response.end(JSON.stringify(infographicMapResponse()));
    return;
  }
  if (method === "GET" && ["/v1/program/katalog/usaha", "/v1/program/katalog/produk", "/v1/program/kpi/peserta", "/v1/program/kpi/laporan"].includes(path)) {
    response.end(JSON.stringify({ data: [] }));
    return;
  }

  const petaMatch = path.match(/^\/(?:v1\/program\/peta|operasional\/usaha)\/([0-9a-f-]{36})(?:\/ringkas)?$/i);
  if (method === "GET" && petaMatch) {
    response.end(JSON.stringify({
      data: {
        id: petaMatch[1],
        nama: "Wawan Leathercraft",
        pemilik: "Wawan Setiawan",
        skala: "micro",
        kodeKbli: "15121",
        kegiatanUtama: "Industri Barang dari Kulit",
        deskripsiKbli: "Industri Barang dari Kulit",
        omzetTahunan: 780000000,
        sertifikasi: ["halal", "pirt", "hki"],
        talentStatus: "accelerator",
        talentBatch: "Batch 1",
        talenta: { status: "accelerator", batch: "Batch 1" },
        profilPath: `/dashboard/umkm/${petaMatch[1]}`,
      },
    }));
    return;
  }

  if (method === "GET" && (path === "/v1/program/passport/pdf/summary" || path === "/v1/program/passport/pdf/katalog")) {
    const pdfSample = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n200\n%%EOF";
    response.setHeader("content-type", "application/pdf");
    response.setHeader("content-disposition", `attachment; filename="${path.endsWith("summary") ? "executive-summary.pdf" : "katalog-ekspor.pdf"}"`);
    response.end(pdfSample);
    return;
  }

  if (method === "POST" && path === "/v1/analytics/analysis/exports") {
    const body = await readJsonBody(request);
    const jobId = "66666666-6666-4666-8666-000000000001";
    response.statusCode = 202;
    response.end(JSON.stringify({
      data: {
        jobId,
        status: "completed",
        exportType: body.exportType || "aggregate_pptx",
        downloadUrl: `/panel/v1/analytics/analysis/exports/${jobId}/download`,
        estimatedRows: 3,
      },
    }));
    return;
  }

  const exportMatch = path.match(/^\/v1\/analytics\/analysis\/exports\/([^/]+)(\/download)?$/);
  if (method === "GET" && exportMatch) {
    const [, jobId, isDownload] = exportMatch;
    if (isDownload) {
      const dummyPptx = Buffer.from("PK\x03\x04ppt/slides/slide1.xmlPK\x03\x04ppt/slides/slide2.xmlPK\x03\x04ppt/slides/slide3.xml");
      response.setHeader("content-type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      response.setHeader("content-disposition", `attachment; filename="analitik-rapat-${jobId}.pptx"`);
      response.end(dummyPptx);
      return;
    }
    response.end(JSON.stringify({
      data: {
        jobId,
        status: "completed",
        downloadUrl: `/panel/v1/analytics/analysis/exports/${jobId}/download`,
        estimatedRows: 3,
      },
    }));
    return;
  }

  // Fail loudly: an unmocked route must not look like an empty success during SSR.
  console.warn(`MOCK_ROUTE_MISSING ${method} ${path}`);
  response.statusCode = 404;
  response.end(JSON.stringify({ errors: [{ message: `MOCK_ROUTE_MISSING ${method} ${path}`, extensions: { code: "MOCK_ROUTE_MISSING" } }] }));
});

server.listen(port, host);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

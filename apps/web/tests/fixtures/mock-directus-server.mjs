import { createServer } from "node:http";
import { PNG_1PX, katalogResponse, passportResponse, portalResponse } from "./katalog-data.mjs";

const host = "127.0.0.1";
const port = 3101;

const ROLE_BY_EMAIL = {
  "dummy_admin@diskuk.jabarprov.go.id": "provinsi",
  "dummy_admin.subang@jabarprov.go.id": "kabkota",
  "dummy_coach.pendamping@jabarprov.go.id": "pendamping",
  "dummy_wawan.leathercraft@gmail.com": "umkm",
};

const OPERATOR_FIXTURES = {
  provinsi: {
    id: "user-1",
    email: "dummy_admin@diskuk.jabarprov.go.id",
    firstName: "Analis",
    lastName: null,
    avatar: null,
    role: "provinsi",
    roleLabel: "Admin Provinsi",
    instansi: "DISKUK Provinsi Jawa Barat",
    kota: null,
    usaha: null,
  },
  kabkota: {
    id: "user-2",
    email: "dummy_admin.subang@jabarprov.go.id",
    firstName: "Analis",
    lastName: "Daerah",
    avatar: null,
    role: "kabkota",
    roleLabel: "Admin Kab/Kota",
    instansi: "Dinas KUK Kabupaten Bogor",
    kota: { id: 1, nama: "Kabupaten Bogor" },
    usaha: null,
  },
  pendamping: {
    id: "user-3",
    email: "dummy_coach.pendamping@jabarprov.go.id",
    firstName: "Pendamping",
    lastName: null,
    avatar: null,
    role: "pendamping",
    roleLabel: "Pendamping",
    instansi: "Program Pendampingan UMKM",
    kota: null,
    usaha: null,
  },
  umkm: {
    id: "user-4",
    email: "dummy_wawan.leathercraft@gmail.com",
    firstName: "Wawan",
    lastName: null,
    avatar: null,
    role: "umkm",
    roleLabel: "Pelaku UMKM",
    instansi: "Pelaku UMKM",
    kota: null,
    usaha: {
      id: "11111111-1111-4111-8111-000000000001",
      nama: "Wawan Leathercraft",
      nib: "9900000000001",
    },
  },
};

function roleFromCookies(cookieHeader) {
  const cookies = String(cookieHeader || "").split(";");
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split("=");
    if (name === "mock_role") {
      const value = rest.join("=");
      if (value && value in OPERATOR_FIXTURES) return value;
    }
  }
  return "provinsi";
}

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

  if (method === "POST" && path === "/operasional/internal/resolve-nib") {
    const secret = request.headers["x-operasional-internal-secret"];
    if (!process.env.OPERASIONAL_INTERNAL_SECRET || secret !== process.env.OPERASIONAL_INTERNAL_SECRET) {
      response.statusCode = 403;
      response.end(JSON.stringify({ errors: [{ message: "forbidden" }] }));
      return;
    }
    const body = await readJsonBody(request);
    if (body.nib === "9900000000001") {
      response.end(JSON.stringify({ data: { email: "dummy_wawan.leathercraft@gmail.com" } }));
    } else {
      response.statusCode = 404;
      response.end(JSON.stringify({ errors: [{ message: "not found" }] }));
    }
    return;
  }

  if (method === "GET" && path === "/operasional/me") {
    const role = roleFromCookies(request.headers.cookie);
    response.end(JSON.stringify({ data: OPERATOR_FIXTURES[role] }));
    return;
  }

  if (method === "GET" && path === "/operasional/aktivitas") {
    response.end(JSON.stringify([
      {
        id: 1,
        action: "login",
        collection: "directus_users",
        item: "user-1",
        timestamp: "2026-09-26T01:00:00.000Z",
        ip: "127.0.0.1",
        userAgent: "Mock Upstream",
      },
    ]));
    return;
  }

  if (method === "GET" && path.startsWith("/users/me")) {
    response.end(JSON.stringify({
      data: {
        id: "user-1",
        email: "analyst@example.invalid",
        first_name: "Analis",
        role: "7d6d493c-1a6d-4c59-9e74-40d42a7862eb",
        // `app_role` mengikuti role mock aktif: guard route web memakai kunci ini, bukan UUID role.
        app_role: roleFromCookies(request.headers.cookie),
      },
    }));
    return;
  }

  response.end(JSON.stringify({ data: {} }));
});

server.listen(port, host);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

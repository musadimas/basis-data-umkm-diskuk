import { createServer } from "node:http";

const host = "127.0.0.1";
const port = 3101;

const server = createServer((request, response) => {
  response.setHeader("cache-control", "private, no-store");
  if (request.url === "/server/ping") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("pong");
    return;
  }

  response.setHeader("content-type", "application/json");
  if (request.url?.startsWith("/users/me")) {
    response.end(JSON.stringify({
      data: {
        id: "user-1",
        email: "analyst@example.invalid",
        first_name: "Analis",
        role: "7d6d493c-1a6d-4c59-9e74-40d42a7862eb",
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

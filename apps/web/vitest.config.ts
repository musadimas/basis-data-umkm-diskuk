import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
  resolve: { alias: { "~": fileURLToPath(new URL("./app", import.meta.url)), "@": fileURLToPath(new URL("./app", import.meta.url)) } },
});

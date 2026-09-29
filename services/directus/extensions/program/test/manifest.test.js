import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import manifest from "../package.json" with { type: "json" };

const PREFIX = "v1/program/";
const entries = manifest["directus:extension"].entries;

test("every endpoint entry is mounted under the /v1/program prefix", () => {
  const endpoints = entries.filter(({ type }) => type === "endpoint");
  assert.ok(endpoints.length > 0);
  for (const { name } of endpoints) assert.ok(name.startsWith(PREFIX), `${name} must start with ${PREFIX}`);
});

test("every entry source exists and default-exports a register function", async () => {
  for (const { name, source } of entries) {
    const url = new URL(`../${source}`, import.meta.url);
    assert.ok(existsSync(url), `${name}: ${source} is missing`);
    const module = await import(url);
    assert.equal(typeof module.default, "function", `${name} must default-export (router|events, context) => {}`);
  }
});

test("salinan lib/utils/auth.js program/analytics sudah dilebur ke module cakupan", async () => {
  // §2.5 langkah 6: ketiga salinan identik (md5 sama) digabung ke module Cakupan
  // Pemanggil; program dan analytics mengimpor dari sana. Salinan authentication
  // tetap ada (wilayah agen paralel) sehingga tidak dicek di sini.
  for (const bundle of ["program", "analytics"]) {
    const url = new URL(`../../${bundle}/src/lib/utils/auth.js`, import.meta.url);
    assert.equal(existsSync(url), false, `${bundle}/src/lib/utils/auth.js harus sudah dihapus`);
  }
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const cakupan = require("../../../analytics-shared/cakupan.cjs");
  assert.equal(cakupan.APPLICATION_ROLE_ID, "7d6d493c-1a6d-4c59-9e74-40d42a7862eb");
  assert.equal(typeof cakupan.sanitizeError, "function");
});

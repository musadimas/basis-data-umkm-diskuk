import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

test("the dashboard guard is identical to the other bundles' copies", () => {
  const own = readFileSync(new URL("../src/lib/utils/auth.js", import.meta.url), "utf8");
  for (const bundle of ["analytics", "authentication"]) {
    const other = readFileSync(new URL(`../../${bundle}/src/lib/utils/auth.js`, import.meta.url), "utf8");
    assert.equal(own, other, `${bundle}/src/lib/utils/auth.js has drifted`);
  }
});

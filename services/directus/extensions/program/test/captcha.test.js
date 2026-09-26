import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as captcha from "../src/lib/captcha.js";

// The public forms verify challenges issued by the authentication bundle, so the algorithm,
// TTL, payload limit and HMAC key label must stay identical to its constants.
test("captcha settings match the authentication bundle", () => {
  const source = readFileSync(new URL("../../authentication/src/lib/constants.js", import.meta.url), "utf8");
  const value = (name) => source.match(new RegExp(`export const ${name} = ([^;]+);`))?.[1];
  assert.equal(captcha.CAPTCHA_ALGORITHM, JSON.parse(value("CAPTCHA_ALGORITHM")));
  assert.equal(captcha.CAPTCHA_TTL_SECONDS, Number(value("CAPTCHA_TTL_SECONDS")));
  assert.equal(captcha.CAPTCHA_MAX_PAYLOAD_LENGTH, Number(value("CAPTCHA_MAX_PAYLOAD_LENGTH")));
  assert.equal(captcha.CAPTCHA_SECRET_LABEL, JSON.parse(value("CAPTCHA_SECRET_LABEL")));
});

test("malformed or missing payloads are rejected without a query", async () => {
  let queries = 0;
  const database = { raw: async () => ((queries += 1), { rows: [] }) };
  for (const raw of [undefined, "", "x", Buffer.from("{}").toString("base64"), "a".repeat(5000)]) {
    await assert.rejects(captcha.requireCaptcha(database, { SECRET: "s" }, raw), (error) => error.code === "CAPTCHA_INVALID");
  }
  assert.equal(queries, 0);
});

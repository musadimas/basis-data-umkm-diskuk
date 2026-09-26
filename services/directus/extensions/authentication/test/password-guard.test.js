import assert from "node:assert/strict";
import test from "node:test";
import registerPasswordGuard from "../src/hooks/password-guard.js";
import { TEST_ENV, fakeDatabase, registerHook, runMiddleware, solvedCaptcha } from "./helpers.js";

class InvalidCredentials extends Error {
  constructor() {
    super("Invalid user credentials.");
    this.name = "DirectusError";
    this.status = 401;
    this.code = "INVALID_CREDENTIALS";
  }
}

function setup({ env = TEST_ENV, nibEmails } = {}) {
  const verified = [];
  class AuthenticationService {
    async verifyPassword(user, password) {
      verified.push({ user, password });
      if (password !== "current-password") throw new InvalidCredentials();
    }
  }
  const database = fakeDatabase({ nibEmails });
  const hook = registerHook(registerPasswordGuard, { database, env, services: { AuthenticationService } });
  return { ...hook, verified };
}

const self = (admin = false) => ({ accountability: { user: "user-1", admin } });
const META = { keys: ["user-1"], collection: "directus_users" };

test("reset request requires a captcha", async () => {
  const { middlewares } = setup();
  const error = await runMiddleware(middlewares["POST /auth/password/request"], { body: { email: "a@b.id" } });
  assert.equal(error.status, 400);
  assert.equal(error.code, "CAPTCHA_INVALID");
});

test("reset request resolves a NIB, strips the captcha, and pins the reset URL", async () => {
  const { middlewares } = setup({ nibEmails: { "1234567890123": "wawan@example.test" } });
  const req = { body: { email: "1234567890123", captcha: await solvedCaptcha(), reset_url: "https://evil.test/steal" } };
  assert.equal(await runMiddleware(middlewares["POST /auth/password/request"], req), undefined);
  assert.deepEqual(req.body, { email: "wawan@example.test", reset_url: "https://umkm.test/reset-kata-sandi" });
});

test("changing your own password requires and verifies the current password", async () => {
  const { handlers, verified } = setup();
  const filter = handlers["filter:users.update"];
  await assert.rejects(filter({ password: "new-password-123" }, META, self()), { code: "CURRENT_PASSWORD_REQUIRED" });
  await assert.rejects(filter({ password: "new-password-123", current_password: "wrong" }, META, self()), {
    code: "CURRENT_PASSWORD_INVALID",
  });
  await assert.rejects(filter({ password: "short", current_password: "current-password" }, META, self()), {
    code: "NEW_PASSWORD_TOO_SHORT",
  });
  await assert.rejects(filter({ password: "current-password", current_password: "current-password" }, META, self()), {
    code: "NEW_PASSWORD_UNCHANGED",
  });
  const payload = await filter({ password: "new-password-123", current_password: "current-password" }, META, self());
  assert.deepEqual(payload, { password: "new-password-123" });
  assert.deepEqual(verified.at(-1), { user: "user-1", password: "current-password" });
});

test("admins may change their own password in the Data Studio without the current password", async () => {
  const { handlers } = setup();
  const payload = await handlers["filter:users.update"]({ password: "new-password-123" }, META, self(true));
  assert.deepEqual(payload, { password: "new-password-123" });
});

test("updates that are not your own password pass through unchanged", async () => {
  const { handlers, verified } = setup();
  const filter = handlers["filter:users.update"];
  assert.deepEqual(await filter({ first_name: "Wawan" }, META, self()), { first_name: "Wawan" });
  const otherUser = { keys: ["user-2"], collection: "directus_users" };
  assert.deepEqual(await filter({ password: "reset-by-admin-1" }, otherUser, self(true)), { password: "reset-by-admin-1" });
  assert.equal(verified.length, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import registerLoginGuard from "../src/hooks/login-guard.js";
import { TEST_ENV, fakeDatabase, registerHook, runMiddleware, solvedCaptcha } from "./helpers.js";

function setup({ env = TEST_ENV, nibEmails } = {}) {
  const database = fakeDatabase({ nibEmails });
  return { database, ...registerHook(registerLoginGuard, { database, env }) };
}

const META = { status: "pending", user: "user-1", provider: "default" };
const CONTEXT = { accountability: { ip: "10.0.0.7", userAgent: "unit-test", origin: "https://app.test" } };
const credentials = { email: "a@b.id", password: "x" };

test("POST /auth/login middleware resolves a NIB to the linked account email", async () => {
  const { middlewares } = setup({ nibEmails: { "1234567890123": "wawan.leathercraft@gmail.com" } });
  const req = { body: { email: " 1234567890123 ", password: "x" } };
  assert.equal(await runMiddleware(middlewares["POST /auth/login"], req), undefined);
  assert.equal(req.body.email, "wawan.leathercraft@gmail.com");
});

test("an unknown NIB becomes an unmatched email so it fails like an unknown email", async () => {
  const { middlewares } = setup();
  const req = { body: { email: "9999999999999", password: "x" } };
  await runMiddleware(middlewares["POST /auth/login"], req);
  assert.match(req.body.email, /^nib-[0-9a-f-]{36}@unmatched\.invalid$/);
});

test("emails pass through the login middleware untouched", async () => {
  const { middlewares } = setup();
  const req = { body: { email: "Admin@DISKUK.jabarprov.go.id", password: "x" } };
  await runMiddleware(middlewares["POST /auth/login"], req);
  assert.equal(req.body.email, "Admin@DISKUK.jabarprov.go.id");
});

test("a valid captcha is consumed and stripped from the login payload", async () => {
  const { handlers } = setup();
  const captcha = await solvedCaptcha();
  const result = await handlers["filter:auth.login"]({ ...credentials, captcha }, META, CONTEXT);
  assert.deepEqual(result, credentials);
});

test("a missing captcha fails exactly like invalid credentials and is audited", async () => {
  const { handlers, database } = setup();
  await assert.rejects(
    handlers["filter:auth.login"](credentials, META, CONTEXT),
    (error) => error.name === "DirectusError" && error.status === 401 && error.code === "INVALID_CREDENTIALS",
  );
  assert.deepEqual(database.audit, [
    { user_id: "user-1", status: "fail", reason: "CAPTCHA_MISSING", ip: "10.0.0.7", user_agent: "unit-test", origin: "https://app.test" },
  ]);
});

test("a captcha solution cannot be replayed", async () => {
  const { handlers, database } = setup();
  const captcha = await solvedCaptcha();
  await handlers["filter:auth.login"]({ ...credentials, captcha }, META, CONTEXT);
  await assert.rejects(handlers["filter:auth.login"]({ ...credentials, captcha }, META, CONTEXT));
  assert.equal(database.audit.at(-1).reason, "CAPTCHA_REPLAYED");
});

test("a captcha signed with another secret is rejected", async () => {
  const { handlers, database } = setup();
  const captcha = await solvedCaptcha({ ...TEST_ENV, SECRET: "another-directus-secret" });
  await assert.rejects(handlers["filter:auth.login"]({ ...credentials, captcha }, META, CONTEXT));
  assert.equal(database.audit.at(-1).reason, "CAPTCHA_INVALID");
});

test("widget test-mode payloads are rejected", async () => {
  const { handlers } = setup();
  const captcha = Buffer.from(JSON.stringify({ challenge: null, solution: null, test: true })).toString("base64");
  await assert.rejects(handlers["filter:auth.login"]({ ...credentials, captcha }, META, CONTEXT));
});

test("enforcement can be disabled explicitly", async () => {
  const { handlers } = setup({ env: { ...TEST_ENV, AUTH_CAPTCHA_ENFORCE: "false" } });
  const result = await handlers["filter:auth.login"]({ ...credentials, captcha: "junk" }, META, CONTEXT);
  assert.deepEqual(result, credentials);
});

test("login outcomes are recorded by the auth.login action", async () => {
  const { handlers, database } = setup();
  await handlers["action:auth.login"]({ status: "success", user: "user-1", provider: "default" }, CONTEXT);
  await handlers["action:auth.login"](
    { status: "fail", user: "user-1", provider: "default", error: { code: "INVALID_CREDENTIALS" } },
    CONTEXT,
  );
  assert.deepEqual(
    database.audit.map(({ status, reason }) => ({ status, reason })),
    [
      { status: "success", reason: null },
      { status: "fail", reason: "INVALID_CREDENTIALS" },
    ],
  );
});

test("the Data Studio origin (PUBLIC_URL) may log in without a captcha", async () => {
  const env = { ...TEST_ENV, PUBLIC_URL: "http://localhost:8055/" };
  const { handlers } = setup({ env });
  const studio = { accountability: { ...CONTEXT.accountability, origin: "http://localhost:8055" } };
  assert.deepEqual(await handlers["filter:auth.login"](credentials, META, studio), credentials);
  await assert.rejects(handlers["filter:auth.login"](credentials, META, CONTEXT), { code: "INVALID_CREDENTIALS" });
});

test("127.0.0.1 and localhost are treated as the same Data Studio origin", async () => {
  for (const publicUrl of ["http://127.0.0.1:8055", "http://localhost:8055"]) {
    const { handlers } = setup({ env: { ...TEST_ENV, PUBLIC_URL: publicUrl } });
    for (const origin of ["http://127.0.0.1:8055", "http://localhost:8055"]) {
      const studio = { accountability: { ...CONTEXT.accountability, origin } };
      assert.deepEqual(await handlers["filter:auth.login"](credentials, META, studio), credentials, `${publicUrl} + ${origin}`);
    }
  }
});

test("captcha exemption follows AUTH_CAPTCHA_EXEMPT_ORIGINS and can be disabled", async () => {
  const studio = { accountability: { ...CONTEXT.accountability, origin: "http://localhost:8055" } };
  const disabled = setup({ env: { ...TEST_ENV, PUBLIC_URL: "http://localhost:8055", AUTH_CAPTCHA_EXEMPT_ORIGINS: "none" } });
  await assert.rejects(disabled.handlers["filter:auth.login"](credentials, META, studio), { code: "INVALID_CREDENTIALS" });

  const listed = setup({ env: { ...TEST_ENV, AUTH_CAPTCHA_EXEMPT_ORIGINS: "https://admin.example.test, http://localhost:8055" } });
  assert.deepEqual(await listed.handlers["filter:auth.login"](credentials, META, studio), credentials);
});

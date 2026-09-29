import assert from "node:assert/strict";
import test from "node:test";
import { getOutbox } from "../src/lib/outbox/runtime.js";

const kandidat = (over = {}) => ({
  database: { raw: async () => ({ rows: [] }) },
  logger: {},
  env: {},
  getSchema: async () => ({}),
  ...over,
});

/** Kanal yang dipasang terlihat dari dispatch: kanal tanpa adapter dihitung `dilewati`. */
async function terpasang(context, kanal) {
  const kueri = [];
  const database = {
    raw: async (sql, bindings) => {
      kueri.push({ sql, bindings });
      return { rows: sql.includes("count(*)") ? [{ jumlah: 0 }] : [] };
    },
  };
  await getOutbox({ ...context, database }).dispatch();
  return kueri.find((item) => item.sql.includes("count(*)")).bindings[1].includes(kanal);
}

test("getOutbox memoizes per database and installs adapters only when configured", async () => {
  const context = kandidat();
  assert.equal(getOutbox(context), getOutbox({ ...context }));

  assert.equal(await terpasang(kandidat(), "email"), false);
  assert.equal(await terpasang(kandidat(), "whatsapp"), false);
  assert.equal(await terpasang(kandidat({ services: { MailService: class {} } }), "email"), true);
  assert.equal(await terpasang(kandidat({ env: { WHATSAPP_GATEWAY_URL: "https://wa.example.invalid/send" } }), "whatsapp"), true);
});

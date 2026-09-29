import assert from "node:assert/strict";
import test from "node:test";
import { assertTalentAccess, assertUsahaInActorScope, loadActor, pesertaScope } from "../src/lib/access.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { APPLICATION_ROLE_ID } = require("../../../analytics-shared/cakupan.cjs");

const USER = "00000000-0000-4000-8000-000000000007";
const database = (row) => ({ raw: async () => ({ rows: row ? [row] : [] }) });

test("an account row that cannot be read is not signed in, whatever the session claims", async () => {
  const accountability = { user: USER, role: APPLICATION_ROLE_ID, app_role: "provinsi", appRole: "provinsi" };
  await assert.rejects(loadActor(database(null), accountability), (error) => error.statusCode === 401);
});

test("the role comes from the account row only and is never defaulted", async () => {
  const accountability = { user: USER, role: APPLICATION_ROLE_ID, app_role: "provinsi", appRole: "provinsi", kotaScope: 9 };
  const actor = await loadActor(database({ id: USER, app_role: null, usaha: null, kota_scope: null }), accountability);
  assert.equal(actor.appRole, null);
  assert.equal(actor.kotaScope, null);
  assert.deepEqual(pesertaScope(actor), { sql: "FALSE", bindings: [] });
  assert.throws(() => assertTalentAccess(actor), (error) => error.statusCode === 403);
  assert.throws(() => assertUsahaInActorScope(actor, { id: "usaha-1", kotaId: 7 }), (error) => error.statusCode === 403);
});

test("a kab/kota officer never reaches a business whose kota is unknown", () => {
  const kabkota = { id: USER, admin: false, appRole: "kabkota", usaha: null, kotaScope: 7 };
  assert.doesNotThrow(() => assertUsahaInActorScope(kabkota, { id: "usaha-7", kotaId: 7 }));
  assert.throws(() => assertUsahaInActorScope(kabkota, { id: "usaha-9", kotaId: 9 }), (error) => error.statusCode === 403);
  assert.throws(() => assertUsahaInActorScope(kabkota, { id: "usaha-x", kotaId: null }), (error) => error.statusCode === 403);
  assert.throws(() => assertUsahaInActorScope(kabkota, { id: "usaha-y" }), (error) => error.statusCode === 403);
});

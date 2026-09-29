import assert from "node:assert/strict";
import test from "node:test";
import {
  searchClause,
  escapeLike,
  TabularQueryError,
} from "../src/lib/utils/tabular-filter.js";

test("escapeLike escapes backslashes, percent signs, and underscores", () => {
  assert.equal(escapeLike("normal"), "normal");
  assert.equal(escapeLike("100%"), "100\\%");
  assert.equal(escapeLike("a_b"), "a\\_b");
  assert.equal(escapeLike("path\\file%_"), "path\\\\file\\%\\_");
});

test("searchClause rejects query under 3 characters with 400 Q_TOO_SHORT", () => {
  assert.throws(
    () => searchClause("ab"),
    (err) => err instanceof TabularQueryError && err.statusCode === 400 && err.code === "Q_TOO_SHORT",
  );
  assert.throws(
    () => searchClause(" x "),
    (err) => err instanceof TabularQueryError && err.statusCode === 400 && err.code === "Q_TOO_SHORT",
  );
  assert.equal(searchClause(""), null);
  assert.equal(searchClause("   "), null);
  assert.equal(searchClause(null), null);
});

test("searchClause mengklasifikasikan query menurut bentuknya (bentuk params, bukan teks SQL)", () => {
  assert.deepEqual(searchClause("3273010101011234").params, ["3273010101011234"]);
  assert.deepEqual(searchClause("9900000000001").params, ["9900000000001"]);
  assert.deepEqual(searchClause("15121").params, ["15121", "%15121%"]);
  // 12 dan 17 digit bukan NIK/NIB/KBLI: jatuh ke pencarian umum (4 pola ILIKE).
  assert.equal(searchClause("123456789012").params.length, 4);
  assert.equal(searchClause("32730101010112345").params.length, 4);
  assert.deepEqual(searchClause("50%_").params, Array(4).fill("%50\\%\\_%"));
});

test("TabularQueryError berbentuk DirectusError supaya Directus merender 400, bukan 500", () => {
  const error = new TabularQueryError(400, "Q_TOO_SHORT", "pendek");
  assert.equal(error.name, "DirectusError");
  assert.deepEqual(error.extensions, { code: "Q_TOO_SHORT", status: 400 });
  assert.equal(error.statusCode, 400);
  assert.ok(error instanceof TabularQueryError);
});

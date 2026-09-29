import assert from "node:assert/strict";
import test from "node:test";
import { signDownload, verifyDownload } from "../src/endpoints/analysis/exports-service.js";

// Compose meneruskan DIRECTUS_SECRET sebagai `SECRET` ke container Directus; env
// DIRECTUS_SECRET sendiri tidak ada di sana. Tanpa fallback ini, produksi selalu 500.
test("tanda tangan unduhan memakai SECRET Directus di produksi", () => {
  const saved = { ...process.env };
  try {
    process.env.NODE_ENV = "production";
    delete process.env.DIRECTUS_SECRET;
    delete process.env.NUXT_SESSION_POLICY_SECRET;
    process.env.SECRET = "rahasia-directus";
    const expires = Date.now() + 60_000;
    const sig = signDownload("job-1", "owner-1", expires);
    assert.equal(verifyDownload("job-1", "owner-1", expires, sig), true);
    assert.equal(verifyDownload("job-1", "owner-2", expires, sig), false);
    delete process.env.SECRET;
    assert.throws(() => signDownload("job-1", "owner-1", expires), /DIRECTUS_SECRET is required/);
  } finally {
    for (const key of ["NODE_ENV", "DIRECTUS_SECRET", "NUXT_SESSION_POLICY_SECRET", "SECRET"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

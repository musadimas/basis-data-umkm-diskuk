import assert from "node:assert/strict";
import test from "node:test";
import { normalisasiTeleponSeluler } from "../src/lib/validate.js";

// B33: satu aturan telepon seluler untuk klinik, kegiatan, dan LOI katalog.
test("normalisasiTeleponSeluler menyatukan tiga aturan telepon (B33)", () => {
  const valid = [
    ["0812-3456-7890", "6281234567890"],
    ["+62 812 3456 7890", "6281234567890"],
    ["6281234567890", "6281234567890"],
    // Dulu hanya diterima kegiatan; kini seragam di ketiga fitur.
    ["(0812) 3456-7890", "6281234567890"],
    ["81234567890", "6281234567890"],
  ];
  for (const [masukan, keluar] of valid) {
    assert.equal(normalisasiTeleponSeluler(masukan), keluar, masukan);
  }
  const tidakValid = ["021-555", "81234", "abc", "", null, undefined];
  for (const masukan of tidakValid) {
    assert.equal(normalisasiTeleponSeluler(masukan), null, String(masukan));
  }
});

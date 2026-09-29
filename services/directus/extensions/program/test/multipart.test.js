import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { readMultipart } from "../src/lib/http/multipart.js";

function form({ fields = {}, files = [] }) {
  const batas = "----uji-multipart";
  const bagian = Object.entries(fields).map(([nama, nilai]) =>
    Buffer.from(`--${batas}\r\nContent-Disposition: form-data; name="${nama}"\r\n\r\n${nilai}\r\n`),
  );
  for (const { field, filename, buffer } of files) {
    bagian.push(
      Buffer.from(`--${batas}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
      buffer,
      Buffer.from("\r\n"),
    );
  }
  bagian.push(Buffer.from(`--${batas}--\r\n`));
  const badan = Buffer.concat(bagian);
  return { headers: { "content-type": `multipart/form-data; boundary=${batas}` }, pipe: (tujuan) => Readable.from([badan]).pipe(tujuan) };
}

test("readMultipart mengumpulkan field dan hanya berkas pada field yang diminta", async () => {
  const req = form({
    fields: { payload: "{}", captcha: "abc" },
    files: [
      { field: "lampiran", filename: "a.pdf", buffer: Buffer.from("isi-a") },
      { field: "lain", filename: "b.pdf", buffer: Buffer.from("dibuang") },
    ],
  });
  const { fields, files } = await readMultipart(req, { fileField: "lampiran" });
  assert.deepEqual(fields, { payload: "{}", captcha: "abc" });
  assert.equal(files.length, 1);
  assert.equal(files[0].filename, "a.pdf");
  assert.equal(files[0].buffer.toString(), "isi-a");
});

test("readMultipart menolak berkas terlalu besar dan terlalu banyak dengan galat dari pemanggil", async () => {
  const galat = { terlaluBesar: () => new Error("besar"), terlaluBanyak: () => new Error("banyak") };
  const berkas = (n) => Array.from({ length: n }, (_, i) => ({ field: "f", filename: `${i}.bin`, buffer: Buffer.alloc(10) }));
  await assert.rejects(readMultipart(form({ files: berkas(1) }), { fileField: "f", maxFileBytes: 5, galat }), /besar/);
  await assert.rejects(readMultipart(form({ files: berkas(3) }), { fileField: "f", maxFiles: 2, galat }), /banyak/);
});

test("readMultipart bukan multipart menghasilkan 400 INVALID_PAYLOAD", async () => {
  await assert.rejects(
    readMultipart({ headers: { "content-type": "application/json" }, pipe() {} }),
    (error) => error.statusCode === 400 && error.code === "INVALID_PAYLOAD",
  );
});

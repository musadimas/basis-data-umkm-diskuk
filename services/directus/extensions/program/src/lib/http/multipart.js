import busboy from "busboy";
import { ProgramError } from "../utils/http.js";

/**
 * Adapter multipart/form-data: membaca request menjadi `{ fields, files: [{ filename, buffer }] }`
 * tanpa tahu apa pun tentang domain. Aturan domain (tipe berkas, jumlah) tetap di use case;
 * di sini hanya batas kasar yang melindungi memori proses.
 *
 * Hanya berkas pada `fileField` yang dikumpulkan; berkas pada field lain dibaca lalu dibuang.
 * `galat.terlaluBesar` / `galat.terlaluBanyak` (fungsi yang mengembalikan Error) memungkinkan
 * pemanggil memakai kode error domainnya; bawaannya `ProgramError` 400 generik.
 */
export function readMultipart(
  req,
  { fileField = "file", maxFiles = 3, maxFileBytes = 5 * 1024 * 1024, maxFields = 4, maxFieldBytes = 20_000, maxParts = 8, galat = {} } = {},
) {
  const terlaluBesar = galat.terlaluBesar ?? (() => new ProgramError(400, "FILE_TERLALU_BESAR", "The file is too large."));
  const terlaluBanyak = galat.terlaluBanyak ?? (() => new ProgramError(400, "FILE_TERLALU_BANYAK", "Too many files."));
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = busboy({
        headers: req.headers,
        limits: { files: maxFiles, fileSize: maxFileBytes, fields: maxFields, fieldSize: maxFieldBytes, parts: maxParts },
      });
    } catch {
      reject(new ProgramError(400, "INVALID_PAYLOAD", "Send the form as multipart/form-data."));
      return;
    }
    const fields = {};
    const files = [];
    let failure = null;
    parser.on("field", (name, value) => (fields[name] = value));
    parser.on("file", (name, stream, info) => {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("limit", () => (failure = terlaluBesar()));
      stream.on("end", () => {
        if (name === fileField) files.push({ filename: String(info.filename ?? fileField).slice(0, 200), buffer: Buffer.concat(chunks) });
      });
    });
    parser.on("filesLimit", () => (failure = terlaluBanyak()));
    parser.on("partsLimit", () => (failure = new ProgramError(400, "INVALID_PAYLOAD", "Too many form parts.")));
    parser.on("error", () => reject(new ProgramError(400, "INVALID_PAYLOAD", "The form could not be read.")));
    parser.on("close", () => (failure ? reject(failure) : resolve({ fields, files })));
    req.pipe(parser);
  });
}

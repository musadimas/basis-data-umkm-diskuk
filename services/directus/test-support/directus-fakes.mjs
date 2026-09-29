import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

/**
 * Adapter in-memory di seam Directus services (Files/Assets/Mail), dipasangkan dengan
 * `mountEndpoint(register, { database, context: { services, getSchema } })`.
 *
 * Baris `directus_files` tetap ditulis sungguhan supaya kode produk yang membaca tabel itu
 * (folder, uploaded_by, type, filesize) melihat data nyata; hanya byte-nya yang disimpan di
 * memori proses tes. Bentuk `getAsset` meniru `@directus/api` yang asli: `{ stream, file, stat }`
 * dengan `file.type` (bukan `mimetype`).
 */
export function createDirectusFakes({ db, storage = "local" } = {}) {
  if (!db) throw new Error("createDirectusFakes({ db }) membutuhkan instance knex");
  const files = new Map();
  const mails = [];
  const uploads = [];

  class FilesService {
    async uploadOne(stream, payload = {}) {
      const chunks = [];
      for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      const id = payload.id || randomUUID();
      await db("directus_files").insert({
        id,
        storage: payload.storage || storage,
        folder: payload.folder ?? null,
        uploaded_by: payload.uploaded_by ?? null,
        filename_download: payload.filename_download || "file",
        title: payload.title ?? null,
        type: payload.type ?? null,
        filesize: body.length,
      });
      files.set(id, body);
      uploads.push({ id, payload });
      return id;
    }
  }

  class AssetsService {
    async getAsset(fileId) {
      const file = await db("directus_files").where({ id: fileId }).first();
      if (!file) throw Object.assign(new Error("FORBIDDEN"), { status: 403 });
      const body = files.get(fileId) ?? Buffer.alloc(0);
      return { stream: Readable.from([body]), file, stat: { size: body.length } };
    }
  }

  class MailService {
    async send(message) {
      mails.push(message);
      return { messageId: `mail-${mails.length}`, accepted: [message?.to].filter(Boolean), rejected: [] };
    }
  }

  return {
    files,
    mails,
    uploads,
    services: { FilesService, AssetsService, MailService },
    getSchema: async () => ({}),
  };
}

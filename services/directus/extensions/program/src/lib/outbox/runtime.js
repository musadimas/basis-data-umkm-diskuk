/**
 * Outbox untuk konteks Directus: adapter dipasang hanya bila terkonfigurasi (email bila
 * `services.MailService` ada, WhatsApp bila `WHATSAPP_GATEWAY_URL` terisi). Memoized per `database`,
 * jadi endpoint dan hook berbagi satu instance dan kanal tanpa adapter tetap `pending`.
 */
import { buatOutbox } from "./index.js";
import { buatAdapterEmail } from "./adapters/email.js";
import { buatAdapterWhatsapp } from "./adapters/whatsapp.js";

const cache = new WeakMap();

export function getOutbox(context) {
  const { database, logger, env = {}, services, getSchema } = context;
  let outbox = cache.get(database);
  if (!outbox) {
    outbox = buatOutbox({
      database,
      logger,
      adapters: [buatAdapterEmail({ services, database, getSchema }), buatAdapterWhatsapp({ env })].filter(Boolean),
    });
    cache.set(database, outbox);
  }
  return outbox;
}

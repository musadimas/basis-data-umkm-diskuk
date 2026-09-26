/**
 * Outbound notification hook (WhatsApp in the brief). There is no gateway yet, so events are only
 * logged; the web shows the ticket number on screen. Wire a gateway here once one exists, without
 * changing the callers. Personal details are never logged.
 */
export async function notify({ logger }, event, detail) {
  logger.info?.({ event, nomor: detail?.nomor, status: detail?.status }, "Notification not sent: no WhatsApp gateway configured");
}

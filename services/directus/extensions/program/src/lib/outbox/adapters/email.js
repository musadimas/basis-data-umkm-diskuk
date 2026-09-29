/**
 * Adapter email lewat `MailService` Directus: transport yang dikonfigurasi deployment (Mailpit di
 * stack disposable, relay SMTP di produksi). Penerimaan SMTP dengan `messageId` adalah bukti final
 * (`butuhResi: false`, keputusan 3).
 */
export function buatAdapterEmail({ services, database, getSchema } = {}) {
  const MailService = services?.MailService;
  if (!MailService) return null;
  return {
    kanal: "email",
    butuhResi: false,
    async kirim({ tujuan, pesan }) {
      try {
        const mailer = new MailService({ schema: await getSchema(), knex: database });
        const info = await mailer.send({ to: tujuan, subject: pesan?.subject ?? "", text: pesan?.text ?? "", html: pesan?.html });
        return { ok: true, provider: "smtp", messageId: info?.messageId ?? null, providerStatus: "accepted", final: true };
      } catch {
        return { ok: false, provider: "smtp", error: "smtp_error" };
      }
    },
  };
}

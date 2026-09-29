/** Adapter WhatsApp: membungkus `sendWhatsApp`. Tidak dipasang (null) bila gateway belum dikonfigurasi. */
import { sendWhatsApp, whatsappConfig, whatsappConfigured } from "../../whatsapp.js";

/** 4xx berarti gateway menolak isi pesan (permanen); 408/429 tetap layak dicoba ulang. */
function permanen(error) {
  const cocok = /^http_(4\d\d)$/.exec(String(error ?? ""));
  return Boolean(cocok) && !["408", "429"].includes(cocok[1]);
}

export function buatAdapterWhatsapp({ env = {}, fetchImpl } = {}) {
  if (!whatsappConfigured(env)) return null;
  const { requireCallback } = whatsappConfig(env);
  return {
    kanal: "whatsapp",
    butuhResi: requireCallback,
    async kirim({ tujuan, template, pesan }) {
      const hasil = await sendWhatsApp(env, { tujuan, template, text: pesan?.text ?? "", payload: pesan?.params ?? {}, fetchImpl });
      if (!hasil.ok) return { ok: false, provider: hasil.provider, error: hasil.error, receipt: hasil.receipt, permanen: permanen(hasil.error) };
      return {
        ok: true,
        provider: hasil.provider,
        messageId: hasil.messageId,
        providerStatus: hasil.providerStatus,
        receipt: hasil.receipt,
        // Tanpa callback wajib, status `diterima` dari gateway sendiri dianggap final.
        final: hasil.status === "diterima",
      };
    },
  };
}

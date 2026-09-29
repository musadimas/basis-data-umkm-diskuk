/**
 * Adapter in-memory untuk tes: merekam kiriman dan dapat diskenariokan.
 *
 * `hasil(kiriman, nomor)` (opsional) mengembalikan hasil port untuk kiriman ke-`nomor` (mulai 1);
 * `undefined` berarti sukses. `tundaMs` menahan tiap kiriman supaya dispatch paralel bisa bertumpuk.
 */
export function buatAdapterMemory({ kanal = "whatsapp", butuhResi = false, final = false, hasil, tundaMs = 0 } = {}) {
  const terkirim = [];
  let nomor = 0;
  return {
    kanal,
    butuhResi,
    /** Semua panggilan `kirim`, termasuk yang gagal. */
    terkirim,
    async kirim(kiriman) {
      nomor += 1;
      terkirim.push(kiriman);
      if (tundaMs) await new Promise((selesai) => setTimeout(selesai, tundaMs));
      return hasil?.(kiriman, nomor) ?? { ok: true, provider: "memory", messageId: `mem-${nomor}`, providerStatus: "accepted", final };
    },
  };
}

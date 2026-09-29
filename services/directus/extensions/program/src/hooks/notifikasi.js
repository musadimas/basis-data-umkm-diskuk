// Y07/M7-09 + Kandidat 02: satu cron per menit untuk semua pesan keluar. Langganan pengingat yang
// jatuh tempo diantrekan ke outbox, lalu outbox mengirim semua pesan yang jatuh tempo (pengingat
// kegiatan dan Klinik). Cron berjalan di setiap instance Directus; keamanannya datang dari klaim
// FOR UPDATE SKIP LOCKED di outbox dan kunci baris langganan, bukan dari deduplikasi jadwal.
import { jadwalkanPengingatJatuhTempo } from "../endpoints/kegiatan/service.js";
import { getOutbox } from "../lib/outbox/runtime.js";

export default ({ schedule }, context) => {
  const { database, env = {}, logger } = context;
  schedule("0 * * * * *", async () => {
    const outbox = getOutbox(context);
    try {
      const hasil = await jadwalkanPengingatJatuhTempo({ database, outbox, env });
      if (hasil.dijadwalkan || hasil.dibatalkan || hasil.kedaluwarsa) logger.info(`pengingat kegiatan: ${JSON.stringify(hasil)}`);
    } catch (error) {
      if (error?.code === "42P01") return; // tabel belum termigrasi (dev terhadap DB remote lama)
      logger.error(error, "Pengingat kegiatan gagal dijadwalkan");
    }
    try {
      const hasil = await outbox.dispatch({ limit: 50 });
      if (hasil.terkirim || hasil.gagal) logger.info(`outbox: ${JSON.stringify(hasil)}`);
    } catch (error) {
      if (error?.code === "42P01") return; // tabel belum termigrasi (dev terhadap DB remote lama)
      logger.error(error, "Outbox gagal dikirim");
    }
  });
};

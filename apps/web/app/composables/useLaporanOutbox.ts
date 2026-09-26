// Y03 — antrean laporan KPI offline (IndexedDB).
// Retensi: item bertahan di perangkat melewati reload; terhapus otomatis
// per-item hanya saat sinkron sukses (200/201). Error 4xx menandai item
// dengan pesan (tetap di perangkat untuk diperbaiki/dikirim ulang).
// Kegagalan jaringan menghentikan loop tanpa menghapus. Logout menghapus
// seluruh antrean (konfirmasi di layout umkm).

import { kpiOutboxStore } from "~/lib/idb";
import { useBerkasUpload } from "~/composables/useBerkasUpload";

export interface LaporanOutboxItem {
  clientUuid: string;
  mingguKe: number;
  omzet: number;
  jumlahTransaksi: number;
  catatanKendala: string | null;
  dikirimPada: string;
  bukti: Blob;
  buktiNama: string;
  buktiTipe: string;
  error: string | null;
}

export function useLaporanOutbox() {
  const items = useState<LaporanOutboxItem[]>("laporan:outbox", () => []);
  const memuat = useState("laporan:outbox-memuat", () => false);
  const menyinkron = useState("laporan:outbox-menyinkron", () => false);
  const { online } = useKoneksi();
  const { uploadBerkas } = useBerkasUpload();

  async function muat() {
    memuat.value = true;
    try {
      const keys = await kpiOutboxStore.keys();
      const rows: LaporanOutboxItem[] = [];
      for (const k of keys) {
        const v = await kpiOutboxStore.getItem<LaporanOutboxItem>(String(k));
        if (v) rows.push(v);
      }
      rows.sort((a, b) => a.mingguKe - b.mingguKe);
      items.value = rows;
    } finally {
      memuat.value = false;
    }
  }

  async function enqueue(item: LaporanOutboxItem) {
    await kpiOutboxStore.setItem(item.clientUuid, item);
    await muat();
  }

  async function hapus(clientUuid: string) {
    await kpiOutboxStore.removeItem(clientUuid);
    await muat();
  }

  async function tandaiError(clientUuid: string, pesan: string) {
    const cur = await kpiOutboxStore.getItem<LaporanOutboxItem>(clientUuid);
    if (cur) {
      await kpiOutboxStore.setItem(clientUuid, { ...cur, error: pesan });
      await muat();
    }
  }

  function pesanServer(error: unknown): string {
    const data = (error as { data?: { errors?: { message?: string }[] } })?.data;
    const msg = data?.errors?.[0]?.message;
    return typeof msg === "string" && msg ? msg : "Laporan ditolak server.";
  }

  function isJaringan(error: unknown): boolean {
    const e = error as { data?: unknown; status?: number; message?: string };
    if (e?.data !== undefined) return false;
    return true;
  }

  // Sinkron FIFO; return jumlah terkirim. Tepat-sekali dijamin server via client_uuid.
  async function sync(): Promise<number> {
    if (menyinkron.value) return 0;
    menyinkron.value = true;
    let terkirim = 0;
    try {
      await muat();
      for (const item of [...items.value]) {
        if (item.error && item.error.startsWith("Laporan ditolak")) continue;
        try {
          const { id: buktiFileId } = await uploadBerkas(
            new File([item.bukti], item.buktiNama, { type: item.buktiTipe }),
            `Bukti laporan minggu ${item.mingguKe}`,
          );
          await $fetch("/panel/operasional/laporan", {
            method: "POST",
            body: {
              clientUuid: item.clientUuid,
              mingguKe: item.mingguKe,
              omzet: item.omzet,
              jumlahTransaksi: item.jumlahTransaksi,
              buktiFileId,
              catatanKendala: item.catatanKendala,
              dikirimPada: item.dikirimPada,
            },
          });
          await hapus(item.clientUuid);
          terkirim += 1;
        } catch (error) {
          if (isJaringan(error)) break;
          await tandaiError(item.clientUuid, pesanServer(error));
        }
      }
      return terkirim;
    } finally {
      menyinkron.value = false;
    }
  }

  if (import.meta.client) {
    onMounted(() => {
      void muat();
    });
    watch(
      online,
      async (ya) => {
        if (ya) {
          const n = await sync();
          if (n > 0) {
            // Toast sukses sinkronisasi (M5-02).
            const el = document.createElement("div");
            el.setAttribute("role", "status");
            el.textContent = `Sinkronisasi Berhasil! ${n} Laporan Mingguan Telah Terkirim ke Server Provinsi.`;
            el.className = "sr-only";
            document.body.appendChild(el);
            window.setTimeout(() => el.remove(), 8000);
          }
        }
      },
    );
  }

  return { items, memuat, menyinkron, muat, enqueue, hapus, sync };
}

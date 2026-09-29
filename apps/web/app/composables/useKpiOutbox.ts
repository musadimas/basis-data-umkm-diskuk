import { useOnline } from "@vueuse/core";
import { discard, enqueue, flushOutbox, hasilUntukEntri, listOutbox, type HasilKirimOutbox, type OutboxEntry } from "~/lib/kpi-outbox";

/**
 * Reactive view of the KPI outbox for one participant. Syncs on mount, whenever the browser
 * comes back online, and every 30 seconds while something is still queued.
 */
export function useKpiOutbox(pesertaId: Ref<string | null>, onSent?: () => void) {
  const directus = useDirectus();
  const networkOnline = useOnline();
  const demoConnection = useDemoConnection();
  const online = computed(() => networkOnline.value && !(demoConnection.enabled.value && demoConnection.simulatedOffline.value));
  const entries = ref<OutboxEntry[]>([]);
  const syncing = ref(false);

  async function reload() {
    if (!import.meta.client) return;
    entries.value = pesertaId.value ? await listOutbox(pesertaId.value) : [];
  }

  async function sync() {
    if (!import.meta.client || syncing.value || !online.value) return;
    syncing.value = true;
    try {
      const result = await flushOutbox(directus);
      if (result.sent.length) onSent?.();
    } finally {
      syncing.value = false;
      await reload();
    }
  }

  async function add(entry: Parameters<typeof enqueue>[0]): Promise<HasilKirimOutbox> {
    await enqueue(entry);
    await reload();
    await sync();
    const sesudah = (await listOutbox(entry.pesertaId)).find((item) => item.clientUuid === entry.clientUuid);
    return hasilUntukEntri(sesudah);
  }

  async function remove(clientUuid: string) {
    await discard(clientUuid);
    await reload();
  }

  let timer: ReturnType<typeof setInterval> | undefined;
  onMounted(async () => {
    await reload();
    await sync();
    timer = setInterval(() => {
      if (entries.value.some((entry) => !entry.error)) void sync();
    }, 30_000);
  });
  onUnmounted(() => clearInterval(timer));
  watch(online, (value) => value && void sync());
  watch(pesertaId, () => void reload());

  const pending = computed(() => entries.value.filter((entry) => !entry.error));
  const refused = computed(() => entries.value.filter((entry) => entry.error));
  return { online, networkOnline, simulatedOffline: demoConnection.simulatedOffline, demoEnabled: demoConnection.enabled, entries, pending, refused, syncing, add, remove, sync };
}

import { createItem, deleteItem, readItems, updateItem } from "@directus/sdk";
import type { AnalysisConfig, SavedAnalysis } from "~/types/analytics";
import { serializeAnalysisUrl } from "~/lib/analytics-query";

function assertSafeConfig(config: AnalysisConfig) {
  const serialized = JSON.stringify(config);
  if (
    serialized.length > 64000 ||
    /(nik|phone|telepon|birth_date|token|record_id|notes|result|cursor|scroll)/i.test(serialized)
  )
    throw new Error("Konfigurasi analisis tidak valid");
  serializeAnalysisUrl(config);
}

export function useSavedAnalyses() {
  const directus = useDirectus();
  const items = ref<SavedAnalysis[]>([]);
  const pending = ref(false);

  async function load() {
    pending.value = true;
    try {
      const response = await directus.request(
        readItems("analitik_view", {
          fields: ["id", "name", "schema_version", "config", "date_created", "date_updated"],
          sort: ["-date_updated"],
        }),
      );
      items.value = Array.isArray(response) ? response : [];
    } finally {
      pending.value = false;
    }
  }

  async function save(name: string, config: AnalysisConfig) {
    assertSafeConfig(config);
    const saved = await directus.request(
      createItem("analitik_view", { name: name.trim(), schema_version: 1, config }),
    );
    items.value = [saved, ...items.value.filter((item) => item.id !== saved.id)];
    return saved;
  }

  async function rename(id: string, name: string) {
    await directus.request(updateItem("analitik_view", id, { name: name.trim() }));
    const item = items.value.find((value) => value.id === id);
    if (item) item.name = name.trim();
  }

  async function remove(id: string) {
    await directus.request(deleteItem("analitik_view", id));
    items.value = items.value.filter((item) => item.id !== id);
  }

  return { items, pending, load, save, rename, remove };
}

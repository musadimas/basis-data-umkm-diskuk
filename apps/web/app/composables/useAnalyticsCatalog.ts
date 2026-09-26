import type { AnalyticsCatalog, AnalyticsTemplate } from "~/types/analytics";
import { endpoint } from "~/lib/directus";

export interface AnalyticsFieldOptions {
  fieldId: string | null;
  options: Array<{ id: string; label: string }>;
}

export function useAnalyticsCatalog() {
  const directus = useDirectus();
  const catalog = useState<AnalyticsCatalog | null>(
    "analytics:catalog",
    () => null,
  );
  const templates = useState<AnalyticsTemplate[]>(
    "analytics:templates",
    () => [],
  );
  const pending = ref(false);
  const error = ref<unknown>(null);
  const loaded = ref(false);

  async function load() {
    if (loaded.value) return;
    pending.value = true;
    error.value = null;
    try {
      const [meta, templateResponse] = await Promise.all([
        directus.request(endpoint<AnalyticsCatalog>("/v1/analytics/analysis/metadata")),
        directus.request(
          endpoint<{ schemaVersion: number; templates: AnalyticsTemplate[] }>("/v1/analytics/analysis/templates"),
        ),
      ]);
      if (meta.schemaVersion !== 1)
        throw new Error("Skema analitik tidak kompatibel");
      catalog.value = meta;
      templates.value = templateResponse.templates;
      loaded.value = true;
    } catch (cause) {
      error.value = cause;
    } finally {
      pending.value = false;
    }
  }

  /**
   * Nilai opsi filter selalu lewat endpoint metadata/options yang ber-budget
   * di sisi server (tabel referensi kecil + statement timeout). Hasilnya
   * di-cache singkat di klien agar mengetik tidak menghasilkan banjir request;
   * cache di-scope per field+parent+search sehingga cascade tetap akurat.
   */
  async function options(
    fieldId: string,
    search = "",
    parent?: string,
  ): Promise<AnalyticsFieldOptions> {
    // Endpoint menerima parameter opsional parent untuk cascade wilayah/KBLI;
    // parameter hanya dikirim bila benar-benar ada nilainya.
    return directus.request(
      endpoint<AnalyticsFieldOptions>("/v1/analytics/analysis/metadata/options", {
        query: { fieldId, search, parent: parent || undefined },
      }),
    );
  }

  return { catalog, templates, pending, error, load, options };
}

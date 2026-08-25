import type { AnalyticsCatalog, AnalyticsTemplate } from "~/types/analytics";

export interface AnalyticsFieldOptions {
  fieldId: string | null;
  options: Array<{ id: string; label: string }>;
}

export function useAnalyticsCatalog() {
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
      const ssrHeaders = import.meta.server
        ? useRequestHeaders(["cookie"])
        : undefined;
      const [meta, templateResponse] = await Promise.all([
        $fetch<AnalyticsCatalog>("/panel/analitik/metadata", {
          credentials: "include",
          headers: ssrHeaders,
        }),
        $fetch<{ schemaVersion: number; templates: AnalyticsTemplate[] }>(
          "/panel/analitik/templates",
          { credentials: "include", headers: ssrHeaders },
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
    const ssrHeaders = import.meta.server
      ? useRequestHeaders(["cookie"])
      : undefined;
    // Endpoint menerima parameter opsional parent untuk cascade wilayah/KBLI;
    // parameter hanya dikirim bila benar-benar ada nilainya.
    const query = { fieldId, search, parent: parent || "" };
    return $fetch<AnalyticsFieldOptions>("/panel/analitik/metadata/options", {
      query: parent ? query : { fieldId, search },
      credentials: "include",
      headers: ssrHeaders,
    });
  }

  return { catalog, templates, pending, error, load, options };
}

import type {
  AnalysisConfig,
  AnalyticsExportStatus,
  AnalyticsExportType,
} from "~/types/analytics";
import { endpoint, fromEnvelope, type Enveloped } from "~/lib/directus";
import { exportRequestBody, type ExportRequestBody } from "~/lib/analytics-export";
import { isUnauthorized } from "~/lib/request-error";

export function useAnalyticsExports() {
  const directus = useDirectus();
  const status = shallowRef<AnalyticsExportStatus | null>(null);
  const pending = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function submit(
    type: AnalyticsExportType,
    config: AnalysisConfig,
    options: { profileId?: string; title?: string } = {},
  ) {
    pending.value = true;
    try {
      const body = exportRequestBody(type, config, options);
      status.value = fromEnvelope<AnalyticsExportStatus>(
        await directus.request(
          endpoint<Enveloped<AnalyticsExportStatus>, ExportRequestBody>("/v1/analytics/analysis/exports", {
            method: "POST",
            body,
          }),
        ),
      );
      if (["queued", "processing"].includes(status.value.data.status))
        poll(status.value.data.jobId);
    } catch (cause: unknown) {
      if (import.meta.client && isUnauthorized(cause))
        window.dispatchEvent(new Event("auth:unauthorized"));
      throw cause;
    } finally {
      pending.value = false;
    }
  }
  async function poll(jobId: string) {
    clearTimeout(timer);
    try {
      const next = fromEnvelope<AnalyticsExportStatus>(
        await directus.request(
          endpoint<Enveloped<AnalyticsExportStatus>>(`/v1/analytics/analysis/exports/${encodeURIComponent(jobId)}`),
        ),
      );
      status.value = next;
      if (["queued", "processing"].includes(next.data.status))
        timer = setTimeout(() => void poll(jobId), 1500);
    } catch (cause: unknown) {
      if (import.meta.client && isUnauthorized(cause))
        window.dispatchEvent(new Event("auth:unauthorized"));
    }
  }
  onBeforeUnmount(() => clearTimeout(timer));
  return { status, pending, submit };
}

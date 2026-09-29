/*
 * Body POST /v1/analytics/analysis/exports. Judul dokumen ikut dikirim supaya
 * PDF/PNG/PPT agregat tidak lagi memakai judul bawaan worker (B26); router
 * menyimpannya di `analitik_job.request` dan worker memakainya apa adanya.
 */
import type { AnalysisConfig, AnalyticsExportType } from "~/types/analytics";

export interface ExportRequestBody {
  exportType: AnalyticsExportType;
  config: AnalysisConfig;
  profileId?: string;
  title?: string;
}

export function exportRequestBody(
  type: AnalyticsExportType,
  config: AnalysisConfig,
  options: { profileId?: string; title?: string } = {},
): ExportRequestBody {
  const body: ExportRequestBody = { exportType: type, config };
  if (options.profileId) body.profileId = options.profileId;
  const title = options.title?.trim();
  if (title) body.title = title;
  return body;
}

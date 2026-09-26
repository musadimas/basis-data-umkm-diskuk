/**
 * Offline-first outbox for weekly KPI reports (Brief Fitur Modul 5). Every report is written
 * here first, including its photos as Blobs, and then synced: photos upload to Directus
 * /files and the report posts to /v1/program/kpi. The report's clientUuid makes a retried
 * POST return the stored report instead of creating a second one.
 *
 * Cleared on logout with the rest of the private browser state (ADR-004), so unsent reports
 * do not survive signing out.
 */
import { uploadFiles } from "@directus/sdk";
import { endpoint } from "~/lib/directus";
import { requestErrorCode, requestStatus } from "~/lib/request-error";
import { kpiOutboxStore } from "~/lib/idb";
import type { KpiLaporan, KpiLaporanInput } from "~/types/program";

export interface OutboxPhoto {
  name: string;
  type: string;
  blob: Blob;
  /** Directus file id once uploaded, so a retry does not upload it again. */
  fileId: string | null;
}

export interface OutboxEntry {
  clientUuid: string;
  pesertaId: string;
  mingguKe: number;
  realisasiOmzet: number;
  jumlahTransaksi: number;
  kendala: string | null;
  photos: OutboxPhoto[];
  createdAt: string;
  /** Set when the server refused the report; the entry stays until the user discards it. */
  error: { code: string; message: string } | null;
}

export async function listOutbox(pesertaId?: string): Promise<OutboxEntry[]> {
  const entries: OutboxEntry[] = [];
  await kpiOutboxStore.iterate<OutboxEntry, undefined>((value) => {
    if (!pesertaId || value.pesertaId === pesertaId) entries.push(value);
  });
  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function enqueue(entry: Omit<OutboxEntry, "createdAt" | "error">): Promise<OutboxEntry> {
  const stored: OutboxEntry = { ...entry, createdAt: new Date().toISOString(), error: null };
  await kpiOutboxStore.setItem(entry.clientUuid, stored);
  return stored;
}

export function discard(clientUuid: string) {
  return kpiOutboxStore.removeItem(clientUuid);
}

const REJECTION_MESSAGES: Record<string, string> = {
  LAPORAN_SUDAH_ADA: "Laporan minggu ini sudah terkirim sebelumnya.",
  MINGGU_TIDAK_VALID: "Minggu laporan belum dimulai.",
  PESERTA_TIDAK_AKTIF: "Kepesertaan program sudah tidak aktif.",
  INVALID_REFERENCE: "Foto bukti tidak ditemukan di server.",
  FORBIDDEN: "Akun ini tidak dapat mengirim laporan untuk usaha tersebut.",
};

type Directus = ReturnType<typeof useDirectus>;

/**
 * A failure worth retrying later: offline, timeout, server/proxy error, or an expired session
 * (the report must survive until the user signs in again).
 */
function retryable(error: unknown) {
  const status = requestStatus(error);
  return status === undefined || status === 401 || status === 408 || status === 429 || status >= 500;
}

/**
 * Sends every queued report. Stops at the first retryable failure (usually: still offline) and
 * leaves the rest queued; a report the server refuses is kept with its error for the user.
 */
export async function flushOutbox(directus: Directus): Promise<{ sent: KpiLaporan[]; failed: number; offline: boolean }> {
  const sent: KpiLaporan[] = [];
  let failed = 0;
  for (const entry of await listOutbox()) {
    if (entry.error) {
      failed += 1;
      continue;
    }
    try {
      for (const photo of entry.photos) {
        if (photo.fileId) continue;
        const form = new FormData();
        form.append("file", new File([photo.blob], photo.name, { type: photo.type }));
        const uploaded = await directus.request(uploadFiles(form));
        photo.fileId = (uploaded as { id: string }).id;
        await kpiOutboxStore.setItem(entry.clientUuid, entry);
      }
      const laporan = await directus.request(
        endpoint<KpiLaporan, KpiLaporanInput>(`/v1/program/kpi/peserta/${entry.pesertaId}/laporan`, {
          method: "POST",
          body: {
            mingguKe: entry.mingguKe,
            realisasiOmzet: entry.realisasiOmzet,
            jumlahTransaksi: entry.jumlahTransaksi,
            kendala: entry.kendala,
            bukti: entry.photos.map((photo) => photo.fileId).filter((id): id is string => Boolean(id)),
            clientUuid: entry.clientUuid,
          },
        }),
      );
      await discard(entry.clientUuid);
      sent.push(laporan);
    } catch (error) {
      if (retryable(error)) return { sent, failed, offline: true };
      const code = requestErrorCode(error) ?? "UNKNOWN";
      entry.error = { code, message: REJECTION_MESSAGES[code] ?? "Laporan ditolak server. Periksa isian lalu kirim ulang." };
      await kpiOutboxStore.setItem(entry.clientUuid, entry);
      failed += 1;
    }
  }
  return { sent, failed, offline: false };
}

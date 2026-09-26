# ADR-005: Internal Health Collection dan Reliability Targets

- **Status:** Accepted dengan risiko monitoring eksternal
- **Tanggal:** 18 Agustus 2026
- **Keputusan target:** sebagian diimplementasikan pada `services/analytics-worker/src/watchdog.js` dan tabel `analitik_health`; integrasi monitoring/alerting eksternal belum ada

## Context

Pengguna meminta observability tinggi dan perhatian pada RTO, tetapi memilih MVP tanpa Prometheus/Grafana/APM atau push alert. Incident akan diperiksa melalui Directus. Health dan incident harus berada dalam satu collection.

## Decision

1. Gunakan structured container logs dan collection `analitik_health`.
2. `analitik_health.record_type` membedakan:
   - upserted `component_status`/heartbeat;
   - deduplicated `incident` lifecycle;
   - append-only `reconciliation` result.
3. Recovery menyelesaikan incident yang sama berdasarkan fingerprint; tidak ada `analitik_incident` terpisah.
4. Directus watchdog memeriksa worker heartbeat, queue, freshness, leases, dan reconciliation.
5. UI pengguna hanya melihat waktu data serta pesan current/processing/stale; detail operasional hanya Directus/log.
6. Log operasional disimpan 30 hari; audit CRUD/login/config/export satu tahun, dengan sanitasi dan access control.
7. Retry maksimal lima kali; dead jobs dapat direplay teraudit.
8. Rekonsiliasi harian dan setelah rebuild/publish.
9. Target:
   - worker RTO ≤15 menit;
   - Analytics API RTO ≤1 jam;
   - full platform RTO ≤4 jam;
   - database disaster RPO ≤15 menit melalui WAL/PITR.
10. Transactional outbox memberi no-event-loss durability selama database selamat; ini bukan infrastructure RPO 0.

## Accepted risk

Internal watchdog tidak dapat mendeteksi matinya Directus atau PostgreSQL itu sendiri. Pemeriksaan manual membuat time-to-detect bergantung pada cadence manusia. Oleh sebab itu target RTO adalah target desain, bukan jaminan end-to-end, sampai external uptime monitoring tersedia.

## Consequences

### Positive

- Satu tempat Directus untuk status, incident, recovery, dan reconciliation.
- Last-known-good mempertahankan data ketika worker/projection gagal.
- Correlation ID mendukung analisis insiden.

### Negative

- Tidak ada push alert.
- Outage total dapat tidak terdeteksi.
- Structured log retention memerlukan Docker rotation/storage yang nyata.
- RTO/RPO memerlukan restore drill dan bukti, bukan konfigurasi di atas kertas.

## Threshold baseline

- oldest job >60 detik: warning;
- API p95 >3 detik selama 5 menit: warning;
- oldest job >5 menit: critical;
- worker heartbeat terlewat: critical;
- reconciliation diff: critical;
- error rate >5%: critical;
- belum pulih setelah 10 menit: RTO risk.

## Alternatives rejected/deferred

- **Log saja tanpa health collection:** sulit diperiksa melalui Directus.
- **Collection incident terpisah:** ditolak pengguna; satu collection cukup dengan record type.
- **OpenTelemetry/Prometheus/Grafana/Loki:** ditunda.
- **Hosted APM/push channel:** ditunda.

## Acceptance evidence required

- Heartbeat/upsert dan incident dedupe/recovery test.
- Worker failure/stuck lease/dead job test.
- Last-known-good test.
- Reconciliation mismatch test.
- Log PII/credential scan.
- WAL/PITR restore drill serta measured RTO.
- Dokumentasi accepted gap external outage detection.

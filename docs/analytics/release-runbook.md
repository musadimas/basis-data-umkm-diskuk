# Analytics Release Runbook

## Preconditions

1. Preserve the dirty-worktree baseline and run the closed-manifest scope check.
2. Run static, unit, extension, worker, browser, and leak gates. Attach machine-readable summaries without secrets.
3. Confirm an off-host encrypted S3-compatible `WALG_S3_PREFIX`; same-host MinIO is not disaster evidence.
4. Confirm a new isolated PITR/object restore target and explicit operator approval. No production restore or key rotation is performed by automated tests.
5. Confirm active generation is reconciled, worker heartbeat is healthy, and source/read-model invariants are zero-diff.

## Deployment

- Build immutable Directus, worker, and web images with the pinned Directus/WAL-G versions.
- Apply migrations in order; do not activate a candidate generation until reconcile passes.
- Keep database, MinIO, MinIO Console, Directus admin, and worker ports private; only Caddy 80/443 are ingress.
- Verify cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in TLS, and private responses are `private, no-store`.
- Run `node scripts/verify-analytics-release.mjs`; redact cookies and signed download parameters from all evidence.

## Rollback

Rollback application images to the previous compatible digest and point the API to the previous reconciled generation. Do not first use destructive database rollback. Retain source, outbox, audit, and export objects until their normal retention boundary. If source/database corruption is suspected, stop writes and use the isolated PITR runbook; never overwrite the running source target.

## Incident and backup drill

- Worker/queue incident: keep last-known-good visible, inspect sanitized health, replay after root cause, and reconcile.
- WAL failure: open a critical incident, do not claim RPO, and repair credentials/network before the next backup.
- Object backup/restore: use separate backup credentials and `CONFIRM_OBJECT_RESTORE=isolated-test`; production/existing buckets must be rejected.
- PITR evidence records requested target time, selected backup/WAL, restored timestamp, migration/rebuild/reconcile result, RPO, RTO, and isolated target path. Paths containing secrets or PII are excluded from receipts.

## Final status

A local Compose build proves wiring only. Off-host durability, provider encryption, firewall/DNS, key rotation, production probes, and end-to-end RTO/RPO remain `not runtime-proven` until their external receipts are attached.

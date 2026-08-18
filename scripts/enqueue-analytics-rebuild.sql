\set ON_ERROR_STOP on
SELECT id, status
FROM analitik_job
WHERE id = analitik_enqueue_job('rebuild_current_model', 'rebuild_current_model', NULL);

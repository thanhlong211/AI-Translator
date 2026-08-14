-- Batch 14.9.2: enrich Admin audit trail with actor/request metadata for operational traceability.
-- Existing rows stay valid; new metadata is nullable so this migration is backward-compatible.

ALTER TABLE admin_audit_log
    ADD COLUMN actor_role VARCHAR(30) NULL AFTER actor_user_id,
    ADD COLUMN request_id VARCHAR(100) NULL AFTER details,
    ADD COLUMN http_method VARCHAR(12) NULL AFTER request_id,
    ADD COLUMN request_path VARCHAR(500) NULL AFTER http_method,
    ADD COLUMN remote_ip VARCHAR(64) NULL AFTER request_path,
    ADD COLUMN forwarded_for VARCHAR(500) NULL AFTER remote_ip,
    ADD COLUMN user_agent VARCHAR(500) NULL AFTER forwarded_for,
    ADD KEY idx_admin_audit_action_created (action, created_at),
    ADD KEY idx_admin_audit_request_id (request_id);

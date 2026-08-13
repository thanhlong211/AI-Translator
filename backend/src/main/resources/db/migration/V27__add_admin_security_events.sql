-- Batch 14.9.1: Admin authentication / authorization / sensitive-action security event ledger.
-- Stores request metadata only. Never stores passwords, JWTs, request bodies, prompts, OCR text or translated content.

CREATE TABLE admin_security_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    category VARCHAR(40) NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    outcome VARCHAR(20) NOT NULL,
    actor_user_id BIGINT NULL,
    actor_role VARCHAR(30) NULL,
    attempted_email VARCHAR(190) NULL,
    target_user_id BIGINT NULL,
    request_id VARCHAR(100) NULL,
    http_method VARCHAR(12) NULL,
    request_path VARCHAR(500) NULL,
    remote_ip VARCHAR(64) NULL,
    forwarded_for VARCHAR(500) NULL,
    user_agent VARCHAR(500) NULL,
    details VARCHAR(2000) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_admin_security_created (created_at),
    KEY idx_admin_security_category_created (category, created_at),
    KEY idx_admin_security_type_created (event_type, created_at),
    KEY idx_admin_security_severity_created (severity, created_at),
    KEY idx_admin_security_outcome_created (outcome, created_at),
    KEY idx_admin_security_actor_created (actor_user_id, created_at),
    KEY idx_admin_security_target_created (target_user_id, created_at),
    CONSTRAINT fk_admin_security_actor
        FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_admin_security_target
        FOREIGN KEY (target_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_admin_security_category
        CHECK (category IN ('AUTHENTICATION', 'AUTHORIZATION', 'ADMIN_ACTION')),
    CONSTRAINT chk_admin_security_severity
        CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    CONSTRAINT chk_admin_security_outcome
        CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

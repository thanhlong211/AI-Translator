-- Batch 14.5: Admin Console foundation.
-- Does not modify existing subscriptions/licenses. Admin plan overrides sit above them.

CREATE TABLE user_plan_overrides (
    user_id BIGINT NOT NULL,
    plan_code VARCHAR(30) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    expires_at TIMESTAMP(6) NULL,
    reason VARCHAR(500) NOT NULL,
    updated_by_user_id BIGINT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id),
    KEY idx_user_plan_overrides_active_expiry (active, expires_at),
    CONSTRAINT fk_user_plan_override_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_plan_override_plan
        FOREIGN KEY (plan_code) REFERENCES plan_catalog(code),
    CONSTRAINT fk_user_plan_override_admin
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_audit_log (
    id BIGINT NOT NULL AUTO_INCREMENT,
    actor_user_id BIGINT NULL,
    action VARCHAR(80) NOT NULL,
    target_user_id BIGINT NULL,
    details TEXT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_admin_audit_created (created_at),
    KEY idx_admin_audit_actor (actor_user_id, created_at),
    KEY idx_admin_audit_target (target_user_id, created_at),
    CONSTRAINT fk_admin_audit_actor
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_admin_audit_target
        FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

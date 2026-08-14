-- Batch 14.9.5: persistent Admin Safety Controls.
-- READ_ONLY blocks Admin write endpoints while preserving login, incident lifecycle and the safety unlock endpoint.

CREATE TABLE admin_safety_state (
    id TINYINT NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    reason VARCHAR(500) NULL,
    changed_by_user_id BIGINT NULL,
    changed_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_admin_safety_changed_by
        FOREIGN KEY (changed_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_admin_safety_singleton CHECK (id = 1),
    CONSTRAINT chk_admin_safety_mode CHECK (mode IN ('NORMAL', 'READ_ONLY'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_safety_state (
    id,
    mode,
    reason,
    changed_by_user_id,
    changed_at
) VALUES (
    1,
    'NORMAL',
    'Initial Admin safety state',
    NULL,
    CURRENT_TIMESTAMP(6)
);

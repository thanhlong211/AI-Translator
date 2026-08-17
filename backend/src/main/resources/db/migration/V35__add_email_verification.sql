ALTER TABLE users
    ADD COLUMN email_verified_at TIMESTAMP(6) NULL
        AFTER device_bound_at;

-- Preserve all accounts that existed before email verification was introduced.
-- New accounts created after this migration keep email_verified_at = NULL
-- until they verify their email.
UPDATE users
SET email_verified_at = CURRENT_TIMESTAMP(6)
WHERE email_verified_at IS NULL;

CREATE TABLE email_verification_tokens (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,

    code_hash VARCHAR(100)
        CHARACTER SET ascii
        COLLATE ascii_bin
        NOT NULL,

    expires_at TIMESTAMP(6) NOT NULL,
    used_at TIMESTAMP(6) NULL,

    failed_attempts INT NOT NULL DEFAULT 0,

    requested_ip VARCHAR(64) NULL,

    created_at TIMESTAMP(6)
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    KEY idx_email_verification_user_active (
        user_id,
        used_at,
        expires_at
    ),

    KEY idx_email_verification_created (
        created_at
    ),

    CONSTRAINT fk_email_verification_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE device_transfer_tokens (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,

    target_device_id VARCHAR(100) NOT NULL,
    target_device_name VARCHAR(190) NOT NULL,

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

    KEY idx_device_transfer_user_active (
        user_id,
        used_at,
        expires_at
    ),

    KEY idx_device_transfer_target_active (
        target_device_id,
        used_at,
        expires_at
    ),

    KEY idx_device_transfer_created (
        created_at
    ),

    CONSTRAINT fk_device_transfer_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE daily_usage_counters (
    user_id BIGINT NOT NULL,
    usage_date DATE NOT NULL,
    quota_key VARCHAR(64) NOT NULL,
    used_units BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id, usage_date, quota_key),
    KEY idx_daily_usage_date_key (usage_date, quota_key),
    CONSTRAINT fk_daily_usage_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

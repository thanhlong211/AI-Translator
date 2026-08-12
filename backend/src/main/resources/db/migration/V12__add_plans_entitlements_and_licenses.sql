-- Batch 12: commercial plans, feature entitlements, limits and license activation.
-- Existing translation/subscription data is preserved.

CREATE TABLE plan_catalog (
    code VARCHAR(30) NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    rank_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE plan_features (
    plan_code VARCHAR(30) NOT NULL,
    feature_key VARCHAR(80) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (plan_code, feature_key),
    CONSTRAINT fk_plan_features_plan
        FOREIGN KEY (plan_code)
        REFERENCES plan_catalog (code)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE plan_limits (
    plan_code VARCHAR(30) NOT NULL,
    limit_key VARCHAR(80) NOT NULL,
    limit_value BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (plan_code, limit_key),
    CONSTRAINT fk_plan_limits_plan
        FOREIGN KEY (plan_code)
        REFERENCES plan_catalog (code)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE subscriptions
    ADD COLUMN source VARCHAR(30) NOT NULL DEFAULT 'SYSTEM' AFTER status,
    ADD COLUMN reference_id BIGINT NULL AFTER source,
    ADD KEY idx_subscriptions_user_status_period (
        user_id,
        status,
        period_start,
        period_end
    );

CREATE TABLE license_keys (
    id BIGINT NOT NULL AUTO_INCREMENT,
    key_hash CHAR(64) NOT NULL,
    plan_code VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    max_activations INT NOT NULL DEFAULT 1,
    activation_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_license_keys_hash (key_hash),
    KEY idx_license_keys_plan_status (plan_code, status),
    CONSTRAINT fk_license_keys_plan
        FOREIGN KEY (plan_code)
        REFERENCES plan_catalog (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE license_activations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    license_key_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    activated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_license_activation_user (license_key_id, user_id),
    KEY idx_license_activations_user (user_id, activated_at),
    CONSTRAINT fk_license_activations_license
        FOREIGN KEY (license_key_id)
        REFERENCES license_keys (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_license_activations_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO plan_catalog (code, display_name, rank_order, active) VALUES
    ('FREE', 'Free', 10, TRUE),
    ('PRO', 'Pro', 20, TRUE),
    ('MANGA_PLUS', 'Manga+', 30, TRUE);

INSERT INTO plan_features (plan_code, feature_key, enabled) VALUES
    ('FREE', 'quickTranslate', TRUE),
    ('FREE', 'studyMode', TRUE),
    ('FREE', 'mangaPanel', TRUE),
    ('FREE', 'mangaSession', TRUE),
    ('FREE', 'translationMemory', TRUE),
    ('FREE', 'continuousManga', FALSE),
    ('FREE', 'novelReaderTxt', FALSE),
    ('FREE', 'novelReaderEpub', FALSE),

    ('PRO', 'quickTranslate', TRUE),
    ('PRO', 'studyMode', TRUE),
    ('PRO', 'mangaPanel', TRUE),
    ('PRO', 'mangaSession', TRUE),
    ('PRO', 'translationMemory', TRUE),
    ('PRO', 'continuousManga', FALSE),
    ('PRO', 'novelReaderTxt', TRUE),
    ('PRO', 'novelReaderEpub', TRUE),

    ('MANGA_PLUS', 'quickTranslate', TRUE),
    ('MANGA_PLUS', 'studyMode', TRUE),
    ('MANGA_PLUS', 'mangaPanel', TRUE),
    ('MANGA_PLUS', 'mangaSession', TRUE),
    ('MANGA_PLUS', 'translationMemory', TRUE),
    ('MANGA_PLUS', 'continuousManga', TRUE),
    ('MANGA_PLUS', 'novelReaderTxt', TRUE),
    ('MANGA_PLUS', 'novelReaderEpub', TRUE);

INSERT INTO plan_limits (plan_code, limit_key, limit_value) VALUES
    ('FREE', 'monthlyTranslations', 300),
    ('FREE', 'mangaPagesPerDay', 20),
    ('FREE', 'continuousMangaPagesPerDay', 0),
    ('FREE', 'contextItems', 5),
    ('FREE', 'devices', 1),

    ('PRO', 'monthlyTranslations', 5000),
    ('PRO', 'mangaPagesPerDay', 100),
    ('PRO', 'continuousMangaPagesPerDay', 0),
    ('PRO', 'contextItems', 10),
    ('PRO', 'devices', 2),

    ('MANGA_PLUS', 'monthlyTranslations', 15000),
    ('MANGA_PLUS', 'mangaPagesPerDay', 500),
    ('MANGA_PLUS', 'continuousMangaPagesPerDay', 300),
    ('MANGA_PLUS', 'contextItems', 20),
    ('MANGA_PLUS', 'devices', 3);

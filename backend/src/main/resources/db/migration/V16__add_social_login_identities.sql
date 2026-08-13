CREATE TABLE user_identities (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    provider VARCHAR(30) NOT NULL,
    provider_subject VARCHAR(190) NOT NULL,
    email_at_link VARCHAR(190) NULL,
    display_name VARCHAR(190) NULL,
    avatar_url VARCHAR(500) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_login_at TIMESTAMP(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_user_identities_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_identities_provider_subject
        UNIQUE (provider, provider_subject),
    CONSTRAINT uq_user_identities_user_provider
        UNIQUE (user_id, provider),
    INDEX idx_user_identities_user (user_id)
);

CREATE TABLE social_auth_attempts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    attempt_id VARCHAR(36) NOT NULL,
    poll_secret_hash CHAR(64) NOT NULL,
    state_secret_hash CHAR(64) NOT NULL,
    provider VARCHAR(30) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    requested_by_user_id BIGINT NULL,
    resolved_user_id BIGINT NULL,
    device_id VARCHAR(100) NULL,
    device_name VARCHAR(190) NULL,
    status VARCHAR(30) NOT NULL,
    error_code VARCHAR(80) NULL,
    error_message VARCHAR(500) NULL,
    created_at TIMESTAMP(6) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    completed_at TIMESTAMP(6) NULL,
    consumed_at TIMESTAMP(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_social_auth_attempt_id UNIQUE (attempt_id),
    CONSTRAINT fk_social_auth_requested_user
        FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_social_auth_resolved_user
        FOREIGN KEY (resolved_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_social_auth_expiry (expires_at),
    INDEX idx_social_auth_status (status)
);

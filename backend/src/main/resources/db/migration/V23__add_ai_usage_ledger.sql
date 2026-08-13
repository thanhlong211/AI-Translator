-- Batch 14.8.1: metadata-only AI usage ledger.
-- Never store prompts, OCR/document text, translations, or other user content here.
CREATE TABLE ai_usage_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NULL,
    request_id VARCHAR(64) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_request_id VARCHAR(120) NULL,
    model VARCHAR(120) NOT NULL,
    feature VARCHAR(50) NOT NULL,
    plan_code VARCHAR(30) NOT NULL,
    input_tokens BIGINT NULL,
    output_tokens BIGINT NULL,
    cached_tokens BIGINT NULL,
    total_tokens BIGINT NULL,
    latency_ms BIGINT NOT NULL DEFAULT 0,
    successful BOOLEAN NOT NULL,
    error_code VARCHAR(120) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_ai_usage_created (created_at),
    KEY idx_ai_usage_user_created (user_id, created_at),
    KEY idx_ai_usage_feature_created (feature, created_at),
    KEY idx_ai_usage_plan_created (plan_code, created_at),
    KEY idx_ai_usage_provider_model_created (provider, model, created_at),
    KEY idx_ai_usage_request (request_id),
    CONSTRAINT fk_ai_usage_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

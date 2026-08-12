-- Batch 06: explicit user correction dataset.
-- IMPORTANT: allow_model_improvement defaults to FALSE.
-- A saved correction is not automatically authorized for model training.

CREATE TABLE translation_feedback (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    profile_id BIGINT NULL,
    source_text TEXT NOT NULL,
    ai_translation TEXT NOT NULL,
    corrected_translation TEXT NOT NULL,
    source_language VARCHAR(16) NOT NULL DEFAULT 'AUTO',
    target_language VARCHAR(16) NOT NULL DEFAULT 'VI',
    provider VARCHAR(80) NULL,
    model VARCHAR(120) NULL,
    request_id VARCHAR(120) NULL,
    allow_model_improvement BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    INDEX idx_translation_feedback_user_created (user_id, created_at),
    INDEX idx_translation_feedback_language_pair (source_language, target_language),
    INDEX idx_translation_feedback_model_improvement (allow_model_improvement, created_at)
);

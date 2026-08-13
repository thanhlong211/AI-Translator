-- Batch 14.8.2: provider/model cost configuration.
-- Rates are stored per 1,000,000 tokens and versioned by effective window.
CREATE TABLE ai_model_costs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(120) NOT NULL,
    currency CHAR(3) NOT NULL,
    input_cost_per_million DECIMAL(20,8) NOT NULL,
    cached_input_cost_per_million DECIMAL(20,8) NOT NULL,
    output_cost_per_million DECIMAL(20,8) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from DATETIME(6) NULL,
    effective_to DATETIME(6) NULL,
    notes VARCHAR(500) NULL,
    created_by_user_id BIGINT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_ai_model_cost_lookup (provider, model, currency, active, effective_from, effective_to),
    KEY idx_ai_model_cost_effective (active, effective_from, effective_to),
    CONSTRAINT fk_ai_model_cost_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT chk_ai_model_cost_input_non_negative
        CHECK (input_cost_per_million >= 0),
    CONSTRAINT chk_ai_model_cost_cached_non_negative
        CHECK (cached_input_cost_per_million >= 0),
    CONSTRAINT chk_ai_model_cost_output_non_negative
        CHECK (output_cost_per_million >= 0),
    CONSTRAINT chk_ai_model_cost_window
        CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

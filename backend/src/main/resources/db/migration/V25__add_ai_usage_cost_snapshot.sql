-- Batch 14.8.3: immutable estimated-cost snapshot for AI usage events.
-- Cost values are metadata only; no prompt/document/translation content is stored.
ALTER TABLE ai_usage_events
    ADD COLUMN model_cost_id BIGINT NULL AFTER error_code,
    ADD COLUMN cost_currency CHAR(3) NULL AFTER model_cost_id,
    ADD COLUMN input_rate_per_million DECIMAL(20,8) NULL AFTER cost_currency,
    ADD COLUMN cached_input_rate_per_million DECIMAL(20,8) NULL AFTER input_rate_per_million,
    ADD COLUMN output_rate_per_million DECIMAL(20,8) NULL AFTER cached_input_rate_per_million,
    ADD COLUMN input_cost DECIMAL(24,12) NULL AFTER output_rate_per_million,
    ADD COLUMN cached_input_cost DECIMAL(24,12) NULL AFTER input_cost,
    ADD COLUMN output_cost DECIMAL(24,12) NULL AFTER cached_input_cost,
    ADD COLUMN estimated_cost DECIMAL(24,12) NULL AFTER output_cost,
    ADD COLUMN cost_status VARCHAR(32) NOT NULL DEFAULT 'MISSING_RATE' AFTER estimated_cost,
    ADD COLUMN cost_calculated_at DATETIME(6) NULL AFTER cost_status,
    ADD KEY idx_ai_usage_cost_status_created (cost_status, created_at),
    ADD KEY idx_ai_usage_cost_model (model_cost_id),
    ADD CONSTRAINT fk_ai_usage_model_cost
        FOREIGN KEY (model_cost_id)
        REFERENCES ai_model_costs (id)
        ON DELETE SET NULL;

-- Historical events that never received provider token metadata cannot be costed later.
UPDATE ai_usage_events
SET cost_status = CASE
        WHEN input_tokens IS NULL OR output_tokens IS NULL THEN 'TOKEN_USAGE_UNAVAILABLE'
        ELSE 'MISSING_RATE'
    END;

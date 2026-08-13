-- Batch 14.7.3: subscription lifecycle foundation.
-- Existing LICENSE/SYSTEM subscriptions remain compatible.

ALTER TABLE subscriptions
    MODIFY COLUMN monthly_translation_limit BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN price_id BIGINT NULL AFTER reference_id,
    ADD COLUMN canceled_at TIMESTAMP(6) NULL AFTER period_end,
    ADD COLUMN cancel_reason VARCHAR(500) NULL AFTER canceled_at,
    ADD KEY idx_subscriptions_plan_status (plan, status, period_end),
    ADD KEY idx_subscriptions_price (price_id),
    ADD CONSTRAINT fk_subscriptions_price
        FOREIGN KEY (price_id)
        REFERENCES plan_prices (id)
        ON DELETE SET NULL;

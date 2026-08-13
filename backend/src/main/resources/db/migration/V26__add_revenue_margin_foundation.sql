-- Batch 14.8.6: revenue normalization + FX snapshot foundation for gross margin analytics.
-- 1 base currency major unit = rate quote/reporting currency major units.

CREATE TABLE currency_exchange_rates (
    id BIGINT NOT NULL AUTO_INCREMENT,
    base_currency CHAR(3) NOT NULL,
    quote_currency CHAR(3) NOT NULL,
    rate DECIMAL(24,12) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from TIMESTAMP(6) NOT NULL,
    effective_to TIMESTAMP(6) NULL,
    notes VARCHAR(500) NULL,
    created_by_user_id BIGINT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_fx_pair_effective (base_currency, quote_currency, active, effective_from),
    CONSTRAINT fk_fx_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_fx_positive CHECK (rate > 0),
    CONSTRAINT chk_fx_window CHECK (effective_to IS NULL OR effective_to > effective_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE payment_transactions
    ADD COLUMN reporting_currency CHAR(3) NULL AFTER refunded_amount_minor,
    ADD COLUMN fx_rate_id BIGINT NULL AFTER reporting_currency,
    ADD COLUMN fx_rate DECIMAL(24,12) NULL AFTER fx_rate_id,
    ADD COLUMN gross_amount_reporting DECIMAL(24,8) NULL AFTER fx_rate,
    ADD COLUMN refunded_amount_reporting DECIMAL(24,8) NULL AFTER gross_amount_reporting,
    ADD COLUMN net_amount_reporting DECIMAL(24,8) NULL AFTER refunded_amount_reporting,
    ADD COLUMN revenue_status VARCHAR(30) NOT NULL DEFAULT 'PENDING' AFTER net_amount_reporting,
    ADD COLUMN revenue_normalized_at TIMESTAMP(6) NULL AFTER revenue_status,
    ADD KEY idx_payment_transactions_revenue_status (revenue_status, paid_at),
    ADD KEY idx_payment_transactions_fx_rate (fx_rate_id);

ALTER TABLE payment_transactions
    ADD CONSTRAINT fk_payment_transactions_fx_rate
        FOREIGN KEY (fx_rate_id) REFERENCES currency_exchange_rates (id) ON DELETE SET NULL;

-- Batch 14.7.1: dynamic plan pricing foundation.
-- Prices are stored independently from plans and can be scheduled by time window.
-- No commercial price is seeded here: Admin decides what is actually sold.

CREATE TABLE plan_prices (
    id BIGINT NOT NULL AUTO_INCREMENT,
    plan_code VARCHAR(30) NOT NULL,
    billing_period VARCHAR(30) NOT NULL,
    currency CHAR(3) NOT NULL,
    amount_minor BIGINT NOT NULL,
    compare_at_amount_minor BIGINT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sellable BOOLEAN NOT NULL DEFAULT FALSE,
    starts_at TIMESTAMP(6) NULL,
    ends_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_plan_prices_plan (plan_code, billing_period, currency),
    KEY idx_plan_prices_catalog (active, sellable, starts_at, ends_at),
    CONSTRAINT fk_plan_prices_plan
        FOREIGN KEY (plan_code)
        REFERENCES plan_catalog (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

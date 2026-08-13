-- Batch 14.7.5: payment transaction foundation.
-- Gateway integrations will reuse this table later; this migration only establishes
-- auditable transaction state and linkage to plan/price/subscription.

CREATE TABLE payment_transactions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(80) NOT NULL,
    user_id BIGINT NOT NULL,
    plan_code VARCHAR(30) NOT NULL,
    price_id BIGINT NULL,
    billing_period VARCHAR(30) NOT NULL,
    currency CHAR(3) NOT NULL,
    amount_minor BIGINT NOT NULL,
    refunded_amount_minor BIGINT NOT NULL DEFAULT 0,
    provider VARCHAR(30) NOT NULL,
    provider_reference VARCHAR(190) NULL,
    idempotency_key VARCHAR(190) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    subscription_id BIGINT NULL,
    failure_code VARCHAR(100) NULL,
    failure_message VARCHAR(500) NULL,
    paid_at TIMESTAMP(6) NULL,
    failed_at TIMESTAMP(6) NULL,
    canceled_at TIMESTAMP(6) NULL,
    refunded_at TIMESTAMP(6) NULL,
    created_by_user_id BIGINT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_payment_transactions_public_id (public_id),
    UNIQUE KEY uk_payment_transactions_provider_ref (provider, provider_reference),
    UNIQUE KEY uk_payment_transactions_idempotency (provider, idempotency_key),
    KEY idx_payment_transactions_user_created (user_id, created_at),
    KEY idx_payment_transactions_status_created (status, created_at),
    KEY idx_payment_transactions_plan_created (plan_code, created_at),
    KEY idx_payment_transactions_subscription (subscription_id),
    CONSTRAINT fk_payment_transactions_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_payment_transactions_plan
        FOREIGN KEY (plan_code) REFERENCES plan_catalog (code),
    CONSTRAINT fk_payment_transactions_price
        FOREIGN KEY (price_id) REFERENCES plan_prices (id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_transactions_subscription
        FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_transactions_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

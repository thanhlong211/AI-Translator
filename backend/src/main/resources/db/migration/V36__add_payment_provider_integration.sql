-- Batch 15.5: real payment provider integration foundation.
-- Reuses payment_transactions / plan_prices introduced in earlier commercial batches.

CREATE TABLE payment_provider_prices (
    id BIGINT NOT NULL AUTO_INCREMENT,
    price_id BIGINT NOT NULL,
    provider VARCHAR(30) NOT NULL,
    provider_product_id VARCHAR(190) NULL,
    provider_price_id VARCHAR(190) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uk_payment_provider_price (
        provider,
        provider_price_id
    ),

    UNIQUE KEY uk_payment_provider_price_mapping (
        price_id,
        provider
    ),

    KEY idx_payment_provider_prices_active (
        provider,
        active
    ),

    CONSTRAINT fk_payment_provider_prices_price
        FOREIGN KEY (price_id)
        REFERENCES plan_prices (id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


CREATE TABLE payment_webhook_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    provider VARCHAR(30) NOT NULL,
    provider_event_id VARCHAR(190) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    transaction_id BIGINT NULL,
    payload_sha256 CHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',
    failure_message VARCHAR(500) NULL,
    received_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    processed_at TIMESTAMP(6) NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uk_payment_webhook_provider_event (
        provider,
        provider_event_id
    ),

    KEY idx_payment_webhook_status_received (
        status,
        received_at
    ),

    KEY idx_payment_webhook_transaction (
        transaction_id
    ),

    CONSTRAINT fk_payment_webhook_transaction
        FOREIGN KEY (transaction_id)
        REFERENCES payment_transactions (id)
        ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


ALTER TABLE payment_transactions
    ADD COLUMN checkout_reference VARCHAR(190) NULL
        AFTER provider_reference,
    ADD COLUMN checkout_url VARCHAR(1000) NULL
        AFTER checkout_reference,
    ADD COLUMN provider_customer_reference VARCHAR(190) NULL
        AFTER checkout_url,
    ADD COLUMN provider_subscription_reference VARCHAR(190) NULL
        AFTER provider_customer_reference,

    ADD UNIQUE KEY uk_payment_transactions_checkout_ref (
        provider,
        checkout_reference
    ),

    ADD KEY idx_payment_transactions_provider_customer (
        provider,
        provider_customer_reference
    ),

    ADD KEY idx_payment_transactions_provider_subscription (
        provider,
        provider_subscription_reference
    );

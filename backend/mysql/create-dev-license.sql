-- LOCAL DEVELOPMENT ONLY.
-- Generates one license row for testing Batch 12 activation.
-- Change @raw_key before running. Never use this helper as a production admin flow.

SET @raw_key = 'AIT-MANGA-LOCAL-TEST-CHANGE-ME';
SET @plan_code = 'MANGA_PLUS';
SET @max_activations = 1;
SET @expires_at = DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 30 DAY);

SET @normalized_key = REGEXP_REPLACE(UPPER(TRIM(@raw_key)), '[^A-Z0-9]', '');

INSERT INTO license_keys (
    key_hash,
    plan_code,
    status,
    max_activations,
    activation_count,
    expires_at
) VALUES (
    SHA2(@normalized_key, 256),
    @plan_code,
    'AVAILABLE',
    @max_activations,
    0,
    @expires_at
);

SELECT @raw_key AS license_key_for_local_test;

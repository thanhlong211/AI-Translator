-- Batch 14.7.4: managed license lifecycle.
-- Existing license rows remain compatible through LEGACY_EXPIRY.

ALTER TABLE license_keys
    ADD COLUMN duration_type VARCHAR(30) NOT NULL DEFAULT 'LEGACY_EXPIRY' AFTER plan_code,
    ADD COLUMN starts_at TIMESTAMP(6) NULL AFTER activation_count,
    ADD COLUMN key_hint VARCHAR(30) NULL AFTER expires_at,
    ADD COLUMN note VARCHAR(500) NULL AFTER key_hint,
    ADD COLUMN created_by_user_id BIGINT NULL AFTER note,
    ADD KEY idx_license_keys_window (status, starts_at, expires_at),
    ADD KEY idx_license_keys_created_by (created_by_user_id),
    ADD CONSTRAINT fk_license_keys_created_by
        FOREIGN KEY (created_by_user_id)
        REFERENCES users (id)
        ON DELETE SET NULL;

ALTER TABLE license_activations
    ADD COLUMN device_id VARCHAR(100) NULL AFTER user_id,
    ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' AFTER device_id,
    ADD COLUMN revoked_at TIMESTAMP(6) NULL AFTER activated_at,
    ADD COLUMN revoked_by_user_id BIGINT NULL AFTER revoked_at,
    ADD COLUMN revoke_reason VARCHAR(500) NULL AFTER revoked_by_user_id,
    ADD KEY idx_license_activations_license_status (license_key_id, status),
    ADD KEY idx_license_activations_revoked_by (revoked_by_user_id),
    ADD CONSTRAINT fk_license_activations_revoked_by
        FOREIGN KEY (revoked_by_user_id)
        REFERENCES users (id)
        ON DELETE SET NULL;

-- Existing activation_count was historically increment-only. Recalculate it to
-- reflect active activation rows before Admin lifecycle operations start.
UPDATE license_keys lk
SET activation_count = (
    SELECT COUNT(*)
    FROM license_activations la
    WHERE la.license_key_id = lk.id
      AND la.status = 'ACTIVE'
);

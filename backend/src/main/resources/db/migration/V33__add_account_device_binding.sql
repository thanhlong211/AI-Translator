ALTER TABLE users
    ADD COLUMN bound_device_id VARCHAR(100) NULL AFTER updated_at,
    ADD COLUMN bound_device_name VARCHAR(190) NULL AFTER bound_device_id,
    ADD COLUMN device_bound_at TIMESTAMP(6) NULL AFTER bound_device_name,
    ADD UNIQUE KEY uk_users_bound_device_id (bound_device_id);

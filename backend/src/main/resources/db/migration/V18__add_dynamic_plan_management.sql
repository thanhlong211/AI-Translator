-- Batch 14.6: dynamic plan & entitlement management.
-- V12 already introduced plan_catalog / plan_features / plan_limits.
-- This migration adds administrator-facing metadata without changing existing entitlements.

ALTER TABLE plan_catalog
    ADD COLUMN description VARCHAR(500) NOT NULL DEFAULT '' AFTER display_name;

UPDATE plan_catalog
SET description = CASE code
    WHEN 'FREE' THEN 'Gói mặc định cho người dùng chưa có subscription hoặc override.'
    WHEN 'PRO' THEN 'Gói trả phí tiêu chuẩn cho Study và Document Reader.'
    WHEN 'MANGA_PLUS' THEN 'Gói cao cấp cho workflow Manga và giới hạn sử dụng lớn hơn.'
    ELSE description
END
WHERE description = '';

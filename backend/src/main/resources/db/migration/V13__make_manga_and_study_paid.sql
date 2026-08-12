-- Batch 12.0.2: paid feature gate adjustment.
-- FREE keeps Quick Translate, but Study and Manga workflows require PRO or higher.
-- This is a new migration instead of editing V12 so existing Flyway checksums remain valid.

UPDATE plan_features
SET enabled = FALSE
WHERE plan_code = 'FREE'
  AND feature_key IN (
      'studyMode',
      'mangaPanel',
      'mangaSession'
  );

UPDATE plan_limits
SET limit_value = 0
WHERE plan_code = 'FREE'
  AND limit_key = 'mangaPagesPerDay';

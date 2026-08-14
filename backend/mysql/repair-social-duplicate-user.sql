-- AI Translator 14.10.1.1 hotfix: repair one accidental social-login duplicate.
-- REVIEW THE IDS BEFORE RUNNING. Defaults below match the reported case: keep 7, remove 8.
-- The duplicate row must be the social-only row (password_hash IS NULL).

SET @KEEP_USER_ID = 7;
SET @DROP_USER_ID = 8;

START TRANSACTION;

SELECT id, email, HEX(email) AS email_hex, password_hash, status, role, created_at
FROM users
WHERE id IN (@KEEP_USER_ID, @DROP_USER_ID)
FOR UPDATE;

SET @SOCIAL_EMAIL = (
    SELECT email
    FROM users
    WHERE id = @DROP_USER_ID
      AND password_hash IS NULL
    LIMIT 1
);

-- If @SOCIAL_EMAIL is NULL, STOP and ROLLBACK: the selected duplicate is not social-only.
SELECT @SOCIAL_EMAIL AS email_that_will_be_kept;

-- Removing the accidental social-only user also removes its temporary OAuth identity/session
-- through the existing foreign-key cascade rules. The next Google login will link to KEEP_USER_ID.
DELETE FROM users
WHERE id = @DROP_USER_ID
  AND password_hash IS NULL
  AND @SOCIAL_EMAIL IS NOT NULL;

-- Canonicalize the original user's visible email from the verified social provider value.
UPDATE users
SET email = LOWER(TRIM(@SOCIAL_EMAIL)),
    updated_at = CURRENT_TIMESTAMP(6)
WHERE id = @KEEP_USER_ID
  AND @SOCIAL_EMAIL IS NOT NULL;

COMMIT;

-- Verify the duplicate is gone.
SELECT id, email, HEX(email) AS email_hex, password_hash, status, role, created_at
FROM users
WHERE id IN (@KEEP_USER_ID, @DROP_USER_ID);

-- Restore the intended database invariant if the original unique index is missing.
SET @EMAIL_INDEX_EXISTS = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND index_name = 'uk_users_email'
);

SET @ADD_EMAIL_INDEX_SQL = IF(
    @EMAIL_INDEX_EXISTS = 0,
    'ALTER TABLE users ADD UNIQUE KEY uk_users_email (email)',
    'SELECT ''uk_users_email already exists'' AS info'
);
PREPARE stmt FROM @ADD_EMAIL_INDEX_SQL;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SHOW INDEX FROM users WHERE Key_name = 'uk_users_email';

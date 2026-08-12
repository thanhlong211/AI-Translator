-- Batch 06.1: personal exact-match translation memory.
-- This is user-private product memory, separate from training consent.
-- A correction enters this table only after the user explicitly presses "Save correction".

CREATE TABLE translation_memory (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    profile_id BIGINT NOT NULL,
    source_hash CHAR(64) NOT NULL,
    source_text TEXT NOT NULL,
    corrected_translation TEXT NOT NULL,
    source_language VARCHAR(16) NOT NULL DEFAULT 'AUTO',
    target_language VARCHAR(16) NOT NULL DEFAULT 'VI',
    latest_feedback_id BIGINT NULL,
    hit_count BIGINT NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_translation_memory_exact (
        user_id,
        profile_id,
        source_language,
        target_language,
        source_hash
    ),
    INDEX idx_translation_memory_user_updated (user_id, updated_at)
);


-- Backfill corrections already saved by Batch 06 when profile_id is known.
-- Highest feedback id wins for the same exact key.
INSERT INTO translation_memory (
    user_id,
    profile_id,
    source_hash,
    source_text,
    corrected_translation,
    source_language,
    target_language,
    latest_feedback_id,
    hit_count,
    created_at,
    updated_at
)
SELECT
    tf.user_id,
    tf.profile_id,
    SHA2(REPLACE(TRIM(tf.source_text), CHAR(13), ''), 256),
    REPLACE(TRIM(tf.source_text), CHAR(13), ''),
    TRIM(tf.corrected_translation),
    tf.source_language,
    tf.target_language,
    tf.id,
    0,
    tf.created_at,
    tf.created_at
FROM translation_feedback tf
INNER JOIN (
    SELECT
        user_id,
        profile_id,
        source_language,
        target_language,
        SHA2(REPLACE(TRIM(source_text), CHAR(13), ''), 256) AS source_hash,
        MAX(id) AS latest_id
    FROM translation_feedback
    WHERE profile_id IS NOT NULL
    GROUP BY
        user_id,
        profile_id,
        source_language,
        target_language,
        SHA2(REPLACE(TRIM(source_text), CHAR(13), ''), 256)
) latest
    ON latest.latest_id = tf.id
ON DUPLICATE KEY UPDATE
    source_text = VALUES(source_text),
    corrected_translation = VALUES(corrected_translation),
    latest_feedback_id = VALUES(latest_feedback_id),
    updated_at = VALUES(updated_at);

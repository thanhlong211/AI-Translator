-- Batch 04: language-aware profile glossary.
-- Existing glossary rows keep current behavior by becoming AUTO -> VI.

ALTER TABLE profile_glossary
    ADD COLUMN source_language VARCHAR(16) NOT NULL DEFAULT 'AUTO' AFTER profile_id,
    ADD COLUMN target_language VARCHAR(16) NOT NULL DEFAULT 'VI' AFTER source_language;

CREATE INDEX idx_profile_glossary_language_pair
    ON profile_glossary (
        profile_id,
        source_language,
        target_language
    );

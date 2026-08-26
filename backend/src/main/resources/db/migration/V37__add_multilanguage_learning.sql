ALTER TABLE user_vocabulary
    ADD COLUMN language VARCHAR(8) NOT NULL DEFAULT 'JA' AFTER user_id,
    ADD COLUMN lemma VARCHAR(190) NULL AFTER dictionary_form,
    ADD COLUMN ipa VARCHAR(255) NULL AFTER romaji,
    ADD COLUMN cefr_level VARCHAR(20) NULL AFTER jlpt_level,
    ADD COLUMN example VARCHAR(1000) NULL AFTER cefr_level;

ALTER TABLE user_vocabulary
    DROP INDEX uk_user_vocabulary_term,
    ADD UNIQUE KEY uk_user_vocabulary_language_term (
        user_id,
        language,
        dictionary_form,
        reading
    ),
    ADD KEY idx_user_vocabulary_user_language_last_seen (
        user_id,
        language,
        last_seen_at
    );

ALTER TABLE user_grammar
    ADD COLUMN language VARCHAR(8) NOT NULL DEFAULT 'JA' AFTER user_id,
    ADD COLUMN cefr_level VARCHAR(20) NULL AFTER jlpt_level,
    ADD COLUMN matched_text VARCHAR(500) NULL AFTER meaning,
    ADD COLUMN example VARCHAR(1000) NULL AFTER explanation;

ALTER TABLE user_grammar
    DROP INDEX uk_user_grammar_pattern,
    ADD UNIQUE KEY uk_user_grammar_language_pattern (
        user_id,
        language,
        pattern
    ),
    ADD KEY idx_user_grammar_user_language_last_seen (
        user_id,
        language,
        last_seen_at
    );

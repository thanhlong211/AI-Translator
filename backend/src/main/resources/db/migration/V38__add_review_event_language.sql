ALTER TABLE review_events
    ADD COLUMN language VARCHAR(8) NULL AFTER user_id;

UPDATE review_events AS review_event
JOIN user_vocabulary AS vocabulary
    ON review_event.item_type = 'VOCABULARY'
    AND review_event.item_id = vocabulary.id
SET review_event.language = vocabulary.language
WHERE review_event.language IS NULL;

UPDATE review_events AS review_event
JOIN user_grammar AS grammar_item
    ON review_event.item_type = 'GRAMMAR'
    AND review_event.item_id = grammar_item.id
SET review_event.language = grammar_item.language
WHERE review_event.language IS NULL;

UPDATE review_events
SET language = 'JA'
WHERE language IS NULL;

ALTER TABLE review_events
    MODIFY COLUMN language VARCHAR(8)
        NOT NULL DEFAULT 'JA',
    ADD KEY idx_review_events_user_language_time (
        user_id,
        language,
        reviewed_at
    );

ALTER TABLE user_vocabulary
    ADD COLUMN due_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ADD COLUMN interval_days INT NOT NULL DEFAULT 0,
    ADD COLUMN ease_factor DOUBLE NOT NULL DEFAULT 2.5,
    ADD COLUMN repetitions INT NOT NULL DEFAULT 0,
    ADD COLUMN lapse_count INT NOT NULL DEFAULT 0,
    ADD COLUMN last_reviewed_at TIMESTAMP(6) NULL,
    ADD KEY idx_user_vocabulary_review_due (user_id, due_at);

ALTER TABLE user_grammar
    ADD COLUMN due_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ADD COLUMN interval_days INT NOT NULL DEFAULT 0,
    ADD COLUMN ease_factor DOUBLE NOT NULL DEFAULT 2.5,
    ADD COLUMN repetitions INT NOT NULL DEFAULT 0,
    ADD COLUMN lapse_count INT NOT NULL DEFAULT 0,
    ADD COLUMN last_reviewed_at TIMESTAMP(6) NULL,
    ADD KEY idx_user_grammar_review_due (user_id, due_at);

CREATE TABLE review_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,

    item_type VARCHAR(20) NOT NULL,
    item_id BIGINT NOT NULL,
    grade VARCHAR(20) NOT NULL,

    previous_interval_days INT NOT NULL,
    next_interval_days INT NOT NULL,
    previous_ease_factor DOUBLE NOT NULL,
    next_ease_factor DOUBLE NOT NULL,

    reviewed_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    KEY idx_review_events_user_time (
        user_id,
        reviewed_at
    ),

    KEY idx_review_events_item (
        user_id,
        item_type,
        item_id,
        reviewed_at
    ),

    CONSTRAINT fk_review_events_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

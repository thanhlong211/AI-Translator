ALTER TABLE user_vocabulary
    ADD COLUMN review_correct_count INT NOT NULL DEFAULT 0,
    ADD COLUMN review_wrong_count INT NOT NULL DEFAULT 0,
    ADD COLUMN correct_streak INT NOT NULL DEFAULT 0;

ALTER TABLE user_grammar
    ADD COLUMN review_correct_count INT NOT NULL DEFAULT 0,
    ADD COLUMN review_wrong_count INT NOT NULL DEFAULT 0,
    ADD COLUMN correct_streak INT NOT NULL DEFAULT 0;

ALTER TABLE review_events
    ADD COLUMN question_type VARCHAR(30) NULL,
    ADD COLUMN is_correct TINYINT(1) NULL,
    ADD COLUMN response_time_ms INT NULL;

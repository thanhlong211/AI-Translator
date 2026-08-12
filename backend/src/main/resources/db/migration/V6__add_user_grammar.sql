CREATE TABLE user_grammar (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,

    pattern VARCHAR(255) NOT NULL,
    jlpt_level VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    meaning VARCHAR(500) NULL,
    explanation TEXT NULL,

    learning_status VARCHAR(20) NOT NULL DEFAULT 'NEW',
    favorite TINYINT(1) NOT NULL DEFAULT 0,
    encounter_count INT NOT NULL DEFAULT 1,
    personal_note TEXT NULL,

    first_seen_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_seen_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),

    UNIQUE KEY uk_user_grammar_pattern (
        user_id,
        pattern
    ),

    KEY idx_user_grammar_user_status (
        user_id,
        learning_status
    ),

    KEY idx_user_grammar_user_favorite (
        user_id,
        favorite
    ),

    KEY idx_user_grammar_user_last_seen (
        user_id,
        last_seen_at
    ),

    CONSTRAINT fk_user_grammar_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

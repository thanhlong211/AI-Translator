CREATE TABLE translation_profiles (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(80) NOT NULL,
    style VARCHAR(30) NOT NULL,
    context_lines INT NOT NULL DEFAULT 5,
    keep_honorifics TINYINT(1) NOT NULL DEFAULT 1,
    custom_instruction TEXT NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uk_translation_profiles_user_name (user_id, name),
    KEY idx_translation_profiles_user_default (user_id, is_default),

    CONSTRAINT fk_translation_profiles_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


CREATE TABLE profile_characters (
    id BIGINT NOT NULL AUTO_INCREMENT,
    profile_id BIGINT NOT NULL,
    character_name VARCHAR(100) NOT NULL,
    aliases_text TEXT NULL,
    rule_text VARCHAR(1000) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    KEY idx_profile_characters_profile (profile_id),

    CONSTRAINT fk_profile_characters_profile
        FOREIGN KEY (profile_id)
        REFERENCES translation_profiles (id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


CREATE TABLE profile_glossary (
    id BIGINT NOT NULL AUTO_INCREMENT,
    profile_id BIGINT NOT NULL,
    source_term VARCHAR(120) NOT NULL,
    target_term VARCHAR(160) NOT NULL,
    note VARCHAR(500) NULL,
    sort_order INT NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY uk_profile_glossary_source (profile_id, source_term),
    KEY idx_profile_glossary_profile (profile_id),

    CONSTRAINT fk_profile_glossary_profile
        FOREIGN KEY (profile_id)
        REFERENCES translation_profiles (id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

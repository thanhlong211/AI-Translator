-- Run this once as a MySQL administrator.
-- Replace CHANGE_ME_WITH_A_STRONG_PASSWORD before execution.

CREATE DATABASE IF NOT EXISTS ai_translator
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'ai_translator'@'localhost'
    IDENTIFIED BY 'CHANGE_ME_WITH_A_STRONG_PASSWORD';

ALTER USER 'ai_translator'@'localhost'
    IDENTIFIED BY 'CHANGE_ME_WITH_A_STRONG_PASSWORD';

GRANT ALL PRIVILEGES
    ON ai_translator.*
    TO 'ai_translator'@'localhost';

FLUSH PRIVILEGES;

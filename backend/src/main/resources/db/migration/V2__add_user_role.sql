ALTER TABLE users
    ADD COLUMN role VARCHAR(30) NOT NULL DEFAULT 'USER'
    AFTER status;

CREATE INDEX idx_users_status ON users (status);

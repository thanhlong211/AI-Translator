-- Run only after replacing the placeholder with your own existing account email.
USE ai_translator;

UPDATE users
SET role = 'SUPER_ADMIN',
    updated_at = CURRENT_TIMESTAMP(6)
WHERE email = 'whitelie211@gmail.com';

SELECT id, email, status, role
FROM users
WHERE role IN ('ADMIN', 'SUPER_ADMIN')
ORDER BY id;

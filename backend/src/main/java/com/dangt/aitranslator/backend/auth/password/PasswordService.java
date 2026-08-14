package com.dangt.aitranslator.backend.auth.password;

import com.dangt.aitranslator.backend.user.UserAccount;
import com.dangt.aitranslator.backend.common.EmailNormalizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

@Service
public class PasswordService {

    private static final Logger log = LoggerFactory.getLogger(PasswordService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String GENERIC_FORGOT_MESSAGE =
            "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.";

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetDeliveryService deliveryService;
    private final int ttlMinutes;
    private final int requestCooldownSeconds;

    public PasswordService(
            JdbcTemplate jdbcTemplate,
            PasswordEncoder passwordEncoder,
            PasswordResetDeliveryService deliveryService,
            @Value("${app.password-reset.ttl-minutes:30}") int ttlMinutes,
            @Value("${app.password-reset.request-cooldown-seconds:60}") int requestCooldownSeconds
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
        this.deliveryService = deliveryService;
        this.ttlMinutes = Math.max(5, Math.min(ttlMinutes, 120));
        this.requestCooldownSeconds = Math.max(15, Math.min(requestCooldownSeconds, 600));
    }

    @Transactional
    public ForgotPasswordResponse requestReset(String requestedEmail, String requestedIp) {
        String email = EmailNormalizer.normalize(requestedEmail);

        jdbcTemplate.update(
                """
                DELETE FROM password_reset_tokens
                WHERE expires_at < TIMESTAMPADD(DAY, -7, CURRENT_TIMESTAMP(6))
                   OR (used_at IS NOT NULL
                       AND used_at < TIMESTAMPADD(DAY, -7, CURRENT_TIMESTAMP(6)))
                """
        );

        List<UserRow> users = jdbcTemplate.query(
                """
                SELECT id, email, status, password_hash
                FROM users
                WHERE email = ?
                LIMIT 1
                """,
                (rs, rowNum) -> new UserRow(
                        rs.getLong("id"),
                        rs.getString("email"),
                        rs.getString("status"),
                        rs.getString("password_hash")
                ),
                email
        );

        if (users.isEmpty() || !"ACTIVE".equals(users.getFirst().status())) {
            return genericForgotResponse();
        }

        UserRow user = users.getFirst();
        Integer recentCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM password_reset_tokens
                WHERE user_id = ?
                  AND used_at IS NULL
                  AND expires_at > CURRENT_TIMESTAMP(6)
                  AND created_at >= TIMESTAMPADD(SECOND, ?, CURRENT_TIMESTAMP(6))
                """,
                Integer.class,
                user.id(),
                -requestCooldownSeconds
        );

        if (recentCount != null && recentCount > 0) {
            return genericForgotResponse();
        }

        String rawToken = newResetToken();
        String tokenHash = sha256Hex(rawToken);

        jdbcTemplate.update(
                """
                UPDATE password_reset_tokens
                SET used_at = CURRENT_TIMESTAMP(6)
                WHERE user_id = ?
                  AND used_at IS NULL
                """,
                user.id()
        );

        jdbcTemplate.update(
                """
                INSERT INTO password_reset_tokens (
                    user_id,
                    token_hash,
                    expires_at,
                    requested_ip,
                    created_at
                ) VALUES (
                    ?,
                    ?,
                    TIMESTAMPADD(MINUTE, ?, CURRENT_TIMESTAMP(6)),
                    ?,
                    CURRENT_TIMESTAMP(6)
                )
                """,
                user.id(),
                tokenHash,
                ttlMinutes,
                cleanIp(requestedIp)
        );

        try {
            deliveryService.deliver(user.email(), rawToken);
        } catch (RuntimeException ex) {
            jdbcTemplate.update(
                    """
                    UPDATE password_reset_tokens
                    SET used_at = CURRENT_TIMESTAMP(6)
                    WHERE token_hash = ?
                      AND used_at IS NULL
                    """,
                    tokenHash
            );
            log.error("Password reset delivery failed for userId={}", user.id(), ex);
            return genericForgotResponse();
        }

        return genericForgotResponse();
    }

    @Transactional
    public PasswordActionResponse resetPassword(ResetPasswordRequest request) {
        String rawToken = cleanToken(request.token());
        String tokenHash = sha256Hex(rawToken);
        String newPassword = requirePassword(request.newPassword());

        List<ResetTokenRow> tokens = jdbcTemplate.query(
                """
                SELECT t.id, t.user_id, u.password_hash
                FROM password_reset_tokens t
                INNER JOIN users u ON u.id = t.user_id
                WHERE t.token_hash = ?
                  AND t.used_at IS NULL
                  AND t.expires_at > CURRENT_TIMESTAMP(6)
                  AND u.status = 'ACTIVE'
                LIMIT 1
                FOR UPDATE
                """,
                (rs, rowNum) -> new ResetTokenRow(
                        rs.getLong("id"),
                        rs.getLong("user_id"),
                        rs.getString("password_hash")
                ),
                tokenHash
        );

        if (tokens.isEmpty()) {
            throw new IllegalArgumentException("Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
        }

        ResetTokenRow token = tokens.getFirst();
        if (token.currentPasswordHash() != null
                && passwordEncoder.matches(newPassword, token.currentPasswordHash())) {
            throw new IllegalArgumentException("Mật khẩu mới phải khác mật khẩu hiện tại.");
        }

        String newHash = passwordEncoder.encode(newPassword);
        jdbcTemplate.update(
                """
                UPDATE users
                SET password_hash = ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                  AND status = 'ACTIVE'
                """,
                newHash,
                token.userId()
        );

        markResetTokensUsed(token.userId());
        revokeSessions(token.userId());

        return new PasswordActionResponse(
                true,
                true,
                "Mật khẩu đã được đặt lại. Hãy đăng nhập lại trên các thiết bị."
        );
    }

    @Transactional
    public PasswordActionResponse changePassword(
            UserAccount user,
            ChangePasswordRequest request
    ) {
        String newPassword = requirePassword(request.newPassword());

        List<String> hashes = jdbcTemplate.query(
                """
                SELECT password_hash
                FROM users
                WHERE id = ?
                  AND status = 'ACTIVE'
                LIMIT 1
                FOR UPDATE
                """,
                (rs, rowNum) -> rs.getString("password_hash"),
                user.getId()
        );

        if (hashes.isEmpty()) {
            throw new IllegalArgumentException("Tài khoản không còn hoạt động.");
        }

        String currentHash = hashes.getFirst();
        if (currentHash != null && !currentHash.isBlank()) {
            String currentPassword = String.valueOf(request.currentPassword() == null ? "" : request.currentPassword());
            if (!passwordEncoder.matches(currentPassword, currentHash)) {
                throw new IllegalArgumentException("Mật khẩu hiện tại không đúng.");
            }
            if (passwordEncoder.matches(newPassword, currentHash)) {
                throw new IllegalArgumentException("Mật khẩu mới phải khác mật khẩu hiện tại.");
            }
        }

        jdbcTemplate.update(
                """
                UPDATE users
                SET password_hash = ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                passwordEncoder.encode(newPassword),
                user.getId()
        );

        markResetTokensUsed(user.getId());
        revokeSessions(user.getId());

        return new PasswordActionResponse(
                true,
                true,
                currentHash == null || currentHash.isBlank()
                        ? "Đã tạo mật khẩu cho tài khoản. Hãy đăng nhập lại."
                        : "Đã đổi mật khẩu. Hãy đăng nhập lại."
        );
    }

    private ForgotPasswordResponse genericForgotResponse() {
        return new ForgotPasswordResponse(
                true,
                GENERIC_FORGOT_MESSAGE
        );
    }

    private void markResetTokensUsed(long userId) {
        jdbcTemplate.update(
                """
                UPDATE password_reset_tokens
                SET used_at = CURRENT_TIMESTAMP(6)
                WHERE user_id = ?
                  AND used_at IS NULL
                """,
                userId
        );
    }

    private void revokeSessions(long userId) {
        jdbcTemplate.update(
                """
                UPDATE auth_sessions
                SET revoked_at = CURRENT_TIMESTAMP(6)
                WHERE user_id = ?
                  AND revoked_at IS NULL
                """,
                userId
        );
    }

    private String cleanToken(String token) {
        String value = String.valueOf(token == null ? "" : token).trim();
        if (value.length() < 32 || value.length() > 256) {
            throw new IllegalArgumentException("Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
        }
        return value;
    }

    private String requirePassword(String password) {
        String value = String.valueOf(password == null ? "" : password);
        if (value.length() < 8 || value.length() > 100) {
            throw new IllegalArgumentException("Mật khẩu phải dài từ 8 đến 100 ký tự.");
        }
        return value;
    }

    private String cleanIp(String ip) {
        if (ip == null || ip.isBlank()) {
            return null;
        }
        String value = ip.trim();
        return value.length() <= 64 ? value : value.substring(0, 64);
    }

    private String newResetToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể tạo password reset token.", ex);
        }
    }

    private record UserRow(
            long id,
            String email,
            String status,
            String passwordHash
    ) {
    }

    private record ResetTokenRow(
            long id,
            long userId,
            String currentPasswordHash
    ) {
    }
}

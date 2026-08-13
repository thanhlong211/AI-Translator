package com.dangt.aitranslator.backend.social;

import com.dangt.aitranslator.backend.auth.AuthResponse;
import com.dangt.aitranslator.backend.auth.AuthService;
import com.dangt.aitranslator.backend.common.ConflictException;
import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.common.UnauthorizedException;
import com.dangt.aitranslator.backend.user.UserAccount;
import com.dangt.aitranslator.backend.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class SocialAuthService {

    private static final String MODE_LOGIN = "LOGIN";
    private static final String MODE_LINK = "LINK";

    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final SocialOAuthClient oauthClient;
    private final SecureRandom secureRandom = new SecureRandom();
    private final Duration attemptLifetime;

    public SocialAuthService(
            JdbcTemplate jdbcTemplate,
            UserRepository userRepository,
            AuthService authService,
            SocialOAuthClient oauthClient,
            @Value("${app.auth.social.attempt-minutes:5}") long attemptMinutes
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.userRepository = userRepository;
        this.authService = authService;
        this.oauthClient = oauthClient;
        this.attemptLifetime = Duration.ofMinutes(Math.max(2, Math.min(15, attemptMinutes)));
    }

    public List<SocialProviderStatus> providers() {
        return oauthClient.providerStatuses();
    }

    public SocialAuthStartResponse startLogin(
            SocialAuthProvider provider,
            SocialAuthStartRequest request
    ) {
        return startAttempt(
                provider,
                MODE_LOGIN,
                null,
                clean(request.deviceId()),
                clean(request.deviceName())
        );
    }

    public SocialAuthStartResponse startLink(
            SocialAuthProvider provider,
            UserAccount currentUser
    ) {
        return startAttempt(
                provider,
                MODE_LINK,
                currentUser.getId(),
                "",
                ""
        );
    }

    private SocialAuthStartResponse startAttempt(
            SocialAuthProvider provider,
            String mode,
            Long requestedByUserId,
            String deviceId,
            String deviceName
    ) {
        SocialProviderStatus providerStatus = oauthClient.status(provider);
        if (!providerStatus.available()) {
            throw new ForbiddenException(
                    provider.displayName() + " Login chưa được cấu hình trên backend."
            );
        }

        if (MODE_LINK.equals(mode) && requestedByUserId == null) {
            throw new UnauthorizedException("Cần đăng nhập trước khi liên kết tài khoản.");
        }

        jdbcTemplate.update(
                "DELETE FROM social_auth_attempts WHERE expires_at < ?",
                Timestamp.from(Instant.now().minus(Duration.ofDays(1)))
        );

        String attemptId = UUID.randomUUID().toString();
        String pollSecret = randomToken(32);
        String stateSecret = randomToken(32);
        String state = attemptId + "." + stateSecret;
        Instant now = Instant.now();
        Instant expiresAt = now.plus(attemptLifetime);

        jdbcTemplate.update(
                """
                INSERT INTO social_auth_attempts (
                    attempt_id,
                    poll_secret_hash,
                    state_secret_hash,
                    provider,
                    mode,
                    requested_by_user_id,
                    resolved_user_id,
                    device_id,
                    device_name,
                    status,
                    created_at,
                    expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 'PENDING', ?, ?)
                """,
                attemptId,
                hashHex(pollSecret),
                hashHex(stateSecret),
                provider.name(),
                mode,
                requestedByUserId,
                normalizeDeviceId(deviceId),
                normalizeDeviceName(deviceName),
                Timestamp.from(now),
                Timestamp.from(expiresAt)
        );

        return new SocialAuthStartResponse(
                true,
                attemptId,
                pollSecret,
                provider.name(),
                oauthClient.authorizationUrl(provider, state),
                expiresAt,
                1200
        );
    }

    /**
     * Callback is called by Google/Facebook in the user's system browser.
     * Provider access tokens are used only in memory while resolving identity;
     * they are never persisted to AI Translator's database.
     */
    public CallbackResult handleCallback(
            SocialAuthProvider provider,
            String state,
            String code,
            String oauthError
    ) {
        StateParts stateParts = verifyState(provider, state);

        if (!clean(oauthError).isBlank()) {
            failAttempt(
                    stateParts.attemptId(),
                    "PROVIDER_DENIED",
                    "Người dùng đã hủy hoặc nhà cung cấp từ chối yêu cầu đăng nhập."
            );
            return new CallbackResult(false, "Đăng nhập đã bị hủy.");
        }

        if (clean(code).isBlank()) {
            failAttempt(
                    stateParts.attemptId(),
                    "MISSING_CODE",
                    "OAuth callback không có authorization code."
            );
            return new CallbackResult(false, "Không nhận được mã xác thực OAuth.");
        }

        SocialAttempt attempt = requireAttempt(stateParts.attemptId(), false);

        try {
            SocialProviderProfile profile = oauthClient.exchangeCode(
                    provider,
                    code
            );

            Long resolvedUserId;
            if (MODE_LINK.equals(attempt.mode())) {
                resolvedUserId = linkIdentityToUser(
                        provider,
                        profile,
                        attempt.requestedByUserId()
                );
            } else {
                resolvedUserId = resolveLoginUser(provider, profile);
            }

            jdbcTemplate.update(
                    """
                    UPDATE social_auth_attempts
                    SET resolved_user_id = ?,
                        status = 'SUCCESS',
                        error_code = NULL,
                        error_message = NULL,
                        completed_at = ?
                    WHERE attempt_id = ? AND status = 'PENDING'
                    """,
                    resolvedUserId,
                    Timestamp.from(Instant.now()),
                    attempt.attemptId()
            );

            return new CallbackResult(
                    true,
                    MODE_LINK.equals(attempt.mode())
                            ? "Tài khoản đã được liên kết. Bạn có thể quay lại AI Translator."
                            : "Đăng nhập thành công. Bạn có thể quay lại AI Translator."
            );
        } catch (Exception ex) {
            String errorCode = ex instanceof ConflictException
                    ? "ACCOUNT_LINK_REQUIRED"
                    : "OAUTH_VERIFICATION_FAILED";
            String message = clean(ex.getMessage());
            if (message.isBlank()) {
                message = "Không xác minh được tài khoản OAuth.";
            }

            failAttempt(attempt.attemptId(), errorCode, message);
            return new CallbackResult(false, message);
        }
    }

    @Transactional
    public SocialAuthPollResponse poll(
            String attemptId,
            SocialAuthPollRequest request
    ) {
        SocialAttempt attempt = requireAttemptForUpdate(attemptId);
        verifyPollSecret(attempt, request.pollSecret());

        Instant now = Instant.now();
        if (now.isAfter(attempt.expiresAt()) && "PENDING".equals(attempt.status())) {
            jdbcTemplate.update(
                    "UPDATE social_auth_attempts SET status = 'EXPIRED', completed_at = ? WHERE attempt_id = ?",
                    Timestamp.from(now),
                    attempt.attemptId()
            );
            return new SocialAuthPollResponse(
                    false,
                    "EXPIRED",
                    attempt.provider(),
                    "Phiên đăng nhập đã hết hạn. Vui lòng thử lại.",
                    "EXPIRED",
                    null,
                    null
            );
        }

        if ("PENDING".equals(attempt.status())) {
            return SocialAuthPollResponse.pending(attempt.provider());
        }

        if ("ERROR".equals(attempt.status()) || "EXPIRED".equals(attempt.status())) {
            return new SocialAuthPollResponse(
                    false,
                    attempt.status(),
                    attempt.provider(),
                    attempt.errorMessage(),
                    attempt.errorCode(),
                    null,
                    null
            );
        }

        if (!"SUCCESS".equals(attempt.status())) {
            return new SocialAuthPollResponse(
                    false,
                    attempt.status(),
                    attempt.provider(),
                    "Phiên OAuth không còn khả dụng.",
                    "INVALID_ATTEMPT_STATE",
                    null,
                    null
            );
        }

        if (MODE_LINK.equals(attempt.mode())) {
            SocialIdentityResponse identity = findIdentityForUserProvider(
                    attempt.resolvedUserId(),
                    attempt.provider()
            );

            return new SocialAuthPollResponse(
                    true,
                    "LINKED",
                    attempt.provider(),
                    "Liên kết tài khoản thành công.",
                    null,
                    null,
                    identity
            );
        }

        if (attempt.consumedAt() != null) {
            return new SocialAuthPollResponse(
                    false,
                    "CONSUMED",
                    attempt.provider(),
                    "Phiên đăng nhập này đã được Desktop nhận trước đó.",
                    "ALREADY_CONSUMED",
                    null,
                    null
            );
        }

        UserAccount user = userRepository.findById(attempt.resolvedUserId())
                .orElseThrow(() -> new UnauthorizedException("Không tìm thấy tài khoản OAuth."));

        AuthResponse auth = authService.createSessionForUser(
                user,
                attempt.deviceId(),
                attempt.deviceName()
        );

        jdbcTemplate.update(
                "UPDATE social_auth_attempts SET consumed_at = ? WHERE attempt_id = ? AND consumed_at IS NULL",
                Timestamp.from(now),
                attempt.attemptId()
        );

        return new SocialAuthPollResponse(
                true,
                "SUCCESS",
                attempt.provider(),
                "Đăng nhập thành công.",
                null,
                auth,
                findIdentityForUserProvider(user.getId(), attempt.provider())
        );
    }

    public List<SocialIdentityResponse> listIdentities(Long userId) {
        return jdbcTemplate.queryForList(
                        """
                        SELECT id, provider, email_at_link, display_name, avatar_url,
                               created_at, last_login_at
                        FROM user_identities
                        WHERE user_id = ?
                        ORDER BY provider
                        """,
                        userId
                )
                .stream()
                .map(this::mapIdentity)
                .toList();
    }

    private Long resolveLoginUser(
            SocialAuthProvider provider,
            SocialProviderProfile profile
    ) {
        Long existingIdentityUserId = findIdentityUserId(provider.name(), profile.subject());
        if (existingIdentityUserId != null) {
            touchIdentity(existingIdentityUserId, provider, profile);
            return existingIdentityUserId;
        }

        String email = normalizeEmail(profile.email());
        if (email.isBlank()) {
            throw new ConflictException(
                    provider.displayName() + " không cung cấp email. Hãy dùng email/password hoặc liên kết provider từ tài khoản đã đăng nhập."
            );
        }

        UserAccount user = userRepository.findByEmail(email).orElse(null);

        if (user != null) {
            if (provider == SocialAuthProvider.GOOGLE && profile.emailVerified()) {
                insertOrTouchIdentity(user.getId(), provider, profile);
                return user.getId();
            }

            throw new ConflictException(
                    "Email này đã có tài khoản AI Translator. Hãy đăng nhập tài khoản hiện tại rồi liên kết "
                            + provider.displayName() + " trong Settings."
            );
        }

        try {
            user = userRepository.saveAndFlush(new UserAccount(email, null));
        } catch (DataIntegrityViolationException ex) {
            user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new ConflictException("Không tạo được tài khoản OAuth."));
        }

        insertOrTouchIdentity(user.getId(), provider, profile);
        return user.getId();
    }

    private Long linkIdentityToUser(
            SocialAuthProvider provider,
            SocialProviderProfile profile,
            Long requestedUserId
    ) {
        if (requestedUserId == null) {
            throw new UnauthorizedException("Không xác định được tài khoản cần liên kết.");
        }

        UserAccount user = userRepository.findById(requestedUserId)
                .orElseThrow(() -> new UnauthorizedException("Không tìm thấy tài khoản cần liên kết."));

        if (!"ACTIVE".equals(user.getStatus())) {
            throw new ForbiddenException("Tài khoản hiện không hoạt động.");
        }

        Long owner = findIdentityUserId(provider.name(), profile.subject());
        if (owner != null && !owner.equals(requestedUserId)) {
            throw new ConflictException(
                    provider.displayName() + " này đã được liên kết với một tài khoản AI Translator khác."
            );
        }

        insertOrTouchIdentity(requestedUserId, provider, profile);
        return requestedUserId;
    }

    private void insertOrTouchIdentity(
            Long userId,
            SocialAuthProvider provider,
            SocialProviderProfile profile
    ) {
        Long subjectOwner = findIdentityUserId(provider.name(), profile.subject());
        if (subjectOwner != null && !subjectOwner.equals(userId)) {
            throw new ConflictException("Identity OAuth đã thuộc tài khoản khác.");
        }

        List<Map<String, Object>> existing = jdbcTemplate.queryForList(
                "SELECT id, provider_subject FROM user_identities WHERE user_id = ? AND provider = ?",
                userId,
                provider.name()
        );

        Instant now = Instant.now();
        String email = normalizeEmail(profile.email());

        if (!existing.isEmpty()) {
            String oldSubject = String.valueOf(existing.get(0).get("provider_subject"));
            if (!oldSubject.equals(profile.subject())) {
                throw new ConflictException(
                        "Tài khoản đã liên kết một " + provider.displayName() + " identity khác."
                );
            }

            jdbcTemplate.update(
                    """
                    UPDATE user_identities
                    SET email_at_link = ?, display_name = ?, avatar_url = ?, last_login_at = ?
                    WHERE user_id = ? AND provider = ?
                    """,
                    blankToNull(email),
                    blankToNull(profile.displayName()),
                    blankToNull(profile.avatarUrl()),
                    Timestamp.from(now),
                    userId,
                    provider.name()
            );
            return;
        }

        try {
            jdbcTemplate.update(
                    """
                    INSERT INTO user_identities (
                        user_id, provider, provider_subject, email_at_link,
                        display_name, avatar_url, created_at, last_login_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    userId,
                    provider.name(),
                    profile.subject(),
                    blankToNull(email),
                    blankToNull(profile.displayName()),
                    blankToNull(profile.avatarUrl()),
                    Timestamp.from(now),
                    Timestamp.from(now)
            );
        } catch (DataIntegrityViolationException ex) {
            Long owner = findIdentityUserId(provider.name(), profile.subject());
            if (owner != null && owner.equals(userId)) {
                touchIdentity(userId, provider, profile);
                return;
            }
            throw new ConflictException("Không thể liên kết identity OAuth này.");
        }
    }

    private void touchIdentity(
            Long userId,
            SocialAuthProvider provider,
            SocialProviderProfile profile
    ) {
        jdbcTemplate.update(
                """
                UPDATE user_identities
                SET email_at_link = ?, display_name = ?, avatar_url = ?, last_login_at = ?
                WHERE user_id = ? AND provider = ? AND provider_subject = ?
                """,
                blankToNull(normalizeEmail(profile.email())),
                blankToNull(profile.displayName()),
                blankToNull(profile.avatarUrl()),
                Timestamp.from(Instant.now()),
                userId,
                provider.name(),
                profile.subject()
        );
    }

    private Long findIdentityUserId(String provider, String providerSubject) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT user_id FROM user_identities WHERE provider = ? AND provider_subject = ? LIMIT 1",
                provider,
                providerSubject
        );
        if (rows.isEmpty()) {
            return null;
        }
        Object value = rows.get(0).get("user_id");
        return value instanceof Number number ? number.longValue() : Long.valueOf(String.valueOf(value));
    }

    private SocialIdentityResponse findIdentityForUserProvider(Long userId, String provider) {
        if (userId == null) {
            return null;
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT id, provider, email_at_link, display_name, avatar_url,
                       created_at, last_login_at
                FROM user_identities
                WHERE user_id = ? AND provider = ?
                LIMIT 1
                """,
                userId,
                provider
        );
        return rows.isEmpty() ? null : mapIdentity(rows.get(0));
    }

    private SocialIdentityResponse mapIdentity(Map<String, Object> row) {
        return new SocialIdentityResponse(
                longValue(row.get("id")),
                String.valueOf(row.get("provider")),
                nullableString(row.get("email_at_link")),
                nullableString(row.get("display_name")),
                nullableString(row.get("avatar_url")),
                instantValue(row.get("created_at")),
                instantValue(row.get("last_login_at"))
        );
    }

    private StateParts verifyState(SocialAuthProvider provider, String state) {
        String raw = clean(state);
        int separator = raw.indexOf('.');
        if (separator <= 0 || separator == raw.length() - 1) {
            throw new UnauthorizedException("OAuth state không hợp lệ.");
        }

        String attemptId = raw.substring(0, separator);
        String secret = raw.substring(separator + 1);
        SocialAttempt attempt = requireAttempt(attemptId, false);

        if (!provider.name().equals(attempt.provider()) ||
                !constantTimeEquals(attempt.stateSecretHash(), hashHex(secret))) {
            throw new UnauthorizedException("OAuth state không hợp lệ.");
        }

        if (!"PENDING".equals(attempt.status())) {
            throw new UnauthorizedException("OAuth request không còn ở trạng thái chờ.");
        }

        if (Instant.now().isAfter(attempt.expiresAt())) {
            failAttempt(attemptId, "EXPIRED", "Phiên OAuth đã hết hạn.");
            throw new UnauthorizedException("Phiên OAuth đã hết hạn.");
        }

        return new StateParts(attemptId);
    }

    private void verifyPollSecret(SocialAttempt attempt, String pollSecret) {
        if (!constantTimeEquals(attempt.pollSecretHash(), hashHex(clean(pollSecret)))) {
            throw new UnauthorizedException("Phiên đăng nhập không hợp lệ.");
        }
    }

    private void failAttempt(String attemptId, String errorCode, String errorMessage) {
        jdbcTemplate.update(
                """
                UPDATE social_auth_attempts
                SET status = 'ERROR', error_code = ?, error_message = ?, completed_at = ?
                WHERE attempt_id = ? AND status = 'PENDING'
                """,
                truncate(errorCode, 80),
                truncate(errorMessage, 500),
                Timestamp.from(Instant.now()),
                attemptId
        );
    }

    private SocialAttempt requireAttempt(String attemptId, boolean forUpdate) {
        String sql = """
                SELECT attempt_id, poll_secret_hash, state_secret_hash, provider, mode,
                       requested_by_user_id, resolved_user_id, device_id, device_name,
                       status, error_code, error_message,
                       created_at, expires_at, completed_at, consumed_at
                FROM social_auth_attempts
                WHERE attempt_id = ?
                """ + (forUpdate ? " FOR UPDATE" : "");

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, clean(attemptId));
        if (rows.isEmpty()) {
            throw new UnauthorizedException("Phiên đăng nhập không hợp lệ.");
        }
        return mapAttempt(rows.get(0));
    }

    private SocialAttempt requireAttemptForUpdate(String attemptId) {
        return requireAttempt(attemptId, true);
    }

    private SocialAttempt mapAttempt(Map<String, Object> row) {
        return new SocialAttempt(
                String.valueOf(row.get("attempt_id")),
                String.valueOf(row.get("poll_secret_hash")),
                String.valueOf(row.get("state_secret_hash")),
                String.valueOf(row.get("provider")),
                String.valueOf(row.get("mode")),
                longValue(row.get("requested_by_user_id")),
                longValue(row.get("resolved_user_id")),
                nullableString(row.get("device_id")),
                nullableString(row.get("device_name")),
                String.valueOf(row.get("status")),
                nullableString(row.get("error_code")),
                nullableString(row.get("error_message")),
                instantValue(row.get("created_at")),
                instantValue(row.get("expires_at")),
                instantValue(row.get("completed_at")),
                instantValue(row.get("consumed_at"))
        );
    }

    private static Long longValue(Object value) {
        if (value == null) {
            return null;
        }
        return value instanceof Number number
                ? number.longValue()
                : Long.valueOf(String.valueOf(value));
    }

    private static Instant instantValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant();
        }
        if (value instanceof Instant instant) {
            return instant;
        }
        if (value instanceof LocalDateTime localDateTime) {
            return localDateTime.toInstant(ZoneOffset.UTC);
        }
        return Instant.parse(String.valueOf(value));
    }

    private static String nullableString(Object value) {
        if (value == null) {
            return null;
        }
        String result = String.valueOf(value);
        return result.isBlank() ? null : result;
    }

    private String randomToken(int byteCount) {
        byte[] bytes = new byte[byteCount];
        secureRandom.nextBytes(bytes);
        return base64Url(bytes);
    }

    private static byte[] sha256Bytes(String value) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(String.valueOf(value).getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private static String hashHex(String value) {
        return HexFormat.of().formatHex(sha256Bytes(value));
    }

    private static String base64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static boolean constantTimeEquals(String left, String right) {
        return MessageDigest.isEqual(
                String.valueOf(left).getBytes(StandardCharsets.US_ASCII),
                String.valueOf(right).getBytes(StandardCharsets.US_ASCII)
        );
    }

    private static String normalizeEmail(String email) {
        return clean(email).toLowerCase(Locale.ROOT);
    }

    private static String normalizeDeviceId(String value) {
        String clean = clean(value);
        return clean.isBlank() ? "social-desktop" : truncate(clean, 100);
    }

    private static String normalizeDeviceName(String value) {
        String clean = clean(value);
        return clean.isBlank() ? "AI Translator Desktop" : truncate(clean, 190);
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static String blankToNull(String value) {
        String clean = clean(value);
        return clean.isBlank() ? null : clean;
    }

    private static String truncate(String value, int max) {
        String clean = clean(value);
        return clean.length() <= max ? clean : clean.substring(0, max);
    }

    private record StateParts(String attemptId) {
    }

    private record SocialAttempt(
            String attemptId,
            String pollSecretHash,
            String stateSecretHash,
            String provider,
            String mode,
            Long requestedByUserId,
            Long resolvedUserId,
            String deviceId,
            String deviceName,
            String status,
            String errorCode,
            String errorMessage,
            Instant createdAt,
            Instant expiresAt,
            Instant completedAt,
            Instant consumedAt
    ) {
    }

    public record CallbackResult(boolean success, String message) {
    }
}

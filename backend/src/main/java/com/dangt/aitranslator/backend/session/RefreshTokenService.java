package com.dangt.aitranslator.backend.session;

import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.common.UnauthorizedException;
import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.Base64;

@Service
public class RefreshTokenService {

    private final AuthSessionRepository sessionRepository;
    private final Duration refreshLifetime;
    private final SecureRandom secureRandom = new SecureRandom();

    public RefreshTokenService(
            AuthSessionRepository sessionRepository,
            @Value("${app.auth.refresh-token-days:30}") long refreshTokenDays
    ) {
        this.sessionRepository = sessionRepository;
        this.refreshLifetime = Duration.ofDays(refreshTokenDays);
    }

    @Transactional
    public IssuedRefreshToken createSession(
            UserAccount user,
            String requestedDeviceId,
            String requestedDeviceName
    ) {
        String deviceId = normalizeDeviceId(requestedDeviceId);
        String deviceName = normalizeDeviceName(requestedDeviceName);
        Instant now = Instant.now();

        List<AuthSession> oldSessions =
                sessionRepository
                        .findAllByUser_IdAndDeviceIdAndRevokedAtIsNull(
                                user.getId(),
                                deviceId
                        );

        for (AuthSession oldSession : oldSessions) {
            oldSession.revoke(now);
        }

        String rawToken = generateRawToken();

        AuthSession session = new AuthSession(
                user,
                deviceId,
                deviceName,
                hash(rawToken),
                now.plus(refreshLifetime)
        );

        session = sessionRepository.saveAndFlush(session);

        return new IssuedRefreshToken(
                rawToken,
                refreshLifetime.toSeconds(),
                session.getId(),
                deviceId
        );
    }

    @Transactional
    public RotatedSession rotate(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new UnauthorizedException("Refresh token không hợp lệ.");
        }

        Instant now = Instant.now();

        AuthSession session = sessionRepository
                .findByRefreshTokenHash(hash(rawRefreshToken))
                .orElseThrow(() ->
                        new UnauthorizedException("Refresh token không hợp lệ.")
                );

        if (!session.isActive(now)) {
            throw new UnauthorizedException(
                    "Phiên đăng nhập đã hết hạn hoặc bị thu hồi."
            );
        }

        UserAccount user = session.getUser();

        if (!"ACTIVE".equals(user.getStatus())) {
            session.revoke(now);
            throw new ForbiddenException("Tài khoản hiện không hoạt động.");
        }

        String newRawToken = generateRawToken();

        session.rotateRefreshToken(
                hash(newRawToken),
                now.plus(refreshLifetime),
                now
        );

        sessionRepository.saveAndFlush(session);

        return new RotatedSession(
                user,
                session.getId(),
                session.getDeviceId(),
                new IssuedRefreshToken(
                        newRawToken,
                        refreshLifetime.toSeconds(),
                        session.getId(),
                        session.getDeviceId()
                )
        );
    }

    @Transactional
    public void revokeByRefreshToken(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }

        sessionRepository
                .findByRefreshTokenHash(hash(rawRefreshToken))
                .ifPresent(session -> {
                    session.revoke(Instant.now());
                    sessionRepository.save(session);
                });
    }

    @Transactional(readOnly = true)
    public List<DeviceSessionResponse> listActiveSessions(
            Long userId,
            Long currentSessionId
    ) {
        Instant now = Instant.now();

        return sessionRepository
                .findAllByUser_IdAndRevokedAtIsNullOrderByCreatedAtDesc(userId)
                .stream()
                .filter(session -> session.isActive(now))
                .map(session ->
                        DeviceSessionResponse.from(
                                session,
                                currentSessionId != null
                                        && currentSessionId.equals(session.getId())
                        )
                )
                .toList();
    }

    @Transactional
    public void revokeSession(Long userId, Long sessionId) {
        AuthSession session = sessionRepository
                .findByIdAndUser_Id(sessionId, userId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Không tìm thấy phiên thiết bị.")
                );

        session.revoke(Instant.now());
        sessionRepository.save(session);
    }

    private String generateRawToken() {
        byte[] bytes = new byte[48];
        secureRandom.nextBytes(bytes);

        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(bytes);
    }

    private String hash(String rawToken) {
        try {
            MessageDigest digest =
                    MessageDigest.getInstance("SHA-256");

            byte[] result =
                    digest.digest(
                            rawToken.getBytes(StandardCharsets.UTF_8)
                    );

            return HexFormat.of().formatHex(result);
        } catch (Exception ex) {
            throw new IllegalStateException(
                    "Không thể hash refresh token.",
                    ex
            );
        }
    }

    private String normalizeDeviceId(String value) {
        if (value == null || value.isBlank()) {
            return UUID.randomUUID().toString();
        }

        String clean = value.trim();

        if (clean.length() > 100) {
            clean = clean.substring(0, 100);
        }

        return clean;
    }

    private String normalizeDeviceName(String value) {
        String clean =
                value == null || value.isBlank()
                        ? "AI Translator Desktop"
                        : value.trim();

        if (clean.length() > 190) {
            clean = clean.substring(0, 190);
        }

        return clean;
    }

    public record IssuedRefreshToken(
            String value,
            long expiresInSeconds,
            Long sessionId,
            String deviceId
    ) {
    }

    public record RotatedSession(
            UserAccount user,
            Long sessionId,
            String deviceId,
            IssuedRefreshToken refreshToken
    ) {
    }
}

package com.dangt.aitranslator.backend.auth.email;

import com.dangt.aitranslator.backend.common.EmailNormalizer;
import com.dangt.aitranslator.backend.user.UserAccount;
import com.dangt.aitranslator.backend.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class EmailVerificationService {

    private static final Logger log =
            LoggerFactory.getLogger(
                    EmailVerificationService.class
            );

    private static final SecureRandom SECURE_RANDOM =
            new SecureRandom();

    private static final String GENERIC_REQUEST_MESSAGE =
            "Nếu email cần xác minh, mã xác minh đã được gửi.";

    private static final String INVALID_CODE_MESSAGE =
            "Mã xác minh không hợp lệ hoặc đã hết hạn.";

    private final UserRepository userRepository;

    private final EmailVerificationTokenRepository
            tokenRepository;

    private final PasswordEncoder passwordEncoder;

    private final EmailVerificationDeliveryService
            deliveryService;

    private final int ttlMinutes;
    private final int requestCooldownSeconds;
    private final int maxAttempts;

    public EmailVerificationService(
            UserRepository userRepository,
            EmailVerificationTokenRepository tokenRepository,
            PasswordEncoder passwordEncoder,
            EmailVerificationDeliveryService deliveryService,

            @Value("${app.email-verification.ttl-minutes:10}")
            int ttlMinutes,

            @Value("${app.email-verification.request-cooldown-seconds:60}")
            int requestCooldownSeconds,

            @Value("${app.email-verification.max-attempts:5}")
            int maxAttempts
    ) {
        this.userRepository =
                userRepository;

        this.tokenRepository =
                tokenRepository;

        this.passwordEncoder =
                passwordEncoder;

        this.deliveryService =
                deliveryService;

        this.ttlMinutes =
                Math.max(
                        5,
                        Math.min(ttlMinutes, 30)
                );

        this.requestCooldownSeconds =
                Math.max(
                        30,
                        Math.min(
                                requestCooldownSeconds,
                                600
                        )
                );

        this.maxAttempts =
                Math.max(
                        3,
                        Math.min(
                                maxAttempts,
                                10
                        )
                );
    }

    @Transactional
    public EmailVerificationRequestResponse requestVerification(
            EmailVerificationRequest request,
            String requestedIp
    ) {
        String email =
                EmailNormalizer.normalize(
                        request.email()
                );

        cleanupOldTokens();

        UserAccount user =
                userRepository
                        .findByEmail(email)
                        .orElse(null);

        if (
                user == null
                || !"ACTIVE".equals(
                        user.getStatus()
                )
                || user.isEmailVerified()
        ) {
            return genericResponse();
        }

        UserAccount lockedUser =
                userRepository
                        .findByIdForUpdate(
                                user.getId()
                        )
                        .orElse(null);

        if (
                lockedUser == null
                || !"ACTIVE".equals(
                        lockedUser.getStatus()
                )
                || lockedUser.isEmailVerified()
        ) {
            return genericResponse();
        }

        issueForLockedUser(
                lockedUser,
                requestedIp
        );

        return genericResponse();
    }

    @Transactional
    public EmailVerificationRequestResponse issueForUser(
            UserAccount user,
            String requestedIp
    ) {
        if (
                user == null
                || user.getId() == null
        ) {
            throw new IllegalArgumentException(
                    "Không xác định được tài khoản cần xác minh email."
            );
        }

        cleanupOldTokens();

        UserAccount lockedUser =
                userRepository
                        .findByIdForUpdate(
                                user.getId()
                        )
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Không tìm thấy tài khoản."
                                )
                        );

        if (
                !"ACTIVE".equals(
                        lockedUser.getStatus()
                )
                || lockedUser.isEmailVerified()
        ) {
            return genericResponse();
        }

        issueForLockedUser(
                lockedUser,
                requestedIp
        );

        return genericResponse();
    }

    @Transactional(
            noRollbackFor =
                    EmailVerificationException.class
    )
    public UserAccount confirm(
            EmailVerificationConfirmRequest request
    ) {
        String email =
                EmailNormalizer.normalize(
                        request.email()
                );

        String code =
                normalizeCode(
                        request.code()
                );

        Instant now =
                Instant.now();

        UserAccount user =
                userRepository
                        .findByEmail(email)
                        .orElseThrow(
                                this::invalidCode
                        );

        if (
                !"ACTIVE".equals(
                        user.getStatus()
                )
        ) {
            throw invalidCode();
        }

        UserAccount lockedUser =
                userRepository
                        .findByIdForUpdate(
                                user.getId()
                        )
                        .orElseThrow(
                                this::invalidCode
                        );

        if (lockedUser.isEmailVerified()) {
            throw invalidCode();
        }

        List<EmailVerificationToken> active =
                tokenRepository
                        .findActiveForUpdate(
                                lockedUser.getId(),
                                now
                        );

        EmailVerificationToken token =
                active.stream()
                        .filter(item ->
                                item.isUsable(
                                        now,
                                        maxAttempts
                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                this::invalidCode
                        );

        if (
                !passwordEncoder.matches(
                        code,
                        token.getCodeHash()
                )
        ) {
            token.recordFailedAttempt(
                    now,
                    maxAttempts
            );

            tokenRepository.saveAndFlush(
                    token
            );

            throw invalidCode();
        }

        token.consume(now);

        tokenRepository.saveAndFlush(
                token
        );

        invalidateOpenTokens(
                lockedUser.getId(),
                now
        );

        lockedUser.markEmailVerified(
                now
        );

        return userRepository
                .saveAndFlush(
                        lockedUser
                );
    }

    private void issueForLockedUser(
            UserAccount lockedUser,
            String requestedIp
    ) {
        Instant now =
                Instant.now();

        Instant cooldownAfter =
                now.minusSeconds(
                        requestCooldownSeconds
                );

        if (
                tokenRepository
                        .existsByUser_IdAndCreatedAtAfter(
                                lockedUser.getId(),
                                cooldownAfter
                        )
        ) {
            return;
        }

        invalidateOpenTokens(
                lockedUser.getId(),
                now
        );

        String rawCode =
                newVerificationCode();

        EmailVerificationToken token =
                new EmailVerificationToken(
                        lockedUser,
                        passwordEncoder
                                .encode(
                                        rawCode
                                ),
                        now.plus(
                                Duration.ofMinutes(
                                        ttlMinutes
                                )
                        ),
                        cleanIp(
                                requestedIp
                        ),
                        now
                );

        tokenRepository.saveAndFlush(
                token
        );

        try {
            deliveryService.deliver(
                    lockedUser.getEmail(),
                    rawCode
            );
        } catch (RuntimeException ex) {
            token.consume(
                    Instant.now()
            );

            tokenRepository.saveAndFlush(
                    token
            );

            log.error(
                "Email verification delivery failed for userId={} cause={}",
                lockedUser.getId(),
                ex.getClass().getSimpleName()
            );
        }
    }

    private void invalidateOpenTokens(
            Long userId,
            Instant now
    ) {
        List<EmailVerificationToken> open =
                tokenRepository
                        .findAllByUser_IdAndUsedAtIsNullOrderByCreatedAtDesc(
                                userId
                        );

        for (
                EmailVerificationToken token
                : open
        ) {
            token.consume(now);
        }

        if (!open.isEmpty()) {
            tokenRepository.saveAll(
                    open
            );
        }
    }

    private void cleanupOldTokens() {
        tokenRepository.deleteByCreatedAtBefore(
                Instant.now().minus(
                        Duration.ofDays(7)
                )
        );
    }

    private String newVerificationCode() {
        return String.format(
                "%06d",
                SECURE_RANDOM.nextInt(
                        1_000_000
                )
        );
    }

    private String normalizeCode(
            String value
    ) {
        String clean =
                String.valueOf(
                                value == null
                                        ? ""
                                        : value
                        )
                        .trim();

        if (!clean.matches("\\d{6}")) {
            throw invalidCode();
        }

        return clean;
    }

    private String cleanIp(
            String value
    ) {
        String clean =
                String.valueOf(
                                value == null
                                        ? ""
                                        : value
                        )
                        .trim();

        if (clean.isBlank()) {
            return null;
        }

        return clean.length() <= 64
                ? clean
                : clean.substring(0, 64);
    }

    private EmailVerificationRequestResponse
    genericResponse() {
        return new EmailVerificationRequestResponse(
                true,
                requestCooldownSeconds,
                GENERIC_REQUEST_MESSAGE
        );
    }

    private EmailVerificationException
    invalidCode() {
        return new EmailVerificationException(
                "EMAIL_VERIFICATION_CODE_INVALID",
                INVALID_CODE_MESSAGE
        );
    }
}

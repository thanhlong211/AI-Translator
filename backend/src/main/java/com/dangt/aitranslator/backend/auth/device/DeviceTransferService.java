package com.dangt.aitranslator.backend.auth.device;

import com.dangt.aitranslator.backend.auth.AuthResponse;
import com.dangt.aitranslator.backend.auth.AuthService;
import com.dangt.aitranslator.backend.common.EmailNormalizer;
import com.dangt.aitranslator.backend.session.DeviceBindingService;
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
public class DeviceTransferService {

    private static final Logger log =
            LoggerFactory.getLogger(
                    DeviceTransferService.class
            );

    private static final SecureRandom SECURE_RANDOM =
            new SecureRandom();

    private static final String GENERIC_REQUEST_MESSAGE =
            "Nếu tài khoản đủ điều kiện chuyển thiết bị, "
            + "mã xác minh đã được gửi tới email.";

    private static final String INVALID_CODE_MESSAGE =
            "Mã xác minh không hợp lệ hoặc đã hết hạn.";

    private final UserRepository userRepository;

    private final DeviceTransferTokenRepository
            tokenRepository;

    private final PasswordEncoder passwordEncoder;

    private final DeviceTransferDeliveryService
            deliveryService;

    private final DeviceBindingService
            deviceBindingService;

    private final AuthService authService;

    private final int ttlMinutes;
    private final int requestCooldownSeconds;
    private final int maxAttempts;

    public DeviceTransferService(
            UserRepository userRepository,
            DeviceTransferTokenRepository tokenRepository,
            PasswordEncoder passwordEncoder,
            DeviceTransferDeliveryService deliveryService,
            DeviceBindingService deviceBindingService,
            AuthService authService,

            @Value("${app.device-transfer.ttl-minutes:10}")
            int ttlMinutes,

            @Value("${app.device-transfer.request-cooldown-seconds:60}")
            int requestCooldownSeconds,

            @Value("${app.device-transfer.max-attempts:5}")
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

        this.deviceBindingService =
                deviceBindingService;

        this.authService =
                authService;

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
    public DeviceTransferRequestResponse
    requestTransfer(
            DeviceTransferRequest request,
            String requestedIp
    ) {
        String email =
                EmailNormalizer.normalize(
                        request.email()
                );

        String deviceId =
                normalizeDeviceId(
                        request.deviceId()
                );

        String deviceName =
                normalizeDeviceName(
                        request.deviceName()
                );

        Instant now =
                Instant.now();

        tokenRepository.deleteByCreatedAtBefore(
                now.minus(
                        Duration.ofDays(7)
                )
        );

        UserAccount user =
                userRepository
                        .findByEmail(email)
                        .orElse(null);

        if (
                user == null
                || !"ACTIVE".equals(
                        user.getStatus()
                )
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
        ) {
            return genericResponse();
        }

        String currentDeviceId =
                lockedUser
                        .getBoundDeviceId();

        /*
         * Nếu chưa bind hoặc request đến từ chính máy
         * đang bind thì login bình thường đã xử lý được.
         */
        if (
                currentDeviceId == null
                || currentDeviceId.equals(
                        deviceId
                )
        ) {
            return genericResponse();
        }

        UserAccount existingOwner =
                userRepository
                        .findByBoundDeviceId(
                                deviceId
                        )
                        .orElse(null);

        if (
                existingOwner != null
                && !existingOwner
                        .getId()
                        .equals(
                                lockedUser.getId()
                        )
        ) {
            return genericResponse();
        }

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
            return genericResponse();
        }

        invalidateOpenTokens(
                lockedUser.getId(),
                now
        );

        String rawCode =
                newVerificationCode();

        DeviceTransferToken token =
                new DeviceTransferToken(
                        lockedUser,
                        deviceId,
                        deviceName,
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
                    "Device transfer delivery failed for userId={}",
                    lockedUser.getId(),
                    ex
            );
        }

        return genericResponse();
    }

    @Transactional(
            noRollbackFor =
                    DeviceTransferVerificationException.class
    )
    public AuthResponse confirmTransfer(
            DeviceTransferConfirmRequest request
    ) {
        String email =
                EmailNormalizer.normalize(
                        request.email()
                );

        String deviceId =
                normalizeDeviceId(
                        request.deviceId()
                );

        String deviceName =
                normalizeDeviceName(
                        request.deviceName()
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

        List<DeviceTransferToken> active =
                tokenRepository
                        .findActiveForUpdate(
                                lockedUser.getId(),
                                deviceId,
                                now
                        );

        DeviceTransferToken token =
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

        UserAccount transferredUser =
                deviceBindingService
                        .transferBinding(
                                lockedUser,
                                deviceId,
                                deviceName
                        );

        return authService
                .createSessionForUser(
                        transferredUser,
                        deviceId,
                        deviceName
                );
    }

    private void invalidateOpenTokens(
            Long userId,
            Instant now
    ) {
        List<DeviceTransferToken> open =
                tokenRepository
                        .findAllByUser_IdAndUsedAtIsNullOrderByCreatedAtDesc(
                                userId
                        );

        boolean changed = false;

        for (
                DeviceTransferToken token
                : open
        ) {
            if (
                    token.getUsedAt()
                            == null
            ) {
                token.consume(now);
                changed = true;
            }
        }

        if (changed) {
            tokenRepository.saveAll(
                    open
            );
        }
    }

    private DeviceTransferRequestResponse
    genericResponse() {
        return new DeviceTransferRequestResponse(
                true,
                GENERIC_REQUEST_MESSAGE
        );
    }

    private DeviceTransferVerificationException
    invalidCode() {
        return new DeviceTransferVerificationException(
                "DEVICE_TRANSFER_CODE_INVALID",
                INVALID_CODE_MESSAGE
        );
    }

    private String normalizeDeviceId(
            String value
    ) {
        if (
                value == null
                || value.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Thiếu mã nhận dạng thiết bị."
            );
        }

        String clean =
                value.trim();

        if (clean.length() > 100) {
            throw new IllegalArgumentException(
                    "Mã nhận dạng thiết bị vượt quá giới hạn."
            );
        }

        return clean;
    }

    private String normalizeDeviceName(
            String value
    ) {
        String clean =
                value == null
                        || value.isBlank()
                        ? "AI Translator Desktop"
                        : value.trim();

        if (clean.length() > 190) {
            clean =
                    clean.substring(
                            0,
                            190
                    );
        }

        return clean;
    }

    private String normalizeCode(
            String value
    ) {
        String clean =
                String.valueOf(
                        value == null
                                ? ""
                                : value
                ).trim();

        if (
                !clean.matches(
                        "\\d{6}"
                )
        ) {
            throw invalidCode();
        }

        return clean;
    }

    private String cleanIp(
            String ip
    ) {
        if (
                ip == null
                || ip.isBlank()
        ) {
            return null;
        }

        String clean =
                ip.trim();

        return clean.length() <= 64
                ? clean
                : clean.substring(
                        0,
                        64
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
}

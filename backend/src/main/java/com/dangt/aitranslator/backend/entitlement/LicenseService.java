package com.dangt.aitranslator.backend.entitlement;

import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

@Service
public class LicenseService {

    private final JdbcTemplate jdbcTemplate;
    private final EntitlementService entitlementService;

    public LicenseService(
            JdbcTemplate jdbcTemplate,
            EntitlementService entitlementService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.entitlementService = entitlementService;
    }

    @Transactional
    public EntitlementResponse activate(
            UserAccount user,
            String rawLicenseKey,
            String requestedDeviceId
    ) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("Không xác định được tài khoản.");
        }

        String normalizedKey = normalizeLicenseKey(rawLicenseKey);
        if (normalizedKey.length() < 12) {
            throw new IllegalArgumentException("License key không hợp lệ.");
        }
        String deviceId = normalizeDeviceId(requestedDeviceId);
        String keyHash = sha256(normalizedKey);

        List<LicenseRow> rows = jdbcTemplate.query(
                """
                SELECT id, plan_code, duration_type, status, max_activations,
                       activation_count, starts_at, expires_at
                FROM license_keys
                WHERE key_hash = ?
                LIMIT 1
                FOR UPDATE
                """,
                (rs, rowNum) -> new LicenseRow(
                        rs.getLong("id"),
                        rs.getString("plan_code"),
                        rs.getString("duration_type"),
                        rs.getString("status"),
                        rs.getInt("max_activations"),
                        rs.getInt("activation_count"),
                        toInstant(rs.getTimestamp("starts_at")),
                        toInstant(rs.getTimestamp("expires_at"))
                ),
                keyHash
        );

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("License key không tồn tại.");
        }

        LicenseRow license = rows.getFirst();
        requireActivePlan(license.planCode());

        List<ActivationRow> activationRows = jdbcTemplate.query(
                """
                SELECT id, status, activated_at
                FROM license_activations
                WHERE license_key_id = ? AND user_id = ?
                LIMIT 1
                FOR UPDATE
                """,
                (rs, rowNum) -> new ActivationRow(
                        rs.getLong("id"),
                        rs.getString("status"),
                        toInstant(rs.getTimestamp("activated_at"))
                ),
                license.id(),
                user.getId()
        );

        if (!activationRows.isEmpty()
                && "ACTIVE".equalsIgnoreCase(activationRows.getFirst().status())) {
            ActivationRow activation = activationRows.getFirst();
            if (!deviceId.isEmpty()) {
                jdbcTemplate.update(
                        "UPDATE license_activations SET device_id = ? WHERE id = ?",
                        deviceId,
                        activation.id()
                );
            }
            ensureLicenseSubscription(user.getId(), license, activation.activatedAt());
            return entitlementService.resolve(user);
        }

        validateRedeemable(license);

        if (license.activationCount() >= license.maxActivations()) {
            throw new IllegalArgumentException("License key đã đạt số lần kích hoạt tối đa.");
        }

        Instant activatedAt = Instant.now();
        if (!activationRows.isEmpty()) {
            ActivationRow previous = activationRows.getFirst();
            jdbcTemplate.update(
                    """
                    UPDATE license_activations
                    SET device_id = ?,
                        status = 'ACTIVE',
                        activated_at = ?,
                        revoked_at = NULL,
                        revoked_by_user_id = NULL,
                        revoke_reason = NULL
                    WHERE id = ?
                    """,
                    deviceId.isEmpty() ? null : deviceId,
                    Timestamp.from(activatedAt),
                    previous.id()
            );
        } else {
            try {
                jdbcTemplate.update(
                        """
                        INSERT INTO license_activations (
                            license_key_id,
                            user_id,
                            device_id,
                            status,
                            activated_at
                        ) VALUES (?, ?, ?, 'ACTIVE', ?)
                        """,
                        license.id(),
                        user.getId(),
                        deviceId.isEmpty() ? null : deviceId,
                        Timestamp.from(activatedAt)
                );
            } catch (DuplicateKeyException ignored) {
                List<ActivationRow> duplicateRows = jdbcTemplate.query(
                        """
                        SELECT id, status, activated_at
                        FROM license_activations
                        WHERE license_key_id = ? AND user_id = ?
                        LIMIT 1
                        FOR UPDATE
                        """,
                        (rs, rowNum) -> new ActivationRow(
                                rs.getLong("id"),
                                rs.getString("status"),
                                toInstant(rs.getTimestamp("activated_at"))
                        ),
                        license.id(),
                        user.getId()
                );
                if (!duplicateRows.isEmpty()
                        && "ACTIVE".equalsIgnoreCase(duplicateRows.getFirst().status())) {
                    ensureLicenseSubscription(
                            user.getId(),
                            license,
                            duplicateRows.getFirst().activatedAt()
                    );
                    return entitlementService.resolve(user);
                }
                throw new IllegalStateException("Không thể ghi nhận activation license.");
            }
        }

        jdbcTemplate.update(
                """
                UPDATE license_keys
                SET activation_count = activation_count + 1,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                license.id()
        );

        ensureLicenseSubscription(user.getId(), license, activatedAt);
        return entitlementService.resolve(user);
    }

    private void requireActivePlan(String planCode) {
        Integer activePlan = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM plan_catalog WHERE code = ? AND active = TRUE",
                Integer.class,
                EntitlementService.normalizePlan(planCode)
        );
        if (activePlan == null || activePlan == 0) {
            throw new IllegalArgumentException(
                    "Gói " + EntitlementService.normalizePlan(planCode)
                            + " hiện đang tạm ngừng và không thể kích hoạt license."
            );
        }
    }

    private void validateRedeemable(LicenseRow license) {
        if (!"AVAILABLE".equalsIgnoreCase(license.status())) {
            throw new IllegalArgumentException("License key hiện không thể kích hoạt.");
        }

        Instant now = Instant.now();
        if (license.startsAt() != null && license.startsAt().isAfter(now)) {
            throw new IllegalArgumentException("License key chưa tới thời gian được phép kích hoạt.");
        }
        if (license.expiresAt() != null && !license.expiresAt().isAfter(now)) {
            throw new IllegalArgumentException("License key đã hết hạn kích hoạt.");
        }
    }

    private void ensureLicenseSubscription(
            long userId,
            LicenseRow license,
            Instant activatedAt
    ) {
        Integer existing = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM subscriptions
                WHERE user_id = ?
                  AND source = 'LICENSE'
                  AND reference_id = ?
                  AND status IN ('ACTIVE', 'TRIAL', 'GRANDFATHERED')
                  AND (period_end IS NULL OR period_end > CURRENT_TIMESTAMP(6))
                """,
                Integer.class,
                userId,
                license.id()
        );

        if (existing != null && existing > 0) {
            return;
        }

        Long monthlyLimit = jdbcTemplate.queryForObject(
                """
                SELECT COALESCE(MAX(limit_value), 0)
                FROM plan_limits
                WHERE plan_code = ?
                  AND limit_key = 'monthlyTranslations'
                """,
                Long.class,
                license.planCode()
        );

        Instant start = activatedAt == null ? Instant.now() : activatedAt;
        Instant end = subscriptionEnd(start, license);

        jdbcTemplate.update(
                """
                INSERT INTO subscriptions (
                    user_id,
                    plan,
                    status,
                    source,
                    reference_id,
                    price_id,
                    monthly_translation_limit,
                    period_start,
                    period_end,
                    canceled_at,
                    cancel_reason,
                    created_at,
                    updated_at
                ) VALUES (?, ?, 'ACTIVE', 'LICENSE', ?, NULL, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                """,
                userId,
                EntitlementService.normalizePlan(license.planCode()),
                license.id(),
                monthlyLimit == null ? 0L : monthlyLimit,
                Timestamp.from(start),
                end == null ? null : Timestamp.from(end)
        );
    }

    private static Instant subscriptionEnd(Instant activatedAt, LicenseRow license) {
        String duration = String.valueOf(license.durationType() == null
                ? "LEGACY_EXPIRY"
                : license.durationType()).toUpperCase(Locale.ROOT);
        return switch (duration) {
            case "MONTHLY" -> activatedAt.atZone(ZoneOffset.UTC).plusMonths(1).toInstant();
            case "YEARLY" -> activatedAt.atZone(ZoneOffset.UTC).plusYears(1).toInstant();
            case "LIFETIME" -> null;
            default -> license.expiresAt();
        };
    }

    static String normalizeLicenseKey(String value) {
        return String.valueOf(value == null ? "" : value)
                .trim()
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]", "");
    }

    static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(
                    digest.digest(value.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 không khả dụng.", ex);
        }
    }

    private static String normalizeDeviceId(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.length() > 100) {
            return clean.substring(0, 100);
        }
        return clean;
    }

    private static Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private record LicenseRow(
            long id,
            String planCode,
            String durationType,
            String status,
            int maxActivations,
            int activationCount,
            Instant startsAt,
            Instant expiresAt
    ) {
    }

    private record ActivationRow(
            long id,
            String status,
            Instant activatedAt
    ) {
    }
}

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
            String rawLicenseKey
    ) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("Không xác định được tài khoản.");
        }

        String normalizedKey = normalizeLicenseKey(rawLicenseKey);
        if (normalizedKey.length() < 12) {
            throw new IllegalArgumentException("License key không hợp lệ.");
        }

        String keyHash = sha256(normalizedKey);

        List<LicenseRow> rows = jdbcTemplate.query(
                """
                SELECT id, plan_code, status, max_activations,
                       activation_count, expires_at
                FROM license_keys
                WHERE key_hash = ?
                LIMIT 1
                FOR UPDATE
                """,
                (rs, rowNum) -> new LicenseRow(
                        rs.getLong("id"),
                        rs.getString("plan_code"),
                        rs.getString("status"),
                        rs.getInt("max_activations"),
                        rs.getInt("activation_count"),
                        toInstant(rs.getTimestamp("expires_at"))
                ),
                keyHash
        );

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("License key không tồn tại.");
        }

        LicenseRow license = rows.getFirst();

        Integer activePlan = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM plan_catalog WHERE code = ? AND active = TRUE",
                Integer.class,
                EntitlementService.normalizePlan(license.planCode())
        );
        if (activePlan == null || activePlan == 0) {
            throw new IllegalArgumentException(
                    "Gói " + EntitlementService.normalizePlan(license.planCode())
                            + " hiện đang tạm ngừng và không thể kích hoạt license."
            );
        }

        if (!"AVAILABLE".equalsIgnoreCase(license.status())) {
            throw new IllegalArgumentException("License key hiện không thể kích hoạt.");
        }

        if (license.expiresAt() != null && !license.expiresAt().isAfter(Instant.now())) {
            throw new IllegalArgumentException("License key đã hết hạn.");
        }

        Integer alreadyActivated = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM license_activations
                WHERE license_key_id = ? AND user_id = ?
                """,
                Integer.class,
                license.id(),
                user.getId()
        );

        if (alreadyActivated != null && alreadyActivated > 0) {
            ensureLicenseSubscription(user.getId(), license);
            return entitlementService.resolve(user);
        }

        if (license.activationCount() >= license.maxActivations()) {
            throw new IllegalArgumentException("License key đã đạt số lần kích hoạt tối đa.");
        }

        try {
            jdbcTemplate.update(
                    """
                    INSERT INTO license_activations (
                        license_key_id,
                        user_id,
                        activated_at
                    ) VALUES (?, ?, CURRENT_TIMESTAMP(6))
                    """,
                    license.id(),
                    user.getId()
            );
        } catch (DuplicateKeyException ignored) {
            ensureLicenseSubscription(user.getId(), license);
            return entitlementService.resolve(user);
        }

        jdbcTemplate.update(
                """
                UPDATE license_keys
                SET activation_count = activation_count + 1
                WHERE id = ?
                """,
                license.id()
        );

        ensureLicenseSubscription(user.getId(), license);

        return entitlementService.resolve(user);
    }

    private void ensureLicenseSubscription(
            long userId,
            LicenseRow license
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

        jdbcTemplate.update(
                """
                INSERT INTO subscriptions (
                    user_id,
                    plan,
                    status,
                    source,
                    reference_id,
                    monthly_translation_limit,
                    period_start,
                    period_end,
                    created_at,
                    updated_at
                ) VALUES (?, ?, 'ACTIVE', 'LICENSE', ?, ?, CURRENT_TIMESTAMP(6), ?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                """,
                userId,
                EntitlementService.normalizePlan(license.planCode()),
                license.id(),
                monthlyLimit == null ? 0L : monthlyLimit,
                license.expiresAt() == null
                        ? null
                        : Timestamp.from(license.expiresAt())
        );
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

    private static Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private record LicenseRow(
            long id,
            String planCode,
            String status,
            int maxActivations,
            int activationCount,
            Instant expiresAt
    ) {
    }
}

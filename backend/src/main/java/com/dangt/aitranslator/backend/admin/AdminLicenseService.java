package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class AdminLicenseService {

    private static final Set<String> DURATION_TYPES =
            Set.of("MONTHLY", "YEARLY", "LIFETIME");
    private static final Set<String> STATUSES =
            Set.of("AVAILABLE", "DISABLED");
    private static final String KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcTemplate jdbcTemplate;
    private final AdminAuditService auditService;

    public AdminLicenseService(
            JdbcTemplate jdbcTemplate,
            AdminAuditService auditService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<AdminLicenseResponse> list(String requestedPlanCode, String requestedStatus) {
        String planCode = clean(requestedPlanCode).toUpperCase(Locale.ROOT);
        String status = clean(requestedStatus).toUpperCase(Locale.ROOT);
        if (!status.isEmpty() && !STATUSES.contains(status)) {
            throw new IllegalArgumentException("Status license không hợp lệ.");
        }

        StringBuilder sql = new StringBuilder(licenseSelectSql()).append(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (!planCode.isEmpty()) {
            sql.append(" AND lk.plan_code = ?");
            args.add(normalizePlanCode(planCode));
        }
        if (!status.isEmpty()) {
            sql.append(" AND lk.status = ?");
            args.add(status);
        }
        sql.append(" ORDER BY lk.id DESC");

        return jdbcTemplate.query(
                sql.toString(),
                (rs, rowNum) -> mapLicense(rs, null, List.of()),
                args.toArray()
        );
    }

    @Transactional(readOnly = true)
    public AdminLicenseResponse detail(long licenseId) {
        AdminLicenseResponse license = requireLicense(licenseId, false);
        return withActivations(license, listActivations(licenseId));
    }

    @Transactional
    public AdminLicenseResponse create(UserAccount actor, AdminLicenseCreateRequest request) {
        String planCode = normalizePlanCode(request.planCode());
        requireActivePlan(planCode);
        String durationType = normalizeDuration(request.durationType());
        int maxActivations = validateMaxActivations(request.maxActivations(), 0);
        Instant startsAt = parseOptionalInstant(request.startsAt(), "Ngày bắt đầu");
        Instant expiresAt = parseOptionalInstant(request.expiresAt(), "Ngày hết hạn redeem");
        validateWindow(startsAt, expiresAt);
        String reason = cleanReason(request.reason());
        String note = cleanNullable(request.note(), 500);

        String issuedKey = null;
        Long licenseId = null;
        for (int attempt = 0; attempt < 8 && licenseId == null; attempt++) {
            String candidate = generateLicenseKey();
            String normalized = normalizeLicenseKey(candidate);
            try {
                jdbcTemplate.update(
                        """
                        INSERT INTO license_keys (
                            key_hash,
                            plan_code,
                            duration_type,
                            status,
                            max_activations,
                            activation_count,
                            starts_at,
                            expires_at,
                            key_hint,
                            note,
                            created_by_user_id,
                            created_at,
                            updated_at
                        ) VALUES (?, ?, ?, 'AVAILABLE', ?, 0, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                        """,
                        sha256(normalized),
                        planCode,
                        durationType,
                        maxActivations,
                        toTimestamp(startsAt),
                        toTimestamp(expiresAt),
                        "••••-" + normalized.substring(normalized.length() - 4),
                        note,
                        actor.getId()
                );
                licenseId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
                issuedKey = candidate;
            } catch (DuplicateKeyException ignored) {
                // Extremely unlikely; generate a new random key.
            }
        }

        if (licenseId == null || licenseId <= 0 || issuedKey == null) {
            throw new IllegalStateException("Không thể tạo license key duy nhất.");
        }

        auditService.record(
                actor.getId(),
                "LICENSE_CREATED",
                null,
                "licenseId=" + licenseId
                        + "; plan=" + planCode
                        + "; duration=" + durationType
                        + "; maxActivations=" + maxActivations
                        + "; startsAt=" + valueOrNone(startsAt)
                        + "; expiresAt=" + valueOrNone(expiresAt)
                        + "; reason=" + reason
        );

        AdminLicenseResponse created = requireLicense(licenseId, false);
        return withIssuedKey(created, issuedKey);
    }

    @Transactional
    public AdminLicenseResponse update(
            UserAccount actor,
            long licenseId,
            AdminLicenseUpdateRequest request
    ) {
        AdminLicenseResponse before = requireLicense(licenseId, true);
        String status = normalizeStatus(request.status());
        if ("AVAILABLE".equals(status)) {
            requireActivePlan(before.planCode());
        }
        int maxActivations = validateMaxActivations(
                request.maxActivations(),
                before.activationCount()
        );
        Instant startsAt = parseOptionalInstant(request.startsAt(), "Ngày bắt đầu");
        Instant expiresAt = parseOptionalInstant(request.expiresAt(), "Ngày hết hạn redeem");
        validateWindow(startsAt, expiresAt);
        String note = cleanNullable(request.note(), 500);
        String reason = cleanReason(request.reason());

        jdbcTemplate.update(
                """
                UPDATE license_keys
                SET status = ?,
                    max_activations = ?,
                    starts_at = ?,
                    expires_at = ?,
                    note = ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                status,
                maxActivations,
                toTimestamp(startsAt),
                toTimestamp(expiresAt),
                note,
                licenseId
        );

        auditService.record(
                actor.getId(),
                "LICENSE_UPDATED",
                null,
                "licenseId=" + licenseId
                        + "; status=" + before.status() + "->" + status
                        + "; maxActivations=" + before.maxActivations() + "->" + maxActivations
                        + "; startsAt=" + valueOrNone(startsAt)
                        + "; expiresAt=" + valueOrNone(expiresAt)
                        + "; reason=" + reason
        );

        return detail(licenseId);
    }

    @Transactional
    public AdminLicenseResponse revokeActivation(
            UserAccount actor,
            long licenseId,
            long activationId,
            AdminReasonRequest request
    ) {
        requireLicense(licenseId, true);
        ActivationRow activation = requireActivation(licenseId, activationId, true);
        String reason = cleanReason(request.reason());

        if ("REVOKED".equalsIgnoreCase(activation.status())) {
            return detail(licenseId);
        }

        jdbcTemplate.update(
                """
                UPDATE license_activations
                SET status = 'REVOKED',
                    revoked_at = CURRENT_TIMESTAMP(6),
                    revoked_by_user_id = ?,
                    revoke_reason = ?
                WHERE id = ?
                  AND license_key_id = ?
                """,
                actor.getId(),
                reason,
                activationId,
                licenseId
        );

        jdbcTemplate.update(
                """
                UPDATE license_keys
                SET activation_count = GREATEST(activation_count - 1, 0),
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                licenseId
        );

        int canceledSubscriptions = cancelLicenseSubscriptions(
                licenseId,
                activation.userId(),
                reason
        );

        auditService.record(
                actor.getId(),
                "LICENSE_ACTIVATION_REVOKED",
                activation.userId(),
                "licenseId=" + licenseId
                        + "; activationId=" + activationId
                        + "; canceledSubscriptions=" + canceledSubscriptions
                        + "; reason=" + reason
        );

        return detail(licenseId);
    }

    @Transactional
    public AdminLicenseResponse resetActivations(
            UserAccount actor,
            long licenseId,
            AdminReasonRequest request
    ) {
        AdminLicenseResponse license = requireLicense(licenseId, true);
        String reason = cleanReason(request.reason());

        int revoked = jdbcTemplate.update(
                """
                UPDATE license_activations
                SET status = 'REVOKED',
                    revoked_at = CURRENT_TIMESTAMP(6),
                    revoked_by_user_id = ?,
                    revoke_reason = ?
                WHERE license_key_id = ?
                  AND status = 'ACTIVE'
                """,
                actor.getId(),
                reason,
                licenseId
        );

        int canceledSubscriptions = jdbcTemplate.update(
                """
                UPDATE subscriptions
                SET status = 'CANCELED',
                    canceled_at = CURRENT_TIMESTAMP(6),
                    cancel_reason = ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE source = 'LICENSE'
                  AND reference_id = ?
                  AND status IN ('ACTIVE', 'TRIAL', 'GRANDFATHERED')
                """,
                "License activation reset: " + reason,
                licenseId
        );

        jdbcTemplate.update(
                """
                UPDATE license_keys
                SET activation_count = 0,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                licenseId
        );

        auditService.record(
                actor.getId(),
                "LICENSE_ACTIVATIONS_RESET",
                null,
                "licenseId=" + licenseId
                        + "; plan=" + license.planCode()
                        + "; revoked=" + revoked
                        + "; canceledSubscriptions=" + canceledSubscriptions
                        + "; reason=" + reason
        );

        return detail(licenseId);
    }

    private int cancelLicenseSubscriptions(long licenseId, long userId, String reason) {
        return jdbcTemplate.update(
                """
                UPDATE subscriptions
                SET status = 'CANCELED',
                    canceled_at = CURRENT_TIMESTAMP(6),
                    cancel_reason = ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE user_id = ?
                  AND source = 'LICENSE'
                  AND reference_id = ?
                  AND status IN ('ACTIVE', 'TRIAL', 'GRANDFATHERED')
                """,
                "License activation revoked: " + reason,
                userId,
                licenseId
        );
    }

    private AdminLicenseResponse requireLicense(long licenseId, boolean forUpdate) {
        String sql = licenseSelectSql() + " WHERE lk.id = ? LIMIT 1" + (forUpdate ? " FOR UPDATE" : "");
        List<AdminLicenseResponse> rows = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> mapLicense(rs, null, List.of()),
                licenseId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy license.");
        }
        return rows.getFirst();
    }

    private ActivationRow requireActivation(long licenseId, long activationId, boolean forUpdate) {
        String sql = """
                SELECT id, user_id, status, activated_at
                FROM license_activations
                WHERE id = ? AND license_key_id = ?
                LIMIT 1
                """ + (forUpdate ? " FOR UPDATE" : "");
        List<ActivationRow> rows = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new ActivationRow(
                        rs.getLong("id"),
                        rs.getLong("user_id"),
                        rs.getString("status"),
                        toInstant(rs.getTimestamp("activated_at"))
                ),
                activationId,
                licenseId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy activation của license.");
        }
        return rows.getFirst();
    }

    private List<AdminLicenseActivationResponse> listActivations(long licenseId) {
        return jdbcTemplate.query(
                """
                SELECT la.id,
                       la.user_id,
                       u.email AS user_email,
                       la.device_id,
                       la.status,
                       la.activated_at,
                       la.revoked_at,
                       la.revoked_by_user_id,
                       revoker.email AS revoked_by_email,
                       la.revoke_reason,
                       (
                           SELECT MAX(s.id)
                           FROM subscriptions s
                           WHERE s.user_id = la.user_id
                             AND s.source = 'LICENSE'
                             AND s.reference_id = la.license_key_id
                       ) AS latest_subscription_id
                FROM license_activations la
                JOIN users u ON u.id = la.user_id
                LEFT JOIN users revoker ON revoker.id = la.revoked_by_user_id
                WHERE la.license_key_id = ?
                ORDER BY la.id DESC
                """,
                (rs, rowNum) -> new AdminLicenseActivationResponse(
                        rs.getLong("id"),
                        rs.getLong("user_id"),
                        rs.getString("user_email"),
                        rs.getString("device_id"),
                        rs.getString("status"),
                        toInstant(rs.getTimestamp("activated_at")),
                        toInstant(rs.getTimestamp("revoked_at")),
                        nullableLong(rs.getObject("revoked_by_user_id")),
                        rs.getString("revoked_by_email"),
                        rs.getString("revoke_reason"),
                        nullableLong(rs.getObject("latest_subscription_id"))
                ),
                licenseId
        );
    }

    private String licenseSelectSql() {
        return """
                SELECT lk.id,
                       lk.plan_code,
                       lk.status,
                       lk.duration_type,
                       lk.max_activations,
                       lk.activation_count,
                       lk.starts_at,
                       lk.expires_at,
                       lk.key_hint,
                       lk.note,
                       lk.created_by_user_id,
                       creator.email AS created_by_email,
                       lk.created_at,
                       lk.updated_at
                FROM license_keys lk
                LEFT JOIN users creator ON creator.id = lk.created_by_user_id
                """;
    }

    private AdminLicenseResponse mapLicense(
            ResultSet rs,
            String issuedKey,
            List<AdminLicenseActivationResponse> activations
    ) throws SQLException {
        return new AdminLicenseResponse(
                rs.getLong("id"),
                rs.getString("plan_code"),
                rs.getString("status"),
                rs.getString("duration_type"),
                rs.getInt("max_activations"),
                rs.getInt("activation_count"),
                toInstant(rs.getTimestamp("starts_at")),
                toInstant(rs.getTimestamp("expires_at")),
                rs.getString("key_hint"),
                rs.getString("note"),
                nullableLong(rs.getObject("created_by_user_id")),
                rs.getString("created_by_email"),
                toInstant(rs.getTimestamp("created_at")),
                toInstant(rs.getTimestamp("updated_at")),
                issuedKey,
                activations
        );
    }

    private static AdminLicenseResponse withIssuedKey(AdminLicenseResponse source, String issuedKey) {
        return new AdminLicenseResponse(
                source.id(), source.planCode(), source.status(), source.durationType(),
                source.maxActivations(), source.activationCount(), source.startsAt(), source.expiresAt(),
                source.keyHint(), source.note(), source.createdByUserId(), source.createdByEmail(),
                source.createdAt(), source.updatedAt(), issuedKey, source.activations()
        );
    }

    private static AdminLicenseResponse withActivations(
            AdminLicenseResponse source,
            List<AdminLicenseActivationResponse> activations
    ) {
        return new AdminLicenseResponse(
                source.id(), source.planCode(), source.status(), source.durationType(),
                source.maxActivations(), source.activationCount(), source.startsAt(), source.expiresAt(),
                source.keyHint(), source.note(), source.createdByUserId(), source.createdByEmail(),
                source.createdAt(), source.updatedAt(), null, activations
        );
    }

    private void requireActivePlan(String planCode) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM plan_catalog WHERE code = ? AND active = TRUE",
                Integer.class,
                planCode
        );
        if (count == null || count == 0) {
            throw new IllegalArgumentException("Plan không tồn tại hoặc đang bị tắt: " + planCode + ".");
        }
    }

    private static int validateMaxActivations(int value, int currentActive) {
        if (value < 1 || value > 10000) {
            throw new IllegalArgumentException("Số activation tối đa phải từ 1 đến 10000.");
        }
        if (value < currentActive) {
            throw new IllegalArgumentException(
                    "Không thể đặt max activations thấp hơn số activation đang hoạt động (" + currentActive + ")."
            );
        }
        return value;
    }

    private static String normalizeDuration(String value) {
        String normalized = clean(value).toUpperCase(Locale.ROOT);
        if (!DURATION_TYPES.contains(normalized)) {
            throw new IllegalArgumentException("Duration type chỉ hỗ trợ MONTHLY, YEARLY hoặc LIFETIME.");
        }
        return normalized;
    }

    private static String normalizeStatus(String value) {
        String normalized = clean(value).toUpperCase(Locale.ROOT);
        if (!STATUSES.contains(normalized)) {
            throw new IllegalArgumentException("Status license chỉ hỗ trợ AVAILABLE hoặc DISABLED.");
        }
        return normalized;
    }

    private static void validateWindow(Instant startsAt, Instant expiresAt) {
        if (startsAt != null && expiresAt != null && !expiresAt.isAfter(startsAt)) {
            throw new IllegalArgumentException("Ngày hết hạn redeem phải sau ngày bắt đầu.");
        }
    }

    private static Instant parseOptionalInstant(String value, String label) {
        String clean = clean(value);
        if (clean.isEmpty()) {
            return null;
        }
        try {
            return Instant.parse(clean);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException(label + " không hợp lệ.");
        }
    }

    private static String cleanReason(String value) {
        String clean = clean(value);
        if (clean.isEmpty()) {
            throw new IllegalArgumentException("Lý do thao tác không được để trống.");
        }
        return clean.length() <= 500 ? clean : clean.substring(0, 500);
    }

    private static String cleanNullable(String value, int maxLength) {
        String clean = clean(value);
        if (clean.isEmpty()) {
            return null;
        }
        return clean.length() <= maxLength ? clean : clean.substring(0, maxLength);
    }

    private static String normalizePlanCode(String value) {
        return String.valueOf(value == null ? "" : value)
                .trim()
                .toUpperCase(Locale.ROOT);
    }

    private static String clean(String value) {
        return String.valueOf(value == null ? "" : value).trim();
    }

    private static String generateLicenseKey() {
        StringBuilder raw = new StringBuilder(20);
        for (int i = 0; i < 20; i++) {
            raw.append(KEY_ALPHABET.charAt(RANDOM.nextInt(KEY_ALPHABET.length())));
        }
        return "AIT-"
                + raw.substring(0, 4) + "-"
                + raw.substring(4, 8) + "-"
                + raw.substring(8, 12) + "-"
                + raw.substring(12, 16) + "-"
                + raw.substring(16, 20);
    }

    private static String normalizeLicenseKey(String value) {
        return clean(value)
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]", "");
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(
                    digest.digest(value.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 không khả dụng.", ex);
        }
    }

    private static Timestamp toTimestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private static Instant toInstant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private static Long nullableLong(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    private static String valueOrNone(Instant value) {
        return value == null ? "none" : value.toString();
    }

    private record ActivationRow(
            long id,
            long userId,
            String status,
            Instant activatedAt
    ) {
    }
}

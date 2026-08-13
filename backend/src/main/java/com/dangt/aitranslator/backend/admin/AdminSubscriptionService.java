package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class AdminSubscriptionService {

    private static final Set<String> GRANTABLE_STATUSES =
            Set.of("ACTIVE", "TRIAL", "GRANDFATHERED");

    private final JdbcTemplate jdbcTemplate;
    private final AdminGuard adminGuard;
    private final AdminAuditService auditService;

    public AdminSubscriptionService(
            JdbcTemplate jdbcTemplate,
            AdminGuard adminGuard,
            AdminAuditService auditService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.adminGuard = adminGuard;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<AdminSubscriptionResponse> listForUser(long userId) {
        requireTarget(userId, null);
        return jdbcTemplate.query(
                subscriptionSelectSql()
                        + " WHERE s.user_id = ? ORDER BY s.id DESC",
                (rs, rowNum) -> mapSubscription(rs),
                userId
        );
    }

    @Transactional
    public AdminSubscriptionResponse create(
            UserAccount actor,
            long userId,
            AdminSubscriptionCreateRequest request
    ) {
        TargetUser target = requireTarget(userId, actor);
        String planCode = normalizePlan(request.planCode());
        String status = normalizeGrantableStatus(request.status());
        String reason = cleanReason(request.reason());
        Instant startsAt = parseOptionalInstant(request.startsAt(), "Ngày bắt đầu");
        if (startsAt == null) {
            startsAt = Instant.now();
        }
        Instant endsAt = parseOptionalInstant(request.endsAt(), "Ngày kết thúc");

        PlanState plan = requireActivePlan(planCode);
        PriceState price = request.priceId() == null
                ? null
                : requirePrice(request.priceId(), planCode);

        if (endsAt == null && price != null) {
            endsAt = defaultEnd(startsAt, price.billingPeriod());
        }
        validateWindow(startsAt, endsAt);

        Long monthlyLimit = jdbcTemplate.queryForObject(
                """
                SELECT COALESCE(MAX(limit_value), 0)
                FROM plan_limits
                WHERE plan_code = ?
                  AND limit_key = 'monthlyTranslations'
                """,
                Long.class,
                planCode
        );

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
                ) VALUES (?, ?, ?, 'ADMIN', NULL, ?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                """,
                userId,
                planCode,
                status,
                price == null ? null : price.id(),
                monthlyLimit == null ? 0L : monthlyLimit,
                Timestamp.from(startsAt),
                toTimestamp(endsAt)
        );

        Long subscriptionId = jdbcTemplate.queryForObject(
                "SELECT LAST_INSERT_ID()",
                Long.class
        );
        if (subscriptionId == null || subscriptionId <= 0) {
            throw new IllegalStateException("Không xác định được subscription vừa tạo.");
        }

        auditService.record(
                actor.getId(),
                "SUBSCRIPTION_CREATED",
                target.id(),
                "subscriptionId=" + subscriptionId
                        + "; plan=" + plan.code()
                        + "; status=" + status
                        + "; source=ADMIN"
                        + "; priceId=" + (price == null ? "none" : price.id())
                        + "; startsAt=" + startsAt
                        + "; endsAt=" + (endsAt == null ? "none" : endsAt)
                        + "; reason=" + reason
        );

        return requireSubscription(subscriptionId);
    }

    @Transactional
    public AdminSubscriptionResponse extend(
            UserAccount actor,
            long subscriptionId,
            AdminSubscriptionExtendRequest request
    ) {
        AdminSubscriptionResponse before = requireSubscriptionForUpdate(subscriptionId);
        requireTarget(before.userId(), actor);
        requireAdminManaged(before);

        if ("CANCELED".equalsIgnoreCase(before.status())) {
            throw new IllegalArgumentException(
                    "Subscription đã hủy là trạng thái cuối. Hãy tạo subscription mới."
            );
        }

        if (before.periodEnd() == null) {
            throw new IllegalArgumentException(
                    "Subscription không có ngày hết hạn nên không cần gia hạn."
            );
        }

        Instant newEnd = parseRequiredInstant(request.endsAt(), "Ngày hết hạn mới");
        Instant start = before.periodStart() == null ? Instant.now() : before.periodStart();
        validateWindow(start, newEnd);

        if (!newEnd.isAfter(before.periodEnd())) {
            throw new IllegalArgumentException(
                    "Ngày hết hạn mới phải sau ngày hết hạn hiện tại."
            );
        }
        if (!newEnd.isAfter(Instant.now())) {
            throw new IllegalArgumentException("Ngày hết hạn mới phải ở tương lai.");
        }

        jdbcTemplate.update(
                """
                UPDATE subscriptions
                SET period_end = ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                Timestamp.from(newEnd),
                subscriptionId
        );

        auditService.record(
                actor.getId(),
                "SUBSCRIPTION_EXTENDED",
                before.userId(),
                "subscriptionId=" + subscriptionId
                        + "; plan=" + before.planCode()
                        + "; oldEnd=" + (before.periodEnd() == null ? "none" : before.periodEnd())
                        + "; newEnd=" + newEnd
                        + "; reason=" + cleanReason(request.reason())
        );

        return requireSubscription(subscriptionId);
    }

    @Transactional
    public AdminSubscriptionResponse cancel(
            UserAccount actor,
            long subscriptionId,
            AdminReasonRequest request
    ) {
        AdminSubscriptionResponse before = requireSubscriptionForUpdate(subscriptionId);
        requireTarget(before.userId(), actor);
        requireAdminManaged(before);

        if ("CANCELED".equalsIgnoreCase(before.status())) {
            return before;
        }

        String reason = cleanReason(request.reason());
        jdbcTemplate.update(
                """
                UPDATE subscriptions
                SET status = 'CANCELED',
                    canceled_at = CURRENT_TIMESTAMP(6),
                    cancel_reason = ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                reason,
                subscriptionId
        );

        auditService.record(
                actor.getId(),
                "SUBSCRIPTION_CANCELED",
                before.userId(),
                "subscriptionId=" + subscriptionId
                        + "; plan=" + before.planCode()
                        + "; previousStatus=" + before.status()
                        + "; reason=" + reason
        );

        return requireSubscription(subscriptionId);
    }

    private AdminSubscriptionResponse requireSubscription(long subscriptionId) {
        List<AdminSubscriptionResponse> rows = jdbcTemplate.query(
                subscriptionSelectSql() + " WHERE s.id = ? LIMIT 1",
                (rs, rowNum) -> mapSubscription(rs),
                subscriptionId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy subscription.");
        }
        return rows.getFirst();
    }

    private AdminSubscriptionResponse requireSubscriptionForUpdate(long subscriptionId) {
        List<AdminSubscriptionResponse> rows = jdbcTemplate.query(
                subscriptionSelectSql() + " WHERE s.id = ? LIMIT 1 FOR UPDATE",
                (rs, rowNum) -> mapSubscription(rs),
                subscriptionId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy subscription.");
        }
        return rows.getFirst();
    }

    private TargetUser requireTarget(long userId, UserAccount actor) {
        List<TargetUser> rows = jdbcTemplate.query(
                "SELECT id, email, role FROM users WHERE id = ? LIMIT 1",
                (rs, rowNum) -> new TargetUser(
                        rs.getLong("id"),
                        rs.getString("email"),
                        rs.getString("role")
                ),
                userId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy user.");
        }
        TargetUser target = rows.getFirst();
        if (actor != null
                && adminGuard.isAdminRole(target.role())
                && !adminGuard.isSuperAdmin(actor)) {
            throw new ForbiddenException(
                    "Chỉ SUPER_ADMIN được quản lý subscription của tài khoản Admin khác."
            );
        }
        return target;
    }

    private PlanState requireActivePlan(String planCode) {
        List<PlanState> rows = jdbcTemplate.query(
                "SELECT code, active FROM plan_catalog WHERE code = ? LIMIT 1",
                (rs, rowNum) -> new PlanState(
                        rs.getString("code"),
                        rs.getBoolean("active")
                ),
                planCode
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Plan không tồn tại.");
        }
        PlanState plan = rows.getFirst();
        if (!plan.active()) {
            throw new IllegalArgumentException(
                    "Không thể cấp subscription cho plan đang bị tắt."
            );
        }
        return plan;
    }

    private PriceState requirePrice(long priceId, String planCode) {
        List<PriceState> rows = jdbcTemplate.query(
                """
                SELECT id, plan_code, billing_period, active
                FROM plan_prices
                WHERE id = ?
                LIMIT 1
                """,
                (rs, rowNum) -> new PriceState(
                        rs.getLong("id"),
                        rs.getString("plan_code"),
                        rs.getString("billing_period"),
                        rs.getBoolean("active")
                ),
                priceId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Price không tồn tại.");
        }
        PriceState price = rows.getFirst();
        if (!price.planCode().equals(planCode)) {
            throw new IllegalArgumentException("Price không thuộc plan đã chọn.");
        }
        if (!price.active()) {
            throw new IllegalArgumentException("Không thể gắn price đang inactive.");
        }
        return price;
    }

    private static void requireAdminManaged(AdminSubscriptionResponse subscription) {
        if (!"ADMIN".equalsIgnoreCase(subscription.source())) {
            throw new IllegalArgumentException(
                    "Subscription source=" + subscription.source()
                            + " không được sửa bằng Admin Subscription Lifecycle."
            );
        }
    }

    private static String normalizePlan(String value) {
        String clean = String.valueOf(value == null ? "" : value)
                .trim()
                .toUpperCase(Locale.ROOT);
        if (!clean.matches("[A-Z0-9_]{2,30}")) {
            throw new IllegalArgumentException("Plan code không hợp lệ.");
        }
        return clean;
    }

    private static String normalizeGrantableStatus(String value) {
        String clean = String.valueOf(value == null ? "ACTIVE" : value)
                .trim()
                .toUpperCase(Locale.ROOT);
        if (clean.isEmpty()) {
            clean = "ACTIVE";
        }
        if (!GRANTABLE_STATUSES.contains(clean)) {
            throw new IllegalArgumentException(
                    "Status chỉ hỗ trợ ACTIVE, TRIAL hoặc GRANDFATHERED."
            );
        }
        return clean;
    }

    private static Instant parseOptionalInstant(String value, String label) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        return clean.isEmpty() ? null : parseRequiredInstant(clean, label);
    }

    private static Instant parseRequiredInstant(String value, String label) {
        try {
            return Instant.parse(String.valueOf(value).trim());
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException(
                    label + " phải là ISO-8601 UTC, ví dụ 2026-12-31T23:59:59Z."
            );
        }
    }

    private static void validateWindow(Instant startsAt, Instant endsAt) {
        if (endsAt != null && !startsAt.isBefore(endsAt)) {
            throw new IllegalArgumentException("Ngày kết thúc phải sau ngày bắt đầu.");
        }
    }

    private static Instant defaultEnd(Instant startsAt, String billingPeriod) {
        return switch (String.valueOf(billingPeriod).toUpperCase(Locale.ROOT)) {
            case "MONTHLY" -> startsAt.atZone(ZoneOffset.UTC).plusMonths(1).toInstant();
            case "YEARLY" -> startsAt.atZone(ZoneOffset.UTC).plusYears(1).toInstant();
            case "LIFETIME" -> null;
            default -> throw new IllegalArgumentException("Billing period của price không hợp lệ.");
        };
    }

    private static String cleanReason(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isEmpty()) {
            throw new IllegalArgumentException("Cần nhập lý do thao tác.");
        }
        return clean.length() <= 500 ? clean : clean.substring(0, 500);
    }

    private static AdminSubscriptionResponse mapSubscription(ResultSet rs) throws SQLException {
        String status = rs.getString("status");
        Instant periodStart = toInstant(rs.getTimestamp("period_start"));
        Instant periodEnd = toInstant(rs.getTimestamp("period_end"));
        Instant canceledAt = toInstant(rs.getTimestamp("canceled_at"));

        return new AdminSubscriptionResponse(
                rs.getLong("id"),
                rs.getLong("user_id"),
                rs.getString("user_email"),
                rs.getString("plan"),
                rs.getString("plan_display_name"),
                status,
                effectiveStatus(status, periodStart, periodEnd),
                rs.getString("source"),
                nullableLong(rs.getObject("reference_id")),
                nullableLong(rs.getObject("price_id")),
                rs.getString("price_billing_period"),
                rs.getString("price_currency"),
                nullableLong(rs.getObject("price_amount_minor")),
                rs.getLong("monthly_translation_limit"),
                periodStart,
                periodEnd,
                canceledAt,
                rs.getString("cancel_reason"),
                toInstant(rs.getTimestamp("created_at")),
                toInstant(rs.getTimestamp("updated_at"))
        );
    }

    private static String effectiveStatus(
            String storedStatus,
            Instant periodStart,
            Instant periodEnd
    ) {
        String status = String.valueOf(storedStatus == null ? "" : storedStatus)
                .toUpperCase(Locale.ROOT);
        if ("CANCELED".equals(status)) {
            return "CANCELED";
        }
        Instant now = Instant.now();
        if (periodStart != null && periodStart.isAfter(now)) {
            return "SCHEDULED";
        }
        if (periodEnd != null && !periodEnd.isAfter(now)) {
            return "EXPIRED";
        }
        return status;
    }

    private static String subscriptionSelectSql() {
        return """
                SELECT s.id,
                       s.user_id,
                       u.email AS user_email,
                       s.plan,
                       p.display_name AS plan_display_name,
                       s.status,
                       s.source,
                       s.reference_id,
                       s.price_id,
                       pp.billing_period AS price_billing_period,
                       pp.currency AS price_currency,
                       pp.amount_minor AS price_amount_minor,
                       s.monthly_translation_limit,
                       s.period_start,
                       s.period_end,
                       s.canceled_at,
                       s.cancel_reason,
                       s.created_at,
                       s.updated_at
                FROM subscriptions s
                INNER JOIN users u ON u.id = s.user_id
                LEFT JOIN plan_catalog p ON p.code = s.plan
                LEFT JOIN plan_prices pp ON pp.id = s.price_id
                """;
    }

    private static Long nullableLong(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    private static Timestamp toTimestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private static Instant toInstant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private record TargetUser(long id, String email, String role) {
    }

    private record PlanState(String code, boolean active) {
    }

    private record PriceState(
            long id,
            String planCode,
            String billingPeriod,
            boolean active
    ) {
    }
}

package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.billing.RevenueNormalizationService;
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
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class AdminTransactionService {

    private final JdbcTemplate jdbcTemplate;
    private final AdminGuard adminGuard;
    private final AdminAuditService auditService;
    private final RevenueNormalizationService revenueNormalizationService;

    public AdminTransactionService(
            JdbcTemplate jdbcTemplate,
            AdminGuard adminGuard,
            AdminAuditService auditService,
            RevenueNormalizationService revenueNormalizationService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.adminGuard = adminGuard;
        this.auditService = auditService;
        this.revenueNormalizationService = revenueNormalizationService;
    }

    @Transactional(readOnly = true)
    public List<AdminTransactionResponse> list(
            String requestedStatus,
            String requestedPlanCode,
            String requestedProvider,
            int requestedLimit
    ) {
        String status = normalizeOptionalToken(requestedStatus, 30, "status");
        String planCode = normalizeOptionalToken(requestedPlanCode, 30, "plan");
        String provider = normalizeOptionalToken(requestedProvider, 30, "provider");
        int limit = Math.max(1, Math.min(requestedLimit, 500));

        StringBuilder sql = new StringBuilder(transactionSelectSql()).append(" WHERE 1=1");
        java.util.ArrayList<Object> args = new java.util.ArrayList<>();
        if (status != null) {
            sql.append(" AND pt.status = ?");
            args.add(status);
        }
        if (planCode != null) {
            sql.append(" AND pt.plan_code = ?");
            args.add(planCode);
        }
        if (provider != null) {
            sql.append(" AND pt.provider = ?");
            args.add(provider);
        }
        sql.append(" ORDER BY pt.id DESC LIMIT ?");
        args.add(limit);

        return jdbcTemplate.query(
                sql.toString(),
                (rs, rowNum) -> mapTransaction(rs),
                args.toArray()
        );
    }

    @Transactional(readOnly = true)
    public AdminTransactionResponse detail(long transactionId) {
        return requireTransaction(transactionId, false);
    }

    @Transactional
    public AdminTransactionResponse createManual(
            UserAccount actor,
            AdminTransactionCreateRequest request
    ) {
        requireSuperAdmin(actor);
        long userId = requirePositive(request.userId(), "User ID");
        long priceId = requirePositive(request.priceId(), "Price ID");
        String reason = cleanReason(request.reason());
        String providerReference = cleanOptional(request.providerReference(), 190);

        TargetUser user = requireActiveUser(userId);
        PriceSnapshot price = requireSellablePrice(priceId);
        requireActivePlan(price.planCode());

        String publicId = "AIT-TX-" + UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT);
        jdbcTemplate.update(
                """
                INSERT INTO payment_transactions (
                    public_id,
                    user_id,
                    plan_code,
                    price_id,
                    billing_period,
                    currency,
                    amount_minor,
                    refunded_amount_minor,
                    provider,
                    provider_reference,
                    idempotency_key,
                    status,
                    subscription_id,
                    created_by_user_id,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'MANUAL', ?, NULL, 'PENDING', NULL, ?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                """,
                publicId,
                user.id(),
                price.planCode(),
                price.id(),
                price.billingPeriod(),
                price.currency(),
                price.amountMinor(),
                providerReference,
                actor.getId()
        );

        Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        if (id == null || id <= 0) {
            throw new IllegalStateException("Không xác định được transaction vừa tạo.");
        }

        auditService.record(
                actor.getId(),
                "PAYMENT_TRANSACTION_CREATED",
                user.id(),
                "transactionId=" + id
                        + "; publicId=" + publicId
                        + "; provider=MANUAL"
                        + "; plan=" + price.planCode()
                        + "; priceId=" + price.id()
                        + "; amountMinor=" + price.amountMinor()
                        + "; currency=" + price.currency()
                        + "; reason=" + reason
        );
        return requireTransaction(id, false);
    }

    @Transactional
    public AdminTransactionResponse settle(
            UserAccount actor,
            long transactionId,
            AdminTransactionSettleRequest request
    ) {
        requireSuperAdmin(actor);
        AdminTransactionResponse before = requireTransaction(transactionId, true);
        requireStatus(before, "PENDING");
        requireActivePlan(before.planCode());

        String reason = cleanReason(request.reason());
        String providerReference = cleanOptional(request.providerReference(), 190);
        if (providerReference == null) {
            providerReference = cleanOptional(before.providerReference(), 190);
        }

        Instant paidAt = Instant.now();
        Long monthlyLimit = jdbcTemplate.queryForObject(
                """
                SELECT COALESCE(MAX(limit_value), 0)
                FROM plan_limits
                WHERE plan_code = ?
                  AND limit_key = 'monthlyTranslations'
                """,
                Long.class,
                before.planCode()
        );
        Instant periodEnd = defaultEnd(paidAt, before.billingPeriod());

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
                ) VALUES (?, ?, 'ACTIVE', 'PAYMENT', ?, ?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                """,
                before.userId(),
                before.planCode(),
                before.id(),
                before.priceId(),
                monthlyLimit == null ? 0L : monthlyLimit,
                Timestamp.from(paidAt),
                toTimestamp(periodEnd)
        );

        Long subscriptionId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        if (subscriptionId == null || subscriptionId <= 0) {
            throw new IllegalStateException("Không xác định được subscription từ payment.");
        }

        jdbcTemplate.update(
                """
                UPDATE payment_transactions
                SET status = 'SUCCEEDED',
                    provider_reference = ?,
                    subscription_id = ?,
                    paid_at = ?,
                    failure_code = NULL,
                    failure_message = NULL,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                providerReference,
                subscriptionId,
                Timestamp.from(paidAt),
                transactionId
        );

        revenueNormalizationService.normalizeTransaction(transactionId);

        auditService.record(
                actor.getId(),
                "PAYMENT_TRANSACTION_SETTLED",
                before.userId(),
                "transactionId=" + transactionId
                        + "; subscriptionId=" + subscriptionId
                        + "; plan=" + before.planCode()
                        + "; amountMinor=" + before.amountMinor()
                        + "; currency=" + before.currency()
                        + "; reason=" + reason
        );
        return requireTransaction(transactionId, false);
    }

    @Transactional
    public AdminTransactionResponse fail(
            UserAccount actor,
            long transactionId,
            AdminTransactionFailureRequest request
    ) {
        requireSuperAdmin(actor);
        AdminTransactionResponse before = requireTransaction(transactionId, true);
        requireStatus(before, "PENDING");
        String reason = cleanReason(request.reason());
        String failureCode = cleanOptional(request.failureCode(), 100);
        String failureMessage = cleanOptional(request.failureMessage(), 500);

        jdbcTemplate.update(
                """
                UPDATE payment_transactions
                SET status = 'FAILED',
                    failure_code = ?,
                    failure_message = ?,
                    failed_at = CURRENT_TIMESTAMP(6),
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                failureCode,
                failureMessage,
                transactionId
        );

        auditService.record(
                actor.getId(),
                "PAYMENT_TRANSACTION_FAILED",
                before.userId(),
                "transactionId=" + transactionId
                        + "; failureCode=" + String.valueOf(failureCode)
                        + "; reason=" + reason
        );
        return requireTransaction(transactionId, false);
    }

    @Transactional
    public AdminTransactionResponse cancel(
            UserAccount actor,
            long transactionId,
            AdminReasonRequest request
    ) {
        requireSuperAdmin(actor);
        AdminTransactionResponse before = requireTransaction(transactionId, true);
        requireStatus(before, "PENDING");
        String reason = cleanReason(request.reason());

        jdbcTemplate.update(
                """
                UPDATE payment_transactions
                SET status = 'CANCELED',
                    canceled_at = CURRENT_TIMESTAMP(6),
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                transactionId
        );

        auditService.record(
                actor.getId(),
                "PAYMENT_TRANSACTION_CANCELED",
                before.userId(),
                "transactionId=" + transactionId + "; reason=" + reason
        );
        return requireTransaction(transactionId, false);
    }

    @Transactional
    public AdminTransactionResponse refund(
            UserAccount actor,
            long transactionId,
            AdminReasonRequest request
    ) {
        requireSuperAdmin(actor);
        AdminTransactionResponse before = requireTransaction(transactionId, true);
        requireStatus(before, "SUCCEEDED");
        String reason = cleanReason(request.reason());

        if (before.subscriptionId() != null) {
            jdbcTemplate.update(
                    """
                    UPDATE subscriptions
                    SET status = 'CANCELED',
                        canceled_at = CURRENT_TIMESTAMP(6),
                        cancel_reason = ?,
                        updated_at = CURRENT_TIMESTAMP(6)
                    WHERE id = ?
                      AND source = 'PAYMENT'
                      AND reference_id = ?
                    """,
                    truncate("Payment refunded: " + reason, 500),
                    before.subscriptionId(),
                    transactionId
            );
        }

        jdbcTemplate.update(
                """
                UPDATE payment_transactions
                SET status = 'REFUNDED',
                    refunded_amount_minor = amount_minor,
                    refunded_at = CURRENT_TIMESTAMP(6),
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                transactionId
        );

        revenueNormalizationService.normalizeTransaction(transactionId);

        auditService.record(
                actor.getId(),
                "PAYMENT_TRANSACTION_REFUNDED",
                before.userId(),
                "transactionId=" + transactionId
                        + "; subscriptionId=" + String.valueOf(before.subscriptionId())
                        + "; amountMinor=" + before.amountMinor()
                        + "; currency=" + before.currency()
                        + "; reason=" + reason
        );
        return requireTransaction(transactionId, false);
    }

    private AdminTransactionResponse requireTransaction(long transactionId, boolean forUpdate) {
        String suffix = forUpdate ? " WHERE pt.id = ? LIMIT 1 FOR UPDATE" : " WHERE pt.id = ? LIMIT 1";
        List<AdminTransactionResponse> rows = jdbcTemplate.query(
                transactionSelectSql() + suffix,
                (rs, rowNum) -> mapTransaction(rs),
                transactionId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy payment transaction.");
        }
        return rows.getFirst();
    }

    private TargetUser requireActiveUser(long userId) {
        List<TargetUser> rows = jdbcTemplate.query(
                "SELECT id, email, status FROM users WHERE id = ? LIMIT 1",
                (rs, rowNum) -> new TargetUser(
                        rs.getLong("id"),
                        rs.getString("email"),
                        rs.getString("status")
                ),
                userId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy user.");
        }
        TargetUser user = rows.getFirst();
        if (!"ACTIVE".equalsIgnoreCase(user.status())) {
            throw new IllegalArgumentException("Không thể tạo payment cho user đang bị khóa.");
        }
        return user;
    }

    private PriceSnapshot requireSellablePrice(long priceId) {
        List<PriceSnapshot> rows = jdbcTemplate.query(
                """
                SELECT pp.id,
                       pp.plan_code,
                       pp.billing_period,
                       pp.currency,
                       pp.amount_minor,
                       pp.active,
                       pp.sellable,
                       pp.starts_at,
                       pp.ends_at
                FROM plan_prices pp
                WHERE pp.id = ?
                LIMIT 1
                """,
                (rs, rowNum) -> new PriceSnapshot(
                        rs.getLong("id"),
                        rs.getString("plan_code"),
                        rs.getString("billing_period"),
                        rs.getString("currency"),
                        rs.getLong("amount_minor"),
                        rs.getBoolean("active"),
                        rs.getBoolean("sellable"),
                        toInstant(rs.getTimestamp("starts_at")),
                        toInstant(rs.getTimestamp("ends_at"))
                ),
                priceId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Price không tồn tại.");
        }
        PriceSnapshot price = rows.getFirst();
        Instant now = Instant.now();
        boolean available = price.active()
                && price.sellable()
                && (price.startsAt() == null || !price.startsAt().isAfter(now))
                && (price.endsAt() == null || price.endsAt().isAfter(now));
        if (!available) {
            throw new IllegalArgumentException("Price hiện không ở trạng thái ON SALE.");
        }
        return price;
    }

    private void requireActivePlan(String planCode) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM plan_catalog WHERE code = ? AND active = TRUE",
                Integer.class,
                planCode
        );
        if (count == null || count == 0) {
            throw new IllegalArgumentException("Plan hiện đang bị tắt.");
        }
    }

    private void requireSuperAdmin(UserAccount actor) {
        if (!adminGuard.isSuperAdmin(actor)) {
            throw new ForbiddenException("Chỉ SUPER_ADMIN được thay đổi trạng thái payment transaction.");
        }
    }

    private static void requireStatus(AdminTransactionResponse transaction, String expected) {
        if (!expected.equalsIgnoreCase(transaction.status())) {
            throw new IllegalArgumentException(
                    "Transaction phải ở trạng thái " + expected + " nhưng hiện là " + transaction.status() + "."
            );
        }
    }

    private static long requirePositive(Long value, String label) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException(label + " không hợp lệ.");
        }
        return value;
    }

    private static String normalizeOptionalToken(String value, int max, String label) {
        String clean = cleanOptional(value, max);
        if (clean == null) {
            return null;
        }
        clean = clean.toUpperCase(Locale.ROOT);
        if (!clean.matches("[A-Z0-9_]{2," + max + "}")) {
            throw new IllegalArgumentException(label + " không hợp lệ.");
        }
        return clean;
    }

    private static String cleanReason(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isEmpty()) {
            throw new IllegalArgumentException("Cần nhập lý do thao tác.");
        }
        return clean.length() <= 500 ? clean : clean.substring(0, 500);
    }

    private static String cleanOptional(String value, int max) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isEmpty()) {
            return null;
        }
        return truncate(clean, max);
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static Instant defaultEnd(Instant startsAt, String billingPeriod) {
        return switch (String.valueOf(billingPeriod).toUpperCase(Locale.ROOT)) {
            case "MONTHLY" -> startsAt.atZone(ZoneOffset.UTC).plusMonths(1).toInstant();
            case "YEARLY" -> startsAt.atZone(ZoneOffset.UTC).plusYears(1).toInstant();
            case "LIFETIME" -> null;
            default -> throw new IllegalArgumentException("Billing period của transaction không hợp lệ.");
        };
    }

    private static AdminTransactionResponse mapTransaction(ResultSet rs) throws SQLException {
        return new AdminTransactionResponse(
                rs.getLong("id"),
                rs.getString("public_id"),
                rs.getLong("user_id"),
                rs.getString("user_email"),
                rs.getString("plan_code"),
                rs.getString("plan_display_name"),
                nullableLong(rs.getObject("price_id")),
                rs.getString("billing_period"),
                rs.getString("currency"),
                rs.getLong("amount_minor"),
                rs.getLong("refunded_amount_minor"),
                rs.getString("reporting_currency"),
                nullableLong(rs.getObject("fx_rate_id")),
                rs.getBigDecimal("fx_rate"),
                rs.getBigDecimal("gross_amount_reporting"),
                rs.getBigDecimal("refunded_amount_reporting"),
                rs.getBigDecimal("net_amount_reporting"),
                rs.getString("revenue_status"),
                toInstant(rs.getTimestamp("revenue_normalized_at")),
                rs.getString("provider"),
                rs.getString("provider_reference"),
                rs.getString("status"),
                nullableLong(rs.getObject("subscription_id")),
                rs.getString("failure_code"),
                rs.getString("failure_message"),
                toInstant(rs.getTimestamp("paid_at")),
                toInstant(rs.getTimestamp("failed_at")),
                toInstant(rs.getTimestamp("canceled_at")),
                toInstant(rs.getTimestamp("refunded_at")),
                nullableLong(rs.getObject("created_by_user_id")),
                rs.getString("created_by_email"),
                toInstant(rs.getTimestamp("created_at")),
                toInstant(rs.getTimestamp("updated_at"))
        );
    }

    private static String transactionSelectSql() {
        return """
                SELECT pt.id,
                       pt.public_id,
                       pt.user_id,
                       u.email AS user_email,
                       pt.plan_code,
                       p.display_name AS plan_display_name,
                       pt.price_id,
                       pt.billing_period,
                       pt.currency,
                       pt.amount_minor,
                       pt.refunded_amount_minor,
                       pt.reporting_currency,
                       pt.fx_rate_id,
                       pt.fx_rate,
                       pt.gross_amount_reporting,
                       pt.refunded_amount_reporting,
                       pt.net_amount_reporting,
                       pt.revenue_status,
                       pt.revenue_normalized_at,
                       pt.provider,
                       pt.provider_reference,
                       pt.status,
                       pt.subscription_id,
                       pt.failure_code,
                       pt.failure_message,
                       pt.paid_at,
                       pt.failed_at,
                       pt.canceled_at,
                       pt.refunded_at,
                       pt.created_by_user_id,
                       creator.email AS created_by_email,
                       pt.created_at,
                       pt.updated_at
                FROM payment_transactions pt
                INNER JOIN users u ON u.id = pt.user_id
                LEFT JOIN plan_catalog p ON p.code = pt.plan_code
                LEFT JOIN users creator ON creator.id = pt.created_by_user_id
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

    private record TargetUser(long id, String email, String status) {
    }

    private record PriceSnapshot(
            long id,
            String planCode,
            String billingPeriod,
            String currency,
            long amountMinor,
            boolean active,
            boolean sellable,
            Instant startsAt,
            Instant endsAt
    ) {
    }
}

package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.common.ConflictException;
import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class AdminPricingService {

    private static final Set<String> BILLING_PERIODS =
            Set.of("MONTHLY", "YEARLY", "LIFETIME");

    private final JdbcTemplate jdbcTemplate;
    private final AdminAuditService auditService;

    public AdminPricingService(
            JdbcTemplate jdbcTemplate,
            AdminAuditService auditService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<AdminPriceResponse> listPrices(String requestedPlanCode) {
        String planCode = normalizeOptionalPlanCode(requestedPlanCode);
        if (planCode == null) {
            return jdbcTemplate.query(
                    priceSelectSql() + " ORDER BY p.rank_order, pp.billing_period, pp.currency, pp.id DESC",
                    (rs, rowNum) -> mapPrice(rs)
            );
        }

        requirePlan(planCode);
        return jdbcTemplate.query(
                priceSelectSql() + " WHERE pp.plan_code = ? ORDER BY pp.billing_period, pp.currency, pp.id DESC",
                (rs, rowNum) -> mapPrice(rs),
                planCode
        );
    }

    @Transactional(readOnly = true)
    public AdminPriceResponse price(long priceId) {
        return requirePrice(priceId);
    }

    @Transactional
    public AdminPriceResponse createPrice(
            UserAccount actor,
            AdminPriceCreateRequest request
    ) {
        String planCode = normalizePlanCode(request.planCode());
        String billingPeriod = normalizeBillingPeriod(request.billingPeriod());
        String currency = normalizeCurrency(request.currency());
        long amountMinor = request.amountMinor();
        Long compareAtAmountMinor = request.compareAtAmountMinor();
        boolean active = request.active() == null || request.active();
        boolean sellable = request.sellable() != null && request.sellable();
        Instant startsAt = parseOptionalInstant(request.startsAt(), "Ngày bắt đầu");
        Instant endsAt = parseOptionalInstant(request.endsAt(), "Ngày kết thúc");
        String reason = cleanReason(request.reason());

        PlanState plan = requirePlan(planCode);
        validateDefinition(
                plan,
                amountMinor,
                compareAtAmountMinor,
                active,
                sellable,
                startsAt,
                endsAt
        );
        requireNoSellableOverlap(
                null,
                planCode,
                billingPeriod,
                currency,
                active,
                sellable,
                startsAt,
                endsAt
        );

        jdbcTemplate.update(
                """
                INSERT INTO plan_prices (
                    plan_code,
                    billing_period,
                    currency,
                    amount_minor,
                    compare_at_amount_minor,
                    active,
                    sellable,
                    starts_at,
                    ends_at,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                """,
                planCode,
                billingPeriod,
                currency,
                amountMinor,
                compareAtAmountMinor,
                active,
                sellable,
                toTimestamp(startsAt),
                toTimestamp(endsAt)
        );

        Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        if (id == null || id <= 0) {
            throw new IllegalStateException("Không xác định được ID giá vừa tạo.");
        }

        auditService.record(
                actor.getId(),
                "PRICE_CREATED",
                null,
                "priceId=" + id
                        + "; plan=" + planCode
                        + "; period=" + billingPeriod
                        + "; currency=" + currency
                        + "; amountMinor=" + amountMinor
                        + "; sellable=" + sellable
                        + "; reason=" + reason
        );

        return requirePrice(id);
    }

    @Transactional
    public AdminPriceResponse updatePrice(
            UserAccount actor,
            long priceId,
            AdminPriceUpdateRequest request
    ) {
        AdminPriceResponse before = requirePrice(priceId);
        String planCode = normalizePlanCode(request.planCode());
        String billingPeriod = normalizeBillingPeriod(request.billingPeriod());
        String currency = normalizeCurrency(request.currency());
        long amountMinor = request.amountMinor();
        Long compareAtAmountMinor = request.compareAtAmountMinor();
        boolean active = request.active();
        boolean sellable = request.sellable();
        Instant startsAt = parseOptionalInstant(request.startsAt(), "Ngày bắt đầu");
        Instant endsAt = parseOptionalInstant(request.endsAt(), "Ngày kết thúc");
        String reason = cleanReason(request.reason());

        PlanState plan = requirePlan(planCode);
        validateDefinition(
                plan,
                amountMinor,
                compareAtAmountMinor,
                active,
                sellable,
                startsAt,
                endsAt
        );
        requireNoSellableOverlap(
                priceId,
                planCode,
                billingPeriod,
                currency,
                active,
                sellable,
                startsAt,
                endsAt
        );

        jdbcTemplate.update(
                """
                UPDATE plan_prices
                SET plan_code = ?,
                    billing_period = ?,
                    currency = ?,
                    amount_minor = ?,
                    compare_at_amount_minor = ?,
                    active = ?,
                    sellable = ?,
                    starts_at = ?,
                    ends_at = ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                planCode,
                billingPeriod,
                currency,
                amountMinor,
                compareAtAmountMinor,
                active,
                sellable,
                toTimestamp(startsAt),
                toTimestamp(endsAt),
                priceId
        );

        auditService.record(
                actor.getId(),
                "PRICE_UPDATED",
                null,
                "priceId=" + priceId
                        + "; plan=" + before.planCode() + "->" + planCode
                        + "; period=" + before.billingPeriod() + "->" + billingPeriod
                        + "; currency=" + before.currency() + "->" + currency
                        + "; amountMinor=" + before.amountMinor() + "->" + amountMinor
                        + "; active=" + before.active() + "->" + active
                        + "; sellable=" + before.sellable() + "->" + sellable
                        + "; reason=" + reason
        );

        return requirePrice(priceId);
    }

    private AdminPriceResponse requirePrice(long priceId) {
        List<AdminPriceResponse> rows = jdbcTemplate.query(
                priceSelectSql() + " WHERE pp.id = ? LIMIT 1",
                (rs, rowNum) -> mapPrice(rs),
                priceId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy cấu hình giá.");
        }
        return rows.getFirst();
    }

    private PlanState requirePlan(String planCode) {
        List<PlanState> rows = jdbcTemplate.query(
                """
                SELECT code, active
                FROM plan_catalog
                WHERE code = ?
                LIMIT 1
                """,
                (rs, rowNum) -> new PlanState(
                        rs.getString("code"),
                        rs.getBoolean("active")
                ),
                planCode
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Plan không tồn tại.");
        }
        return rows.getFirst();
    }

    private void validateDefinition(
            PlanState plan,
            long amountMinor,
            Long compareAtAmountMinor,
            boolean active,
            boolean sellable,
            Instant startsAt,
            Instant endsAt
    ) {
        if (amountMinor < 0) {
            throw new IllegalArgumentException("Giá bán không được âm.");
        }
        if (compareAtAmountMinor != null && compareAtAmountMinor < amountMinor) {
            throw new IllegalArgumentException(
                    "Giá niêm yết phải lớn hơn hoặc bằng giá bán."
            );
        }
        if (startsAt != null && endsAt != null && !startsAt.isBefore(endsAt)) {
            throw new IllegalArgumentException("Ngày kết thúc phải sau ngày bắt đầu.");
        }
        if (sellable && !active) {
            throw new IllegalArgumentException("Giá đang bán phải ở trạng thái active.");
        }
        if (sellable && !plan.active()) {
            throw new IllegalArgumentException(
                    "Không thể mở bán giá của plan đang bị tắt."
            );
        }
    }

    private void requireNoSellableOverlap(
            Long excludedPriceId,
            String planCode,
            String billingPeriod,
            String currency,
            boolean active,
            boolean sellable,
            Instant startsAt,
            Instant endsAt
    ) {
        if (!active || !sellable) {
            return;
        }

        String sql = """
                SELECT id, starts_at, ends_at
                FROM plan_prices
                WHERE plan_code = ?
                  AND billing_period = ?
                  AND currency = ?
                  AND active = TRUE
                  AND sellable = TRUE
                """;

        List<PriceWindow> windows;
        if (excludedPriceId == null) {
            windows = jdbcTemplate.query(
                    sql,
                    (rs, rowNum) -> new PriceWindow(
                            rs.getLong("id"),
                            toInstant(rs.getTimestamp("starts_at")),
                            toInstant(rs.getTimestamp("ends_at"))
                    ),
                    planCode,
                    billingPeriod,
                    currency
            );
        } else {
            windows = jdbcTemplate.query(
                    sql + " AND id <> ?",
                    (rs, rowNum) -> new PriceWindow(
                            rs.getLong("id"),
                            toInstant(rs.getTimestamp("starts_at")),
                            toInstant(rs.getTimestamp("ends_at"))
                    ),
                    planCode,
                    billingPeriod,
                    currency,
                    excludedPriceId
            );
        }

        for (PriceWindow window : windows) {
            if (overlaps(startsAt, endsAt, window.startsAt(), window.endsAt())) {
                throw new ConflictException(
                        "Khoảng thời gian giá bị trùng với price #" + window.id()
                                + " cho " + planCode + " / " + billingPeriod + " / " + currency + "."
                );
            }
        }
    }

    private static boolean overlaps(
            Instant leftStart,
            Instant leftEnd,
            Instant rightStart,
            Instant rightEnd
    ) {
        boolean leftBeforeRightEnd = rightEnd == null
                || leftStart == null
                || leftStart.isBefore(rightEnd);
        boolean rightBeforeLeftEnd = leftEnd == null
                || rightStart == null
                || rightStart.isBefore(leftEnd);
        return leftBeforeRightEnd && rightBeforeLeftEnd;
    }

    private static AdminPriceResponse mapPrice(java.sql.ResultSet rs) throws java.sql.SQLException {
        Instant startsAt = toInstant(rs.getTimestamp("starts_at"));
        Instant endsAt = toInstant(rs.getTimestamp("ends_at"));
        Instant now = Instant.now();
        boolean active = rs.getBoolean("active");
        boolean sellable = rs.getBoolean("sellable");
        boolean planActive = rs.getBoolean("plan_active");
        boolean currentlyAvailable = active
                && sellable
                && planActive
                && (startsAt == null || !startsAt.isAfter(now))
                && (endsAt == null || endsAt.isAfter(now));

        Object compareAt = rs.getObject("compare_at_amount_minor");
        return new AdminPriceResponse(
                rs.getLong("id"),
                rs.getString("plan_code"),
                rs.getString("plan_display_name"),
                rs.getString("billing_period"),
                rs.getString("currency"),
                rs.getLong("amount_minor"),
                compareAt == null ? null : ((Number) compareAt).longValue(),
                active,
                sellable,
                startsAt,
                endsAt,
                currentlyAvailable,
                toInstant(rs.getTimestamp("created_at")),
                toInstant(rs.getTimestamp("updated_at"))
        );
    }

    private static String priceSelectSql() {
        return """
                SELECT pp.id,
                       pp.plan_code,
                       p.display_name AS plan_display_name,
                       p.active AS plan_active,
                       pp.billing_period,
                       pp.currency,
                       pp.amount_minor,
                       pp.compare_at_amount_minor,
                       pp.active,
                       pp.sellable,
                       pp.starts_at,
                       pp.ends_at,
                       pp.created_at,
                       pp.updated_at
                FROM plan_prices pp
                INNER JOIN plan_catalog p ON p.code = pp.plan_code
                """;
    }

    private static String normalizePlanCode(String value) {
        String clean = String.valueOf(value == null ? "" : value)
                .trim()
                .toUpperCase(Locale.ROOT);
        if (clean.isBlank()) {
            throw new IllegalArgumentException("Plan không được để trống.");
        }
        return clean;
    }

    private static String normalizeOptionalPlanCode(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        return clean.isEmpty() ? null : normalizePlanCode(clean);
    }

    private static String normalizeBillingPeriod(String value) {
        String clean = String.valueOf(value == null ? "" : value)
                .trim()
                .toUpperCase(Locale.ROOT);
        if (!BILLING_PERIODS.contains(clean)) {
            throw new IllegalArgumentException(
                    "Chu kỳ chỉ hỗ trợ MONTHLY, YEARLY hoặc LIFETIME."
            );
        }
        return clean;
    }

    private static String normalizeCurrency(String value) {
        String clean = String.valueOf(value == null ? "" : value)
                .trim()
                .toUpperCase(Locale.ROOT);
        if (!clean.matches("[A-Z]{3}")) {
            throw new IllegalArgumentException("Currency phải là mã ISO 3 ký tự.");
        }
        return clean;
    }

    private static String cleanReason(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isBlank()) {
            throw new IllegalArgumentException("Cần nhập lý do để ghi audit.");
        }
        return clean;
    }

    private static Instant parseOptionalInstant(String value, String label) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isEmpty()) {
            return null;
        }
        try {
            return Instant.parse(clean);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException(
                    label + " phải dùng ISO-8601 UTC, ví dụ 2026-08-13T09:00:00Z."
            );
        }
    }

    private static Timestamp toTimestamp(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private static Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private record PlanState(String code, boolean active) {
    }

    private record PriceWindow(long id, Instant startsAt, Instant endsAt) {
    }
}

package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.billing.RevenueNormalizationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class AdminMarginDashboardService {

    private static final int MONEY_SCALE = 8;
    private static final int BREAKDOWN_LIMIT = 20;

    private final JdbcTemplate jdbcTemplate;
    private final RevenueNormalizationService revenueNormalizationService;
    private final ZoneId analyticsZone;

    public AdminMarginDashboardService(
            JdbcTemplate jdbcTemplate,
            RevenueNormalizationService revenueNormalizationService,
            @Value("${app.admin.analytics-time-zone:Asia/Ho_Chi_Minh}") String analyticsTimeZone
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.revenueNormalizationService = revenueNormalizationService;
        this.analyticsZone = safeZone(analyticsTimeZone);
    }

    public AdminMarginDashboardResponse dashboard(int requestedDays) {
        int days = normalizeDays(requestedDays);
        Instant to = Instant.now();
        LocalDate firstDay = LocalDate.now(analyticsZone).minusDays(days - 1L);
        Instant from = firstDay.atStartOfDay(analyticsZone).toInstant();

        RevenueSummary revenue = loadRevenueSummary(from, to);
        AiSummary ai = loadAiSummary(from, to);
        MarginValues margin = margin(revenue.netRevenue(), ai.aiCost(), revenue.missingFxEvents(), ai.missingCostEvents());

        return new AdminMarginDashboardResponse(
                revenueNormalizationService.reportingCurrency(),
                analyticsZone.getId(),
                days,
                from,
                to,
                money(revenue.grossRevenue()),
                money(revenue.refunds()),
                money(revenue.netRevenue()),
                money(ai.aiCost()),
                margin.grossProfit(),
                margin.grossMarginPercent(),
                margin.available(),
                revenue.paidTransactions(),
                revenue.refundTransactions(),
                revenue.revenueEvents(),
                revenue.normalizedEvents(),
                revenue.missingFxEvents(),
                percent(revenue.normalizedEvents(), revenue.revenueEvents()),
                ai.events(),
                ai.calculatedEvents(),
                ai.missingCostEvents(),
                percent(ai.calculatedEvents(), ai.events()),
                loadDaily(firstDay, days, from, to),
                loadBreakdown("PLAN", from, to),
                loadBreakdown("USER", from, to)
        );
    }

    private RevenueSummary loadRevenueSummary(Instant from, Instant to) {
        List<RevenueSummary> rows = jdbcTemplate.query(
                """
                SELECT
                    COALESCE(SUM(gross_revenue), 0) AS gross_revenue,
                    COALESCE(SUM(refunds), 0) AS refunds,
                    COALESCE(SUM(gross_revenue), 0) - COALESCE(SUM(refunds), 0) AS net_revenue,
                    COALESCE(SUM(paid_transactions), 0) AS paid_transactions,
                    COALESCE(SUM(refund_transactions), 0) AS refund_transactions,
                    COUNT(*) AS revenue_events,
                    COALESCE(SUM(CASE WHEN revenue_status = 'NORMALIZED' THEN 1 ELSE 0 END), 0) AS normalized_events,
                    COALESCE(SUM(CASE WHEN revenue_status <> 'NORMALIZED' THEN 1 ELSE 0 END), 0) AS missing_fx_events
                FROM (
                    SELECT CASE WHEN revenue_status = 'NORMALIZED' THEN COALESCE(gross_amount_reporting, 0) ELSE 0 END AS gross_revenue,
                           CAST(0 AS DECIMAL(24,8)) AS refunds,
                           1 AS paid_transactions,
                           0 AS refund_transactions,
                           revenue_status
                    FROM payment_transactions
                    WHERE paid_at >= ? AND paid_at <= ?
                      AND status IN ('SUCCEEDED', 'REFUNDED')
                    UNION ALL
                    SELECT CAST(0 AS DECIMAL(24,8)) AS gross_revenue,
                           CASE WHEN revenue_status = 'NORMALIZED' THEN COALESCE(refunded_amount_reporting, 0) ELSE 0 END AS refunds,
                           0 AS paid_transactions,
                           1 AS refund_transactions,
                           revenue_status
                    FROM payment_transactions
                    WHERE refunded_at >= ? AND refunded_at <= ?
                      AND status = 'REFUNDED'
                ) revenue_events
                """,
                (rs, rowNum) -> new RevenueSummary(
                        rs.getBigDecimal("gross_revenue"),
                        rs.getBigDecimal("refunds"),
                        rs.getBigDecimal("net_revenue"),
                        rs.getLong("paid_transactions"),
                        rs.getLong("refund_transactions"),
                        rs.getLong("revenue_events"),
                        rs.getLong("normalized_events"),
                        rs.getLong("missing_fx_events")
                ),
                Timestamp.from(from), Timestamp.from(to),
                Timestamp.from(from), Timestamp.from(to)
        );
        return rows.isEmpty() ? RevenueSummary.empty() : rows.getFirst();
    }

    private AiSummary loadAiSummary(Instant from, Instant to) {
        List<AiSummary> rows = jdbcTemplate.query(
                """
                SELECT COUNT(*) AS events,
                       COALESCE(SUM(CASE WHEN cost_status = 'CALCULATED' THEN 1 ELSE 0 END), 0) AS calculated_events,
                       COALESCE(SUM(CASE WHEN cost_status <> 'CALCULATED' THEN 1 ELSE 0 END), 0) AS missing_cost_events,
                       COALESCE(SUM(CASE WHEN cost_status = 'CALCULATED' THEN estimated_cost ELSE 0 END), 0) AS ai_cost
                FROM ai_usage_events
                WHERE created_at >= ? AND created_at <= ?
                """,
                (rs, rowNum) -> new AiSummary(
                        rs.getLong("events"),
                        rs.getLong("calculated_events"),
                        rs.getLong("missing_cost_events"),
                        rs.getBigDecimal("ai_cost")
                ),
                Timestamp.from(from), Timestamp.from(to)
        );
        return rows.isEmpty() ? AiSummary.empty() : rows.getFirst();
    }

    private List<AdminMarginDailyResponse> loadDaily(LocalDate firstDay, int days, Instant from, Instant to) {
        Map<String, RevenueAggregate> revenue = loadRevenueAggregate("DAY", from, to);
        Map<String, AiAggregate> ai = loadAiAggregate("DAY", from, to);
        List<AdminMarginDailyResponse> result = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            LocalDate date = firstDay.plusDays(i);
            String key = date.toString();
            RevenueAggregate r = revenue.getOrDefault(key, RevenueAggregate.empty(key, key));
            AiAggregate a = ai.getOrDefault(key, AiAggregate.empty(key, key));
            MarginValues m = margin(r.netRevenue(), a.aiCost(), r.missingFxEvents(), a.missingCostEvents());
            result.add(new AdminMarginDailyResponse(
                    date,
                    money(r.grossRevenue()),
                    money(r.refunds()),
                    money(r.netRevenue()),
                    money(a.aiCost()),
                    m.grossProfit(),
                    m.grossMarginPercent(),
                    m.available(),
                    r.revenueEvents(),
                    r.missingFxEvents(),
                    a.events(),
                    a.missingCostEvents()
            ));
        }
        return result;
    }

    private List<AdminMarginBreakdownResponse> loadBreakdown(String dimension, Instant from, Instant to) {
        Map<String, RevenueAggregate> revenue = loadRevenueAggregate(dimension, from, to);
        Map<String, AiAggregate> ai = loadAiAggregate(dimension, from, to);
        Set<String> keys = new LinkedHashSet<>();
        keys.addAll(revenue.keySet());
        keys.addAll(ai.keySet());

        List<AdminMarginBreakdownResponse> rows = new ArrayList<>();
        for (String key : keys) {
            RevenueAggregate r = revenue.getOrDefault(key, RevenueAggregate.empty(key, key));
            AiAggregate a = ai.getOrDefault(key, AiAggregate.empty(key, r.label()));
            String label = !isBlank(r.label()) ? r.label() : a.label();
            MarginValues m = margin(r.netRevenue(), a.aiCost(), r.missingFxEvents(), a.missingCostEvents());
            rows.add(new AdminMarginBreakdownResponse(
                    key,
                    label,
                    money(r.grossRevenue()),
                    money(r.refunds()),
                    money(r.netRevenue()),
                    money(a.aiCost()),
                    m.grossProfit(),
                    m.grossMarginPercent(),
                    m.available(),
                    r.revenueEvents(),
                    r.missingFxEvents(),
                    a.events(),
                    a.missingCostEvents()
            ));
        }
        rows.sort((left, right) -> right.netRevenue().compareTo(left.netRevenue()));
        return rows.size() > BREAKDOWN_LIMIT ? List.copyOf(rows.subList(0, BREAKDOWN_LIMIT)) : List.copyOf(rows);
    }

    private Map<String, RevenueAggregate> loadRevenueAggregate(String dimension, Instant from, Instant to) {
        RevenueDimensionSql d = revenueDimension(dimension);
        String sql = """
                SELECT event_key,
                       MAX(event_label) AS event_label,
                       COALESCE(SUM(gross_revenue), 0) AS gross_revenue,
                       COALESCE(SUM(refunds), 0) AS refunds,
                       COALESCE(SUM(gross_revenue), 0) - COALESCE(SUM(refunds), 0) AS net_revenue,
                       COUNT(*) AS revenue_events,
                       COALESCE(SUM(CASE WHEN revenue_status <> 'NORMALIZED' THEN 1 ELSE 0 END), 0) AS missing_fx_events
                FROM (
                    SELECT %s AS event_key,
                           %s AS event_label,
                           CASE WHEN pt.revenue_status = 'NORMALIZED' THEN COALESCE(pt.gross_amount_reporting, 0) ELSE 0 END AS gross_revenue,
                           CAST(0 AS DECIMAL(24,8)) AS refunds,
                           pt.revenue_status
                    FROM payment_transactions pt
                    LEFT JOIN users u ON u.id = pt.user_id
                    LEFT JOIN plan_catalog p ON p.code = pt.plan_code
                    WHERE pt.paid_at >= ? AND pt.paid_at <= ?
                      AND pt.status IN ('SUCCEEDED', 'REFUNDED')
                    UNION ALL
                    SELECT %s AS event_key,
                           %s AS event_label,
                           CAST(0 AS DECIMAL(24,8)) AS gross_revenue,
                           CASE WHEN pt.revenue_status = 'NORMALIZED' THEN COALESCE(pt.refunded_amount_reporting, 0) ELSE 0 END AS refunds,
                           pt.revenue_status
                    FROM payment_transactions pt
                    LEFT JOIN users u ON u.id = pt.user_id
                    LEFT JOIN plan_catalog p ON p.code = pt.plan_code
                    WHERE pt.refunded_at >= ? AND pt.refunded_at <= ?
                      AND pt.status = 'REFUNDED'
                ) events
                GROUP BY event_key
                """.formatted(d.paidKeyExpression(), d.paidLabelExpression(), d.refundKeyExpression(), d.refundLabelExpression());

        List<RevenueAggregate> rows = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new RevenueAggregate(
                        rs.getString("event_key"),
                        rs.getString("event_label"),
                        rs.getBigDecimal("gross_revenue"),
                        rs.getBigDecimal("refunds"),
                        rs.getBigDecimal("net_revenue"),
                        rs.getLong("revenue_events"),
                        rs.getLong("missing_fx_events")
                ),
                Timestamp.from(from), Timestamp.from(to),
                Timestamp.from(from), Timestamp.from(to)
        );
        Map<String, RevenueAggregate> result = new LinkedHashMap<>();
        for (RevenueAggregate row : rows) result.put(row.key(), row);
        return result;
    }

    private Map<String, AiAggregate> loadAiAggregate(String dimension, Instant from, Instant to) {
        DimensionSql d = aiDimension(dimension);
        String sql = """
                SELECT %s AS event_key,
                       MAX(%s) AS event_label,
                       COUNT(*) AS ai_events,
                       COALESCE(SUM(CASE WHEN e.cost_status <> 'CALCULATED' THEN 1 ELSE 0 END), 0) AS missing_cost_events,
                       COALESCE(SUM(CASE WHEN e.cost_status = 'CALCULATED' THEN e.estimated_cost ELSE 0 END), 0) AS ai_cost
                FROM ai_usage_events e
                LEFT JOIN users u ON u.id = e.user_id
                LEFT JOIN plan_catalog p ON p.code = e.plan_code
                WHERE e.created_at >= ? AND e.created_at <= ?
                GROUP BY %s
                """.formatted(d.keyExpression(), d.labelExpression(), d.keyExpression());

        List<AiAggregate> rows = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new AiAggregate(
                        rs.getString("event_key"),
                        rs.getString("event_label"),
                        rs.getLong("ai_events"),
                        rs.getLong("missing_cost_events"),
                        rs.getBigDecimal("ai_cost")
                ),
                Timestamp.from(from), Timestamp.from(to)
        );
        Map<String, AiAggregate> result = new LinkedHashMap<>();
        for (AiAggregate row : rows) result.put(row.key(), row);
        return result;
    }

    private RevenueDimensionSql revenueDimension(String dimension) {
        return switch (dimension) {
            case "DAY" -> {
                String offset = analyticsOffset(Instant.now());
                String paid = "DATE_FORMAT(CONVERT_TZ(pt.paid_at, '+00:00', '" + offset + "'), '%Y-%m-%d')";
                String refunded = "DATE_FORMAT(CONVERT_TZ(pt.refunded_at, '+00:00', '" + offset + "'), '%Y-%m-%d')";
                yield new RevenueDimensionSql(paid, paid, refunded, refunded);
            }
            case "PLAN" -> new RevenueDimensionSql(
                    "pt.plan_code", "COALESCE(p.display_name, pt.plan_code)",
                    "pt.plan_code", "COALESCE(p.display_name, pt.plan_code)"
            );
            case "USER" -> new RevenueDimensionSql(
                    "CAST(pt.user_id AS CHAR)", "COALESCE(u.email, CONCAT('User #', pt.user_id))",
                    "CAST(pt.user_id AS CHAR)", "COALESCE(u.email, CONCAT('User #', pt.user_id))"
            );
            default -> throw new IllegalArgumentException("Dimension revenue không hợp lệ.");
        };
    }

    private DimensionSql aiDimension(String dimension) {
        return switch (dimension) {
            case "DAY" -> new DimensionSql(
                    "DATE_FORMAT(CONVERT_TZ(e.created_at, '+00:00', '" + analyticsOffset(Instant.now()) + "'), '%Y-%m-%d')",
                    "DATE_FORMAT(CONVERT_TZ(e.created_at, '+00:00', '" + analyticsOffset(Instant.now()) + "'), '%Y-%m-%d')"
            );
            case "PLAN" -> new DimensionSql("e.plan_code", "COALESCE(p.display_name, e.plan_code)");
            case "USER" -> new DimensionSql("COALESCE(CAST(e.user_id AS CHAR), 'anonymous')", "COALESCE(u.email, CONCAT('User #', e.user_id), 'Anonymous')");
            default -> throw new IllegalArgumentException("Dimension AI không hợp lệ.");
        };
    }

    private static MarginValues margin(BigDecimal netRevenue, BigDecimal aiCost, long missingFx, long missingAiCost) {
        BigDecimal revenue = money(netRevenue);
        BigDecimal cost = money(aiCost);
        boolean available = missingFx == 0 && missingAiCost == 0;
        if (!available) return new MarginValues(null, null, false);
        BigDecimal profit = revenue.subtract(cost).setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        BigDecimal marginPercent = revenue.signum() > 0
                ? profit.multiply(BigDecimal.valueOf(100)).divide(revenue, 2, RoundingMode.HALF_UP)
                : null;
        return new MarginValues(profit, marginPercent, true);
    }

    private static BigDecimal percent(long numerator, long denominator) {
        if (denominator <= 0) return BigDecimal.valueOf(100).setScale(2);
        return BigDecimal.valueOf(numerator).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    }

    private static int normalizeDays(int requestedDays) {
        if (requestedDays <= 1) return 1;
        if (requestedDays <= 7) return 7;
        if (requestedDays <= 30) return 30;
        return Math.min(requestedDays, 90);
    }

    private String analyticsOffset(Instant at) {
        String id = analyticsZone.getRules().getOffset(at).getId();
        return "Z".equals(id) ? "+00:00" : id;
    }

    private static ZoneId safeZone(String value) {
        try {
            return ZoneId.of(String.valueOf(value == null ? "" : value).trim());
        } catch (RuntimeException ex) {
            return ZoneId.of("Asia/Ho_Chi_Minh");
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record RevenueSummary(
            BigDecimal grossRevenue,
            BigDecimal refunds,
            BigDecimal netRevenue,
            long paidTransactions,
            long refundTransactions,
            long revenueEvents,
            long normalizedEvents,
            long missingFxEvents
    ) {
        static RevenueSummary empty() {
            return new RevenueSummary(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, 0, 0, 0);
        }
    }

    private record AiSummary(long events, long calculatedEvents, long missingCostEvents, BigDecimal aiCost) {
        static AiSummary empty() { return new AiSummary(0, 0, 0, BigDecimal.ZERO); }
    }

    private record RevenueAggregate(
            String key,
            String label,
            BigDecimal grossRevenue,
            BigDecimal refunds,
            BigDecimal netRevenue,
            long revenueEvents,
            long missingFxEvents
    ) {
        static RevenueAggregate empty(String key, String label) {
            return new RevenueAggregate(key, label, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0, 0);
        }
    }

    private record AiAggregate(String key, String label, long events, long missingCostEvents, BigDecimal aiCost) {
        static AiAggregate empty(String key, String label) { return new AiAggregate(key, label, 0, 0, BigDecimal.ZERO); }
    }

    private record MarginValues(BigDecimal grossProfit, BigDecimal grossMarginPercent, boolean available) {
    }

    private record DimensionSql(String keyExpression, String labelExpression) {
    }

    private record RevenueDimensionSql(
            String paidKeyExpression,
            String paidLabelExpression,
            String refundKeyExpression,
            String refundLabelExpression
    ) {
    }
}

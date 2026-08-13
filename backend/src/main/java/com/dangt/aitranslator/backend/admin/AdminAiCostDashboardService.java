package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.usage.AiCostCalculationService;
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
import java.util.List;
import java.util.Map;

@Service
public class AdminAiCostDashboardService {

    private static final int MONEY_SCALE = 12;
    private static final int BREAKDOWN_LIMIT = 12;

    private final JdbcTemplate jdbcTemplate;
    private final AiCostCalculationService costCalculationService;
    private final ZoneId analyticsZone;

    public AdminAiCostDashboardService(
            JdbcTemplate jdbcTemplate,
            AiCostCalculationService costCalculationService,
            @Value("${app.admin.analytics-time-zone:Asia/Ho_Chi_Minh}") String analyticsTimeZone
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.costCalculationService = costCalculationService;
        this.analyticsZone = safeZone(analyticsTimeZone);
    }

    public AdminAiCostDashboardResponse dashboard(int requestedDays) {
        int days = normalizeDays(requestedDays);
        Instant to = Instant.now();
        LocalDate firstDay = LocalDate.now(analyticsZone).minusDays(days - 1L);
        Instant from = firstDay.atStartOfDay(analyticsZone).toInstant();

        Summary summary = loadSummary(from, to);

        return new AdminAiCostDashboardResponse(
                costCalculationService.reportingCurrency(),
                analyticsZone.getId(),
                days,
                from,
                to,
                summary.requests(),
                summary.successfulRequests(),
                summary.failedRequests(),
                percent(summary.successfulRequests(), summary.requests()),
                summary.inputTokens(),
                summary.cachedTokens(),
                summary.outputTokens(),
                summary.totalTokens(),
                money(summary.estimatedCost()),
                decimal(summary.averageLatencyMs(), 2),
                summary.calculatedCostEvents(),
                summary.missingRateEvents(),
                summary.tokenUsageUnavailableEvents(),
                loadDaily(firstDay, days, from, to),
                loadUserBreakdown(from, to),
                loadBreakdown("e.provider", "e.provider", from, to),
                loadBreakdown("e.model", "e.model", from, to),
                loadBreakdown("e.feature", "e.feature", from, to),
                loadBreakdown("e.plan_code", "e.plan_code", from, to)
        );
    }

    private Summary loadSummary(Instant from, Instant to) {
        List<Summary> rows = jdbcTemplate.query(
                """
                SELECT COUNT(*) AS requests,
                       COALESCE(SUM(CASE WHEN successful = TRUE THEN 1 ELSE 0 END), 0) AS successful_requests,
                       COALESCE(SUM(CASE WHEN successful = FALSE THEN 1 ELSE 0 END), 0) AS failed_requests,
                       COALESCE(SUM(input_tokens), 0) AS input_tokens,
                       COALESCE(SUM(cached_tokens), 0) AS cached_tokens,
                       COALESCE(SUM(output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(total_tokens), 0) AS total_tokens,
                       COALESCE(SUM(CASE WHEN cost_status = 'CALCULATED' THEN estimated_cost ELSE 0 END), 0) AS estimated_cost,
                       COALESCE(AVG(latency_ms), 0) AS average_latency_ms,
                       COALESCE(SUM(CASE WHEN cost_status = 'CALCULATED' THEN 1 ELSE 0 END), 0) AS calculated_cost_events,
                       COALESCE(SUM(CASE WHEN cost_status = 'MISSING_RATE' THEN 1 ELSE 0 END), 0) AS missing_rate_events,
                       COALESCE(SUM(CASE WHEN cost_status = 'TOKEN_USAGE_UNAVAILABLE' THEN 1 ELSE 0 END), 0) AS token_usage_unavailable_events
                FROM ai_usage_events
                WHERE created_at >= ?
                  AND created_at <= ?
                """,
                (rs, rowNum) -> new Summary(
                        rs.getLong("requests"),
                        rs.getLong("successful_requests"),
                        rs.getLong("failed_requests"),
                        rs.getLong("input_tokens"),
                        rs.getLong("cached_tokens"),
                        rs.getLong("output_tokens"),
                        rs.getLong("total_tokens"),
                        rs.getBigDecimal("estimated_cost"),
                        rs.getBigDecimal("average_latency_ms"),
                        rs.getLong("calculated_cost_events"),
                        rs.getLong("missing_rate_events"),
                        rs.getLong("token_usage_unavailable_events")
                ),
                Timestamp.from(from),
                Timestamp.from(to)
        );

        return rows.isEmpty() ? Summary.empty() : rows.getFirst();
    }

    private List<AdminAiCostDailyResponse> loadDaily(
            LocalDate firstDay,
            int days,
            Instant from,
            Instant to
    ) {
        List<AdminAiCostDailyResponse> rows = jdbcTemplate.query(
                """
                SELECT DATE(CONVERT_TZ(created_at, '+00:00', ?)) AS usage_date,
                       COUNT(*) AS requests,
                       COALESCE(SUM(CASE WHEN successful = TRUE THEN 1 ELSE 0 END), 0) AS successful_requests,
                       COALESCE(SUM(CASE WHEN successful = FALSE THEN 1 ELSE 0 END), 0) AS failed_requests,
                       COALESCE(SUM(input_tokens), 0) AS input_tokens,
                       COALESCE(SUM(cached_tokens), 0) AS cached_tokens,
                       COALESCE(SUM(output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(total_tokens), 0) AS total_tokens,
                       COALESCE(SUM(CASE WHEN cost_status = 'CALCULATED' THEN estimated_cost ELSE 0 END), 0) AS estimated_cost,
                       COALESCE(AVG(latency_ms), 0) AS average_latency_ms,
                       COALESCE(SUM(CASE WHEN cost_status = 'MISSING_RATE' THEN 1 ELSE 0 END), 0) AS missing_rate_events
                FROM ai_usage_events
                WHERE created_at >= ?
                  AND created_at <= ?
                GROUP BY usage_date
                ORDER BY usage_date
                """,
                (rs, rowNum) -> new AdminAiCostDailyResponse(
                        toLocalDate(rs.getDate("usage_date")),
                        rs.getLong("requests"),
                        rs.getLong("successful_requests"),
                        rs.getLong("failed_requests"),
                        rs.getLong("input_tokens"),
                        rs.getLong("cached_tokens"),
                        rs.getLong("output_tokens"),
                        rs.getLong("total_tokens"),
                        money(rs.getBigDecimal("estimated_cost")),
                        decimal(rs.getBigDecimal("average_latency_ms"), 2),
                        rs.getLong("missing_rate_events")
                ),
                analyticsOffset(to),
                Timestamp.from(from),
                Timestamp.from(to)
        );

        Map<LocalDate, AdminAiCostDailyResponse> byDate = new LinkedHashMap<>();
        for (AdminAiCostDailyResponse row : rows) {
            byDate.put(row.date(), row);
        }

        List<AdminAiCostDailyResponse> filled = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            LocalDate date = firstDay.plusDays(i);
            filled.add(byDate.getOrDefault(
                    date,
                    new AdminAiCostDailyResponse(
                            date,
                            0L,
                            0L,
                            0L,
                            0L,
                            0L,
                            0L,
                            0L,
                            BigDecimal.ZERO.setScale(MONEY_SCALE),
                            BigDecimal.ZERO.setScale(2),
                            0L
                    )
            ));
        }
        return filled;
    }

    private List<AdminAiCostBreakdownResponse> loadUserBreakdown(Instant from, Instant to) {
        return jdbcTemplate.query(
                """
                SELECT COALESCE(CAST(e.user_id AS CHAR), 'anonymous') AS breakdown_key,
                       COALESCE(u.email, CONCAT('User #', e.user_id), 'Anonymous') AS breakdown_label,
                       COUNT(*) AS requests,
                       COALESCE(SUM(CASE WHEN e.successful = TRUE THEN 1 ELSE 0 END), 0) AS successful_requests,
                       COALESCE(SUM(e.input_tokens), 0) AS input_tokens,
                       COALESCE(SUM(e.cached_tokens), 0) AS cached_tokens,
                       COALESCE(SUM(e.output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(CASE WHEN e.cost_status = 'CALCULATED' THEN e.estimated_cost ELSE 0 END), 0) AS estimated_cost,
                       COALESCE(AVG(e.latency_ms), 0) AS average_latency_ms,
                       COALESCE(SUM(CASE WHEN e.cost_status = 'MISSING_RATE' THEN 1 ELSE 0 END), 0) AS missing_rate_events
                FROM ai_usage_events e
                LEFT JOIN users u ON u.id = e.user_id
                WHERE e.created_at >= ?
                  AND e.created_at <= ?
                GROUP BY e.user_id, u.email
                ORDER BY estimated_cost DESC, requests DESC
                LIMIT %d
                """.formatted(BREAKDOWN_LIMIT),
                (rs, rowNum) -> new AdminAiCostBreakdownResponse(
                        rs.getString("breakdown_key"),
                        rs.getString("breakdown_label"),
                        rs.getLong("requests"),
                        rs.getLong("successful_requests"),
                        rs.getLong("input_tokens"),
                        rs.getLong("cached_tokens"),
                        rs.getLong("output_tokens"),
                        money(rs.getBigDecimal("estimated_cost")),
                        decimal(rs.getBigDecimal("average_latency_ms"), 2),
                        rs.getLong("missing_rate_events")
                ),
                Timestamp.from(from),
                Timestamp.from(to)
        );
    }

    private List<AdminAiCostBreakdownResponse> loadBreakdown(
            String keyExpression,
            String labelExpression,
            Instant from,
            Instant to
    ) {
        String sql = """
                SELECT %s AS breakdown_key,
                       %s AS breakdown_label,
                       COUNT(*) AS requests,
                       COALESCE(SUM(CASE WHEN e.successful = TRUE THEN 1 ELSE 0 END), 0) AS successful_requests,
                       COALESCE(SUM(e.input_tokens), 0) AS input_tokens,
                       COALESCE(SUM(e.cached_tokens), 0) AS cached_tokens,
                       COALESCE(SUM(e.output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(CASE WHEN e.cost_status = 'CALCULATED' THEN e.estimated_cost ELSE 0 END), 0) AS estimated_cost,
                       COALESCE(AVG(e.latency_ms), 0) AS average_latency_ms,
                       COALESCE(SUM(CASE WHEN e.cost_status = 'MISSING_RATE' THEN 1 ELSE 0 END), 0) AS missing_rate_events
                FROM ai_usage_events e
                WHERE e.created_at >= ?
                  AND e.created_at <= ?
                GROUP BY %s, %s
                ORDER BY estimated_cost DESC, requests DESC
                LIMIT %d
                """.formatted(
                keyExpression,
                labelExpression,
                keyExpression,
                labelExpression,
                BREAKDOWN_LIMIT
        );

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new AdminAiCostBreakdownResponse(
                        rs.getString("breakdown_key"),
                        rs.getString("breakdown_label"),
                        rs.getLong("requests"),
                        rs.getLong("successful_requests"),
                        rs.getLong("input_tokens"),
                        rs.getLong("cached_tokens"),
                        rs.getLong("output_tokens"),
                        money(rs.getBigDecimal("estimated_cost")),
                        decimal(rs.getBigDecimal("average_latency_ms"), 2),
                        rs.getLong("missing_rate_events")
                ),
                Timestamp.from(from),
                Timestamp.from(to)
        );
    }

    private static int normalizeDays(int requestedDays) {
        if (requestedDays <= 1) {
            return 1;
        }
        if (requestedDays <= 7) {
            return 7;
        }
        if (requestedDays <= 30) {
            return 30;
        }
        return Math.min(requestedDays, 90);
    }

    private static BigDecimal percent(long numerator, long denominator) {
        if (denominator <= 0) {
            return BigDecimal.ZERO.setScale(2);
        }
        return BigDecimal.valueOf(numerator)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal money(BigDecimal value) {
        return decimal(value, MONEY_SCALE);
    }

    private static BigDecimal decimal(BigDecimal value, int scale) {
        return (value == null ? BigDecimal.ZERO : value).setScale(scale, RoundingMode.HALF_UP);
    }

    private static LocalDate toLocalDate(Date value) {
        return value == null ? null : value.toLocalDate();
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

    private record Summary(
            long requests,
            long successfulRequests,
            long failedRequests,
            long inputTokens,
            long cachedTokens,
            long outputTokens,
            long totalTokens,
            BigDecimal estimatedCost,
            BigDecimal averageLatencyMs,
            long calculatedCostEvents,
            long missingRateEvents,
            long tokenUsageUnavailableEvents
    ) {
        private static Summary empty() {
            return new Summary(
                    0L,
                    0L,
                    0L,
                    0L,
                    0L,
                    0L,
                    0L,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    0L,
                    0L,
                    0L
            );
        }
    }
}

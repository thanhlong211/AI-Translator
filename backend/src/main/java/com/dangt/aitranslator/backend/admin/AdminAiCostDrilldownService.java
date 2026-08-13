package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.usage.AiCostCalculationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class AdminAiCostDrilldownService {

    private static final int MONEY_SCALE = 12;
    private static final int BREAKDOWN_LIMIT = 20;
    private static final int RECENT_LIMIT = 50;

    private final JdbcTemplate jdbcTemplate;
    private final AiCostCalculationService costCalculationService;
    private final ZoneId analyticsZone;

    public AdminAiCostDrilldownService(
            JdbcTemplate jdbcTemplate,
            AiCostCalculationService costCalculationService,
            @Value("${app.admin.analytics-time-zone:Asia/Ho_Chi_Minh}") String analyticsTimeZone
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.costCalculationService = costCalculationService;
        this.analyticsZone = safeZone(analyticsTimeZone);
    }

    public AdminAiCostDrilldownResponse drilldown(
            int requestedDays,
            String requestedDimension,
            String requestedKey
    ) {
        int days = normalizeDays(requestedDays);
        Dimension dimension = Dimension.parse(requestedDimension);
        String key = normalizeKey(dimension, requestedKey);

        Instant to = Instant.now();
        LocalDate firstDay = LocalDate.now(analyticsZone).minusDays(days - 1L);
        Instant from = firstDay.atStartOfDay(analyticsZone).toInstant();
        Filter filter = Filter.of(dimension, key);

        AdminAiCostSummaryResponse summary = loadSummary(from, to, filter);
        String label = resolveLabel(dimension, key);

        return new AdminAiCostDrilldownResponse(
                costCalculationService.reportingCurrency(),
                analyticsZone.getId(),
                days,
                from,
                to,
                dimension.name(),
                key,
                label,
                summary,
                loadUserBreakdown(from, to, filter),
                loadBreakdown("e.plan_code", "e.plan_code", from, to, filter),
                loadBreakdown("e.feature", "e.feature", from, to, filter),
                loadBreakdown("e.provider", "e.provider", from, to, filter),
                loadBreakdown("e.model", "e.model", from, to, filter),
                loadRecent(from, to, filter)
        );
    }

    private AdminAiCostSummaryResponse loadSummary(Instant from, Instant to, Filter filter) {
        String sql = """
                SELECT COUNT(*) AS requests,
                       COALESCE(SUM(CASE WHEN e.successful = TRUE THEN 1 ELSE 0 END), 0) AS successful_requests,
                       COALESCE(SUM(CASE WHEN e.successful = FALSE THEN 1 ELSE 0 END), 0) AS failed_requests,
                       COALESCE(SUM(e.input_tokens), 0) AS input_tokens,
                       COALESCE(SUM(e.cached_tokens), 0) AS cached_tokens,
                       COALESCE(SUM(e.output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(e.total_tokens), 0) AS total_tokens,
                       COALESCE(SUM(CASE WHEN e.cost_status = 'CALCULATED' THEN e.estimated_cost ELSE 0 END), 0) AS estimated_cost,
                       COALESCE(AVG(e.latency_ms), 0) AS average_latency_ms,
                       COALESCE(SUM(CASE WHEN e.cost_status = 'CALCULATED' THEN 1 ELSE 0 END), 0) AS calculated_cost_events,
                       COALESCE(SUM(CASE WHEN e.cost_status = 'MISSING_RATE' THEN 1 ELSE 0 END), 0) AS missing_rate_events,
                       COALESCE(SUM(CASE WHEN e.cost_status = 'TOKEN_USAGE_UNAVAILABLE' THEN 1 ELSE 0 END), 0) AS token_usage_unavailable_events
                FROM ai_usage_events e
                WHERE e.created_at >= ?
                  AND e.created_at <= ?
                """ + filter.sql();

        List<Object> args = rangeArgs(from, to, filter);
        List<AdminAiCostSummaryResponse> rows = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new AdminAiCostSummaryResponse(
                        rs.getLong("requests"),
                        rs.getLong("successful_requests"),
                        rs.getLong("failed_requests"),
                        percent(rs.getLong("successful_requests"), rs.getLong("requests")),
                        rs.getLong("input_tokens"),
                        rs.getLong("cached_tokens"),
                        rs.getLong("output_tokens"),
                        rs.getLong("total_tokens"),
                        money(rs.getBigDecimal("estimated_cost")),
                        decimal(rs.getBigDecimal("average_latency_ms"), 2),
                        rs.getLong("calculated_cost_events"),
                        rs.getLong("missing_rate_events"),
                        rs.getLong("token_usage_unavailable_events")
                ),
                args.toArray()
        );

        return rows.isEmpty()
                ? new AdminAiCostSummaryResponse(
                        0L, 0L, 0L, BigDecimal.ZERO.setScale(2),
                        0L, 0L, 0L, 0L,
                        BigDecimal.ZERO.setScale(MONEY_SCALE),
                        BigDecimal.ZERO.setScale(2),
                        0L, 0L, 0L
                )
                : rows.getFirst();
    }

    private List<AdminAiCostBreakdownResponse> loadUserBreakdown(
            Instant from,
            Instant to,
            Filter filter
    ) {
        String sql = """
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
                """ + filter.sql() + "\n" + """
                GROUP BY e.user_id, u.email
                ORDER BY estimated_cost DESC, requests DESC
                LIMIT %d
                """.formatted(BREAKDOWN_LIMIT);

        return queryBreakdown(sql, from, to, filter);
    }

    private List<AdminAiCostBreakdownResponse> loadBreakdown(
            String keyExpression,
            String labelExpression,
            Instant from,
            Instant to,
            Filter filter
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
                %s
                GROUP BY %s, %s
                ORDER BY estimated_cost DESC, requests DESC
                LIMIT %d
                """.formatted(
                keyExpression,
                labelExpression,
                filter.sql(),
                keyExpression,
                labelExpression,
                BREAKDOWN_LIMIT
        );

        return queryBreakdown(sql, from, to, filter);
    }

    private List<AdminAiCostBreakdownResponse> queryBreakdown(
            String sql,
            Instant from,
            Instant to,
            Filter filter
    ) {
        List<Object> args = rangeArgs(from, to, filter);
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
                args.toArray()
        );
    }

    private List<AdminAiUsageResponse> loadRecent(Instant from, Instant to, Filter filter) {
        String sql = """
                SELECT e.id,
                       e.user_id,
                       u.email AS user_email,
                       e.request_id,
                       e.provider,
                       e.provider_request_id,
                       e.model,
                       e.feature,
                       e.plan_code,
                       e.input_tokens,
                       e.output_tokens,
                       e.cached_tokens,
                       e.total_tokens,
                       e.latency_ms,
                       e.successful,
                       e.error_code,
                       e.model_cost_id,
                       e.cost_currency,
                       e.input_rate_per_million,
                       e.cached_input_rate_per_million,
                       e.output_rate_per_million,
                       e.input_cost,
                       e.cached_input_cost,
                       e.output_cost,
                       e.estimated_cost,
                       e.cost_status,
                       e.cost_calculated_at,
                       e.created_at
                FROM ai_usage_events e
                LEFT JOIN users u ON u.id = e.user_id
                WHERE e.created_at >= ?
                  AND e.created_at <= ?
                """ + filter.sql() + "\n" + """
                ORDER BY e.id DESC
                LIMIT %d
                """.formatted(RECENT_LIMIT);

        List<Object> args = rangeArgs(from, to, filter);
        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> mapUsage(rs),
                args.toArray()
        );
    }

    private String resolveLabel(Dimension dimension, String key) {
        if (dimension != Dimension.USER) {
            return key;
        }
        if ("anonymous".equals(key)) {
            return "Anonymous";
        }
        List<String> rows = jdbcTemplate.query(
                "SELECT COALESCE(email, CONCAT('User #', id)) FROM users WHERE id = ?",
                (rs, rowNum) -> rs.getString(1),
                Long.parseLong(key)
        );
        return rows.isEmpty() ? "User #" + key : rows.getFirst();
    }

    private static AdminAiUsageResponse mapUsage(ResultSet rs) throws SQLException {
        return new AdminAiUsageResponse(
                rs.getLong("id"),
                nullableLong(rs.getObject("user_id")),
                rs.getString("user_email"),
                rs.getString("request_id"),
                rs.getString("provider"),
                rs.getString("provider_request_id"),
                rs.getString("model"),
                rs.getString("feature"),
                rs.getString("plan_code"),
                nullableLong(rs.getObject("input_tokens")),
                nullableLong(rs.getObject("output_tokens")),
                nullableLong(rs.getObject("cached_tokens")),
                nullableLong(rs.getObject("total_tokens")),
                rs.getLong("latency_ms"),
                rs.getBoolean("successful"),
                rs.getString("error_code"),
                nullableLong(rs.getObject("model_cost_id")),
                rs.getString("cost_currency"),
                rs.getBigDecimal("input_rate_per_million"),
                rs.getBigDecimal("cached_input_rate_per_million"),
                rs.getBigDecimal("output_rate_per_million"),
                rs.getBigDecimal("input_cost"),
                rs.getBigDecimal("cached_input_cost"),
                rs.getBigDecimal("output_cost"),
                rs.getBigDecimal("estimated_cost"),
                rs.getString("cost_status"),
                toInstant(rs.getTimestamp("cost_calculated_at")),
                toInstant(rs.getTimestamp("created_at"))
        );
    }

    private static List<Object> rangeArgs(Instant from, Instant to, Filter filter) {
        List<Object> args = new ArrayList<>();
        args.add(Timestamp.from(from));
        args.add(Timestamp.from(to));
        args.addAll(filter.args());
        return args;
    }

    private static String normalizeKey(Dimension dimension, String value) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isEmpty()) {
            throw new IllegalArgumentException("Thiếu drill-down key.");
        }
        return switch (dimension) {
            case USER -> {
                if ("anonymous".equalsIgnoreCase(clean)) {
                    yield "anonymous";
                }
                try {
                    long userId = Long.parseLong(clean);
                    if (userId <= 0L) {
                        throw new NumberFormatException();
                    }
                    yield String.valueOf(userId);
                } catch (NumberFormatException ex) {
                    throw new IllegalArgumentException("User drill-down key không hợp lệ.");
                }
            }
            case PLAN, FEATURE -> clean.toUpperCase(Locale.ROOT);
            case PROVIDER -> clean.toLowerCase(Locale.ROOT);
            case MODEL -> clean;
        };
    }

    private static int normalizeDays(int requestedDays) {
        if (requestedDays <= 1) return 1;
        if (requestedDays <= 7) return 7;
        if (requestedDays <= 30) return 30;
        return Math.min(requestedDays, 90);
    }

    private static BigDecimal percent(long numerator, long denominator) {
        if (denominator <= 0L) return BigDecimal.ZERO.setScale(2);
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

    private static Long nullableLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private static Instant toInstant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private static ZoneId safeZone(String value) {
        try {
            return ZoneId.of(String.valueOf(value == null ? "" : value).trim());
        } catch (RuntimeException ex) {
            return ZoneId.of("Asia/Ho_Chi_Minh");
        }
    }

    private enum Dimension {
        USER,
        PLAN,
        FEATURE,
        PROVIDER,
        MODEL;

        private static Dimension parse(String value) {
            try {
                return Dimension.valueOf(String.valueOf(value == null ? "" : value).trim().toUpperCase(Locale.ROOT));
            } catch (RuntimeException ex) {
                throw new IllegalArgumentException("dimension phải là USER, PLAN, FEATURE, PROVIDER hoặc MODEL.");
            }
        }
    }

    private record Filter(String sql, List<Object> args) {
        private static Filter of(Dimension dimension, String key) {
            return switch (dimension) {
                case USER -> "anonymous".equals(key)
                        ? new Filter(" AND e.user_id IS NULL", List.of())
                        : new Filter(" AND e.user_id = ?", List.of(Long.parseLong(key)));
                case PLAN -> new Filter(" AND e.plan_code = ?", List.of(key));
                case FEATURE -> new Filter(" AND e.feature = ?", List.of(key));
                case PROVIDER -> new Filter(" AND e.provider = ?", List.of(key));
                case MODEL -> new Filter(" AND e.model = ?", List.of(key));
            };
        }
    }
}

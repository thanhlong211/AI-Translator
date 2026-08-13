package com.dangt.aitranslator.backend.admin;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class AdminAiUsageService {

    private final JdbcTemplate jdbcTemplate;

    public AdminAiUsageService(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<AdminAiUsageResponse> list(
            Long userId,
            String feature,
            String provider,
            String model,
            Boolean successful,
            int limit
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 500));

        StringBuilder sql = new StringBuilder(
                """
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
                WHERE 1 = 1
                """
        );

        List<Object> args = new ArrayList<>();

        if (userId != null) {
            sql.append(" AND e.user_id = ?");
            args.add(userId);
        }

        String cleanFeature = upper(feature);
        if (!cleanFeature.isBlank()) {
            sql.append(" AND e.feature = ?");
            args.add(cleanFeature);
        }

        String cleanProvider = lower(provider);
        if (!cleanProvider.isBlank()) {
            sql.append(" AND e.provider = ?");
            args.add(cleanProvider);
        }

        String cleanModel = clean(model);
        if (!cleanModel.isBlank()) {
            sql.append(" AND e.model = ?");
            args.add(cleanModel);
        }

        if (successful != null) {
            sql.append(" AND e.successful = ?");
            args.add(successful);
        }

        sql.append(" ORDER BY e.id DESC LIMIT ?");
        args.add(safeLimit);

        return jdbcTemplate.query(
                sql.toString(),
                (rs, rowNum) -> new AdminAiUsageResponse(
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
                ),
                args.toArray()
        );
    }

    public AdminAiUsageResponse detail(long eventId) {
        if (eventId <= 0L) {
            throw new IllegalArgumentException("AI usage event id không hợp lệ.");
        }

        List<AdminAiUsageResponse> rows = jdbcTemplate.query(
                """
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
                WHERE e.id = ?
                LIMIT 1
                """,
                (rs, rowNum) -> new AdminAiUsageResponse(
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
                ),
                eventId
        );

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("AI usage event không tồn tại.");
        }
        return rows.getFirst();
    }

    private static Long nullableLong(Object value) {
        return value instanceof Number number
                ? number.longValue()
                : null;
    }

    private static java.time.Instant toInstant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private static String clean(Object value) {
        return String.valueOf(value == null ? "" : value).trim();
    }

    private static String upper(Object value) {
        return clean(value).toUpperCase(Locale.ROOT);
    }

    private static String lower(Object value) {
        return clean(value).toLowerCase(Locale.ROOT);
    }
}

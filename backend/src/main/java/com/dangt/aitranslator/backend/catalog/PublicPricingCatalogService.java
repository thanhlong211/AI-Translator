package com.dangt.aitranslator.backend.catalog;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class PublicPricingCatalogService {

    private final JdbcTemplate jdbcTemplate;

    public PublicPricingCatalogService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<PublicCatalogPlanResponse> listPlans(String requestedCurrency) {
        String currency = normalizeOptionalCurrency(requestedCurrency);

        List<PlanRow> plans = jdbcTemplate.query(
                """
                SELECT code, display_name, description, rank_order
                FROM plan_catalog
                WHERE active = TRUE
                ORDER BY rank_order, code
                """,
                (rs, rowNum) -> new PlanRow(
                        rs.getString("code"),
                        rs.getString("display_name"),
                        rs.getString("description"),
                        rs.getInt("rank_order")
                )
        );

        return plans.stream()
                .map(plan -> toResponse(plan, currency))
                .toList();
    }

    @Transactional(readOnly = true)
    public PublicCatalogPlanResponse plan(
            String requestedPlanCode,
            String requestedCurrency
    ) {
        String planCode = normalizePlanCode(requestedPlanCode);
        String currency = normalizeOptionalCurrency(requestedCurrency);

        List<PlanRow> rows = jdbcTemplate.query(
                """
                SELECT code, display_name, description, rank_order
                FROM plan_catalog
                WHERE code = ?
                  AND active = TRUE
                LIMIT 1
                """,
                (rs, rowNum) -> new PlanRow(
                        rs.getString("code"),
                        rs.getString("display_name"),
                        rs.getString("description"),
                        rs.getInt("rank_order")
                ),
                planCode
        );

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Plan không tồn tại hoặc đang bị tắt.");
        }

        return toResponse(rows.getFirst(), currency);
    }

    private PublicCatalogPlanResponse toResponse(
            PlanRow plan,
            String currency
    ) {
        return new PublicCatalogPlanResponse(
                plan.code(),
                plan.displayName(),
                plan.description(),
                plan.rankOrder(),
                loadFeatures(plan.code()),
                loadLimits(plan.code()),
                loadCurrentPrices(plan.code(), currency)
        );
    }

    private Map<String, Boolean> loadFeatures(String planCode) {
        Map<String, Boolean> features = new LinkedHashMap<>();

        jdbcTemplate.query(
                """
                SELECT feature_key, enabled
                FROM plan_features
                WHERE plan_code = ?
                ORDER BY feature_key
                """,
                (RowCallbackHandler) rs -> features.put(
                        rs.getString("feature_key"),
                        rs.getBoolean("enabled")
                ),
                planCode
        );

        return features;
    }

    private Map<String, Long> loadLimits(String planCode) {
        Map<String, Long> limits = new LinkedHashMap<>();

        jdbcTemplate.query(
                """
                SELECT limit_key, limit_value
                FROM plan_limits
                WHERE plan_code = ?
                ORDER BY limit_key
                """,
                (RowCallbackHandler) rs -> limits.put(
                        rs.getString("limit_key"),
                        rs.getLong("limit_value")
                ),
                planCode
        );

        return limits;
    }

    private List<PublicCatalogPriceResponse> loadCurrentPrices(
            String planCode,
            String currency
    ) {
        String sql = """
                SELECT id,
                       billing_period,
                       currency,
                       amount_minor,
                       compare_at_amount_minor,
                       starts_at,
                       ends_at
                FROM plan_prices
                WHERE plan_code = ?
                  AND active = TRUE
                  AND sellable = TRUE
                  AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP(6))
                  AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP(6))
                """;

        if (currency == null) {
            return jdbcTemplate.query(
                    sql + " ORDER BY currency, FIELD(billing_period, 'MONTHLY', 'YEARLY', 'LIFETIME'), id",
                    (rs, rowNum) -> mapPrice(rs),
                    planCode
            );
        }

        return jdbcTemplate.query(
                sql + " AND currency = ? ORDER BY FIELD(billing_period, 'MONTHLY', 'YEARLY', 'LIFETIME'), id",
                (rs, rowNum) -> mapPrice(rs),
                planCode,
                currency
        );
    }

    private static PublicCatalogPriceResponse mapPrice(
            java.sql.ResultSet rs
    ) throws java.sql.SQLException {
        Object compareAt = rs.getObject("compare_at_amount_minor");

        return new PublicCatalogPriceResponse(
                rs.getLong("id"),
                rs.getString("billing_period"),
                rs.getString("currency"),
                rs.getLong("amount_minor"),
                compareAt == null ? null : ((Number) compareAt).longValue(),
                toInstant(rs.getTimestamp("starts_at")),
                toInstant(rs.getTimestamp("ends_at"))
        );
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

    private static String normalizeOptionalCurrency(String value) {
        String clean = String.valueOf(value == null ? "" : value)
                .trim()
                .toUpperCase(Locale.ROOT);
        if (clean.isEmpty()) {
            return null;
        }
        if (!clean.matches("[A-Z]{3}")) {
            throw new IllegalArgumentException("Currency phải là mã ISO 3 ký tự.");
        }
        return clean;
    }

    private static Instant toInstant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private record PlanRow(
            String code,
            String displayName,
            String description,
            int rankOrder
    ) {
    }
}

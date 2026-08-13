package com.dangt.aitranslator.backend.usage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
public class AiCostCalculationService {

    public static final String CALCULATED = "CALCULATED";
    public static final String MISSING_RATE = "MISSING_RATE";
    public static final String TOKEN_USAGE_UNAVAILABLE = "TOKEN_USAGE_UNAVAILABLE";

    private static final Logger log = LoggerFactory.getLogger(AiCostCalculationService.class);
    private static final BigDecimal ONE_MILLION = new BigDecimal("1000000");
    private static final int COST_SCALE = 12;

    private final JdbcTemplate jdbcTemplate;
    private final String reportingCurrency;

    public AiCostCalculationService(
            JdbcTemplate jdbcTemplate,
            @Value("${app.ai-cost.reporting-currency:USD}") String reportingCurrency
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.reportingCurrency = normalizeCurrency(reportingCurrency);
    }

    public String reportingCurrency() {
        return reportingCurrency;
    }

    /**
     * Resolve the rate that was effective at the event time and return a snapshot.
     * Missing rates never fail a user request; they are intentionally surfaced as
     * MISSING_RATE so SUPER_ADMIN can configure a rate and backfill later.
     */
    public AiCostSnapshot calculateSnapshot(
            String provider,
            String model,
            Long inputTokens,
            Long outputTokens,
            Long cachedTokens,
            Instant eventAt
    ) {
        Instant safeEventAt = eventAt == null ? Instant.now() : eventAt;

        if (inputTokens == null || outputTokens == null) {
            return tokenUnavailable();
        }

        long safeInput = Math.max(0L, inputTokens);
        long safeOutput = Math.max(0L, outputTokens);
        long rawCached = cachedTokens == null ? 0L : Math.max(0L, cachedTokens);
        long safeCached = Math.min(rawCached, safeInput);
        long billableInput = safeInput - safeCached;

        String safeProvider = clean(provider).toLowerCase(Locale.ROOT);
        String safeModel = clean(model);
        if (safeProvider.isEmpty() || safeModel.isEmpty()
                || "unknown".equalsIgnoreCase(safeProvider)
                || "unknown".equalsIgnoreCase(safeModel)) {
            return missingRate();
        }

        try {
            List<ModelRate> rates = jdbcTemplate.query(
                    """
                    SELECT id,
                           currency,
                           input_cost_per_million,
                           cached_input_cost_per_million,
                           output_cost_per_million
                    FROM ai_model_costs
                    WHERE provider = ?
                      AND model = ?
                      AND currency = ?
                      AND active = TRUE
                      AND (effective_from IS NULL OR effective_from <= ?)
                      AND (effective_to IS NULL OR effective_to > ?)
                    ORDER BY CASE WHEN effective_from IS NULL THEN 1 ELSE 0 END,
                             effective_from DESC,
                             id DESC
                    LIMIT 1
                    """,
                    (rs, rowNum) -> new ModelRate(
                            rs.getLong("id"),
                            rs.getString("currency"),
                            rs.getBigDecimal("input_cost_per_million"),
                            rs.getBigDecimal("cached_input_cost_per_million"),
                            rs.getBigDecimal("output_cost_per_million")
                    ),
                    safeProvider,
                    safeModel,
                    reportingCurrency,
                    Timestamp.from(safeEventAt),
                    Timestamp.from(safeEventAt)
            );

            if (rates.isEmpty()) {
                return missingRate();
            }

            ModelRate rate = rates.getFirst();
            BigDecimal inputCost = costForTokens(rate.inputRate(), billableInput);
            BigDecimal cachedCost = costForTokens(rate.cachedRate(), safeCached);
            BigDecimal outputCost = costForTokens(rate.outputRate(), safeOutput);
            BigDecimal total = inputCost
                    .add(cachedCost)
                    .add(outputCost)
                    .setScale(COST_SCALE, RoundingMode.HALF_UP);

            return new AiCostSnapshot(
                    CALCULATED,
                    rate.id(),
                    rate.currency(),
                    rate.inputRate(),
                    rate.cachedRate(),
                    rate.outputRate(),
                    inputCost,
                    cachedCost,
                    outputCost,
                    total,
                    Instant.now()
            );
        } catch (RuntimeException ex) {
            log.warn(
                    "AI_COST_RESOLUTION_FAILED provider={} model={} currency={} errorType={}",
                    safeProvider,
                    safeModel,
                    reportingCurrency,
                    ex.getClass().getSimpleName()
            );
            return missingRate();
        }
    }

    /**
     * Retry historical rows that could not be costed because the matching model
     * rate had not been configured yet. Existing CALCULATED snapshots are never
     * recalculated, so later rate edits cannot rewrite historical costs.
     */
    public AiCostBackfillResult backfillMissingRates(int requestedLimit) {
        int limit = Math.max(1, Math.min(requestedLimit, 5000));
        List<UsageRow> rows = jdbcTemplate.query(
                """
                SELECT id,
                       provider,
                       model,
                       input_tokens,
                       output_tokens,
                       cached_tokens,
                       created_at
                FROM ai_usage_events
                WHERE cost_status = 'MISSING_RATE'
                ORDER BY id
                LIMIT ?
                """,
                (rs, rowNum) -> new UsageRow(
                        rs.getLong("id"),
                        rs.getString("provider"),
                        rs.getString("model"),
                        nullableLong(rs.getObject("input_tokens")),
                        nullableLong(rs.getObject("output_tokens")),
                        nullableLong(rs.getObject("cached_tokens")),
                        toInstant(rs.getTimestamp("created_at"))
                ),
                limit
        );

        int calculated = 0;
        int missingRate = 0;
        int tokenUnavailable = 0;

        for (UsageRow row : rows) {
            AiCostSnapshot snapshot = calculateSnapshot(
                    row.provider(),
                    row.model(),
                    row.inputTokens(),
                    row.outputTokens(),
                    row.cachedTokens(),
                    row.createdAt()
            );

            if (CALCULATED.equals(snapshot.status())) {
                if (updateSnapshot(row.id(), snapshot)) {
                    calculated++;
                }
            } else if (TOKEN_USAGE_UNAVAILABLE.equals(snapshot.status())) {
                int updated = jdbcTemplate.update(
                        """
                        UPDATE ai_usage_events
                        SET cost_status = ?,
                            cost_calculated_at = CURRENT_TIMESTAMP(6)
                        WHERE id = ?
                          AND cost_status = 'MISSING_RATE'
                        """,
                        TOKEN_USAGE_UNAVAILABLE,
                        row.id()
                );
                if (updated > 0) {
                    tokenUnavailable++;
                }
            } else {
                missingRate++;
            }
        }

        return new AiCostBackfillResult(
                rows.size(),
                calculated,
                missingRate,
                tokenUnavailable
        );
    }

    private boolean updateSnapshot(long eventId, AiCostSnapshot snapshot) {
        int updated = jdbcTemplate.update(
                """
                UPDATE ai_usage_events
                SET model_cost_id = ?,
                    cost_currency = ?,
                    input_rate_per_million = ?,
                    cached_input_rate_per_million = ?,
                    output_rate_per_million = ?,
                    input_cost = ?,
                    cached_input_cost = ?,
                    output_cost = ?,
                    estimated_cost = ?,
                    cost_status = ?,
                    cost_calculated_at = ?
                WHERE id = ?
                  AND cost_status = 'MISSING_RATE'
                """,
                snapshot.modelCostId(),
                snapshot.currency(),
                snapshot.inputRatePerMillion(),
                snapshot.cachedInputRatePerMillion(),
                snapshot.outputRatePerMillion(),
                snapshot.inputCost(),
                snapshot.cachedInputCost(),
                snapshot.outputCost(),
                snapshot.estimatedCost(),
                snapshot.status(),
                toTimestamp(snapshot.calculatedAt()),
                eventId
        );
        return updated > 0;
    }

    private static BigDecimal costForTokens(BigDecimal ratePerMillion, long tokens) {
        if (tokens <= 0L || ratePerMillion == null || ratePerMillion.signum() == 0) {
            return BigDecimal.ZERO.setScale(COST_SCALE, RoundingMode.HALF_UP);
        }
        return ratePerMillion
                .multiply(BigDecimal.valueOf(tokens))
                .divide(ONE_MILLION, COST_SCALE, RoundingMode.HALF_UP);
    }

    private static AiCostSnapshot missingRate() {
        return new AiCostSnapshot(
                MISSING_RATE,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }

    private static AiCostSnapshot tokenUnavailable() {
        return new AiCostSnapshot(
                TOKEN_USAGE_UNAVAILABLE,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                Instant.now()
        );
    }

    private static String normalizeCurrency(String value) {
        String currency = clean(value).toUpperCase(Locale.ROOT);
        if (!currency.matches("[A-Z]{3}")) {
            throw new IllegalArgumentException("app.ai-cost.reporting-currency phải là mã ISO 3 ký tự.");
        }
        return currency;
    }

    private static String clean(Object value) {
        return String.valueOf(value == null ? "" : value).trim();
    }

    private static Long nullableLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private static Instant toInstant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private static Timestamp toTimestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private record ModelRate(
            long id,
            String currency,
            BigDecimal inputRate,
            BigDecimal cachedRate,
            BigDecimal outputRate
    ) {
    }

    private record UsageRow(
            long id,
            String provider,
            String model,
            Long inputTokens,
            Long outputTokens,
            Long cachedTokens,
            Instant createdAt
    ) {
    }
}

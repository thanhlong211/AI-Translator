package com.dangt.aitranslator.backend.usage;

import com.dangt.aitranslator.backend.entitlement.EntitlementService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Locale;

/**
 * Metadata-only ledger for one row per AI provider call.
 *
 * Ledger writes are best-effort: an analytics database failure must not turn a
 * successful paid AI response into a failed user request.
 */
@Service
public class AiUsageLedgerService {

    private static final Logger log =
            LoggerFactory.getLogger(AiUsageLedgerService.class);

    private final JdbcTemplate jdbcTemplate;
    private final EntitlementService entitlementService;
    private final AiCostCalculationService costCalculationService;

    public AiUsageLedgerService(
            JdbcTemplate jdbcTemplate,
            EntitlementService entitlementService,
            AiCostCalculationService costCalculationService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.entitlementService = entitlementService;
        this.costCalculationService = costCalculationService;
    }

    public void recordSuccess(
            long userId,
            String requestId,
            String feature,
            AiProviderUsage usage,
            long latencyMs
    ) {
        record(
                userId,
                requestId,
                feature,
                usage,
                latencyMs,
                true,
                null
        );
    }

    public void recordFailure(
            long userId,
            String requestId,
            String feature,
            AiProviderUsage usage,
            long latencyMs,
            Throwable error
    ) {
        record(
                userId,
                requestId,
                feature,
                usage,
                latencyMs,
                false,
                error == null
                        ? "UNKNOWN_ERROR"
                        : error.getClass().getSimpleName()
        );
    }

    private void record(
            long userId,
            String requestId,
            String feature,
            AiProviderUsage usage,
            long latencyMs,
            boolean successful,
            String errorCode
    ) {
        try {
            AiProviderUsage safeUsage = usage == null
                    ? new AiProviderUsage(
                            "unknown",
                            "unknown",
                            null,
                            null,
                            null,
                            null,
                            null
                    )
                    : usage;

            String planCode;
            try {
                planCode = entitlementService.resolvePlanCode(userId);
            } catch (RuntimeException ex) {
                planCode = "UNKNOWN";
                log.warn(
                        "AI_USAGE_PLAN_SNAPSHOT_FAILED userId={} requestId={} errorType={}",
                        userId,
                        clean(requestId, "unknown"),
                        ex.getClass().getSimpleName()
                );
            }

            Instant eventAt = Instant.now();
            AiCostSnapshot costSnapshot = costCalculationService.calculateSnapshot(
                    safeUsage.provider(),
                    safeUsage.model(),
                    safeUsage.inputTokens(),
                    safeUsage.outputTokens(),
                    safeUsage.cachedTokens(),
                    eventAt
            );

            jdbcTemplate.update(
                    """
                    INSERT INTO ai_usage_events (
                        user_id,
                        request_id,
                        provider,
                        provider_request_id,
                        model,
                        feature,
                        plan_code,
                        input_tokens,
                        output_tokens,
                        cached_tokens,
                        total_tokens,
                        latency_ms,
                        successful,
                        error_code,
                        model_cost_id,
                        cost_currency,
                        input_rate_per_million,
                        cached_input_rate_per_million,
                        output_rate_per_million,
                        input_cost,
                        cached_input_cost,
                        output_cost,
                        estimated_cost,
                        cost_status,
                        cost_calculated_at,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    userId,
                    limit(clean(requestId, "unknown"), 64),
                    limit(clean(safeUsage.provider(), "unknown").toLowerCase(Locale.ROOT), 50),
                    nullableLimit(safeUsage.providerRequestId(), 120),
                    limit(clean(safeUsage.model(), "unknown"), 120),
                    limit(clean(feature, "UNKNOWN").toUpperCase(Locale.ROOT), 50),
                    limit(clean(planCode, "UNKNOWN").toUpperCase(Locale.ROOT), 30),
                    safeUsage.inputTokens(),
                    safeUsage.outputTokens(),
                    safeUsage.cachedTokens(),
                    safeUsage.totalTokens(),
                    Math.max(0L, latencyMs),
                    successful,
                    nullableLimit(errorCode, 120),
                    costSnapshot.modelCostId(),
                    costSnapshot.currency(),
                    costSnapshot.inputRatePerMillion(),
                    costSnapshot.cachedInputRatePerMillion(),
                    costSnapshot.outputRatePerMillion(),
                    costSnapshot.inputCost(),
                    costSnapshot.cachedInputCost(),
                    costSnapshot.outputCost(),
                    costSnapshot.estimatedCost(),
                    costSnapshot.status(),
                    toTimestamp(costSnapshot.calculatedAt()),
                    Timestamp.from(eventAt)
            );
        } catch (RuntimeException ex) {
            log.warn(
                    "AI_USAGE_LEDGER_WRITE_FAILED userId={} requestId={} feature={} successful={} errorType={}",
                    userId,
                    clean(requestId, "unknown"),
                    clean(feature, "UNKNOWN"),
                    successful,
                    ex.getClass().getSimpleName()
            );
        }
    }

    private static Timestamp toTimestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private static String clean(
            Object value,
            String fallback
    ) {
        String result = String.valueOf(value == null ? "" : value).trim();
        return result.isEmpty() ? fallback : result;
    }

    private static String limit(
            String value,
            int maxLength
    ) {
        return value.length() <= maxLength
                ? value
                : value.substring(0, maxLength);
    }

    private static String nullableLimit(
            Object value,
            int maxLength
    ) {
        String result = String.valueOf(value == null ? "" : value).trim();
        if (result.isEmpty()) {
            return null;
        }
        return limit(result, maxLength);
    }
}

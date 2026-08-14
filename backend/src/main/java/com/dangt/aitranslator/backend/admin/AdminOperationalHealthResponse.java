package com.dangt.aitranslator.backend.admin;

import java.time.Instant;
import java.util.List;

public record AdminOperationalHealthResponse(
        Instant generatedAt,
        String status,
        String liveness,
        String readiness,
        long uptimeSeconds,
        DatabaseHealth database,
        JvmHealth jvm,
        HttpHealth http,
        AiHealth ai,
        RevenueHealth revenue,
        SecurityHealth security,
        ErrorHealth errors,
        List<Check> checks
) {
    public record DatabaseHealth(
            boolean reachable,
            long latencyMs,
            String version,
            String latestMigrationVersion,
            String latestMigrationDescription,
            long failedMigrations
    ) {
    }

    public record JvmHealth(
            long heapUsedBytes,
            long heapMaxBytes,
            double heapUsagePercent,
            int availableProcessors
    ) {
    }

    public record HttpHealth(
            long requestsSinceStart,
            long clientErrorsSinceStart,
            long serverErrorsSinceStart,
            double serverErrorRatePercent,
            double averageLatencyMs
    ) {
    }

    public record AiHealth(
            long requests24h,
            long failed24h,
            double successRatePercent,
            long calculatedCost24h,
            long missingCost24h,
            double costCoveragePercent
    ) {
    }

    public record RevenueHealth(
            long paidTransactions24h,
            long failedTransactions24h,
            long normalizedRevenue24h,
            long missingRevenue24h,
            double revenueCoveragePercent
    ) {
    }

    public record SecurityHealth(
            long warnings24h,
            long critical24h,
            long denied24h,
            long failedLogins24h
    ) {
    }

    public record ErrorHealth(
            long openEvents,
            long criticalOpenEvents,
            long retryableOpenEvents,
            long newEvents24h
    ) {
    }

    public record Check(
            String code,
            String status,
            String title,
            String detail,
            String observedValue
    ) {
    }
}

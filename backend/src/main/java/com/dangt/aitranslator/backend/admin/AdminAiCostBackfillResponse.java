package com.dangt.aitranslator.backend.admin;

public record AdminAiCostBackfillResponse(
        String reportingCurrency,
        int scanned,
        int calculated,
        int missingRate,
        int tokenUsageUnavailable
) {
}

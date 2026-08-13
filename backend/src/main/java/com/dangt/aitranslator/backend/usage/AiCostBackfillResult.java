package com.dangt.aitranslator.backend.usage;

public record AiCostBackfillResult(
        int scanned,
        int calculated,
        int missingRate,
        int tokenUsageUnavailable
) {
}

package com.dangt.aitranslator.backend.billing;

public record RevenueBackfillResult(
        String reportingCurrency,
        int scanned,
        int normalized,
        int missingFx,
        int unsupportedCurrency
) {
}

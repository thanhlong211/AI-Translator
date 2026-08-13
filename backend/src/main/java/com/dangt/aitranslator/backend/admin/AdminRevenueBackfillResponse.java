package com.dangt.aitranslator.backend.admin;

public record AdminRevenueBackfillResponse(
        String reportingCurrency,
        int scanned,
        int normalized,
        int missingFx,
        int unsupportedCurrency
) {
}

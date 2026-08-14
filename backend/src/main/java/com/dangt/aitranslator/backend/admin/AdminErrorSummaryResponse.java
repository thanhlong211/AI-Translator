package com.dangt.aitranslator.backend.admin;

public record AdminErrorSummaryResponse(
        long totalEvents,
        long openEvents,
        long acknowledgedEvents,
        long resolvedEvents,
        long criticalOpenEvents,
        long retryableOpenEvents,
        int days,
        String timeZone
) {
}

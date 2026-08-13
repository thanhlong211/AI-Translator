package com.dangt.aitranslator.backend.admin;

import java.time.Instant;

public record AdminSecuritySummaryResponse(
        long totalEvents,
        long loginSuccess,
        long loginFailure,
        long deniedAccess,
        long sensitiveActions,
        long warningEvents,
        long criticalEvents,
        Instant since,
        Instant until,
        String timeZone
) {
}

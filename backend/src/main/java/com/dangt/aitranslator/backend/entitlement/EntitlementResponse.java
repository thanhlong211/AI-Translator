package com.dangt.aitranslator.backend.entitlement;

import java.time.Instant;
import java.util.Map;

public record EntitlementResponse(
        String planCode,
        String planName,
        String subscriptionStatus,
        String subscriptionSource,
        Instant periodEnd,
        Map<String, Boolean> features,
        Map<String, Long> limits,
        Map<String, Long> usage,
        boolean developmentOverride
) {
}

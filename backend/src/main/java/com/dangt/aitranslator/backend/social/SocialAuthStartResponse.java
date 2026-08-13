package com.dangt.aitranslator.backend.social;

import java.time.Instant;

public record SocialAuthStartResponse(
        boolean success,
        String attemptId,
        String pollSecret,
        String provider,
        String authorizationUrl,
        Instant expiresAt,
        long pollAfterMs
) {
}

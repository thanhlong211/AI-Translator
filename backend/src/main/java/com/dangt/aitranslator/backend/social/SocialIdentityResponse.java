package com.dangt.aitranslator.backend.social;

import java.time.Instant;

public record SocialIdentityResponse(
        Long id,
        String provider,
        String email,
        String displayName,
        String avatarUrl,
        Instant createdAt,
        Instant lastLoginAt
) {
}

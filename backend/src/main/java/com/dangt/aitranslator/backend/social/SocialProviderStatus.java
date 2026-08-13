package com.dangt.aitranslator.backend.social;

public record SocialProviderStatus(
        String provider,
        String displayName,
        boolean available,
        String reason
) {
}

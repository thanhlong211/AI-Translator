package com.dangt.aitranslator.backend.social;

public record SocialProviderProfile(
        String subject,
        String email,
        boolean emailVerified,
        String displayName,
        String avatarUrl
) {
}

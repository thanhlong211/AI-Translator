package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.auth.UserSummary;

public record AdminLoginResponse(
        boolean success,
        String accessToken,
        String tokenType,
        long expiresInSeconds,
        UserSummary user
) {
}

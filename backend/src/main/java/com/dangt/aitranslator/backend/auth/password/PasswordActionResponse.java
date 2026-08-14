package com.dangt.aitranslator.backend.auth.password;

public record PasswordActionResponse(
        boolean success,
        boolean sessionsRevoked,
        String message
) {
}

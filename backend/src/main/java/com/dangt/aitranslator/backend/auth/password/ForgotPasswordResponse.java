package com.dangt.aitranslator.backend.auth.password;

public record ForgotPasswordResponse(
        boolean accepted,
        String message
) {
}

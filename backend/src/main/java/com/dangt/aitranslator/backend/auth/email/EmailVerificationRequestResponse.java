package com.dangt.aitranslator.backend.auth.email;

public record EmailVerificationRequestResponse(
        boolean accepted,
        int cooldownSeconds,
        String message
) {
}

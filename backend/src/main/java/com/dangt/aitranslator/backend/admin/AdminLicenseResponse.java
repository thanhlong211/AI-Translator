package com.dangt.aitranslator.backend.admin;

import java.time.Instant;
import java.util.List;

public record AdminLicenseResponse(
        long id,
        String planCode,
        String status,
        String durationType,
        int maxActivations,
        int activationCount,
        Instant startsAt,
        Instant expiresAt,
        String keyHint,
        String note,
        Long createdByUserId,
        String createdByEmail,
        Instant createdAt,
        Instant updatedAt,
        String issuedKey,
        List<AdminLicenseActivationResponse> activations
) {
}

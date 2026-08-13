package com.dangt.aitranslator.backend.admin;

import java.time.Instant;

public record AdminLicenseActivationResponse(
        long id,
        long userId,
        String userEmail,
        String deviceId,
        String status,
        Instant activatedAt,
        Instant revokedAt,
        Long revokedByUserId,
        String revokedByEmail,
        String revokeReason,
        Long latestSubscriptionId
) {
}

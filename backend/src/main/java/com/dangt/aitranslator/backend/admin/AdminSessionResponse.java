package com.dangt.aitranslator.backend.admin;

import java.time.Instant;

public record AdminSessionResponse(
        long id,
        String deviceId,
        String deviceName,
        Instant createdAt,
        Instant lastUsedAt,
        Instant expiresAt
) {
}

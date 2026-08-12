package com.dangt.aitranslator.backend.session;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

public record DeviceSessionResponse(
        Long sessionId,
        String deviceId,
        String deviceName,
        boolean current,
        Instant createdAt,
        Instant lastUsedAt,
        Instant expiresAt
) {
    public static DeviceSessionResponse from(
            AuthSession session,
            boolean current
    ) {
        return new DeviceSessionResponse(
                session.getId(),
                session.getDeviceId(),
                session.getDeviceName(),
                current,
                session.getCreatedAt(),
                session.getLastUsedAt(),
                session.getExpiresAt()
        );
    }
}

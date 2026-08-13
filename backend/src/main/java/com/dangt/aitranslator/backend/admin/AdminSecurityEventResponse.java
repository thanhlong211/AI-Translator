package com.dangt.aitranslator.backend.admin;

import java.time.Instant;

public record AdminSecurityEventResponse(
        long id,
        String category,
        String eventType,
        String severity,
        String outcome,
        Long actorUserId,
        String actorEmail,
        String actorRole,
        String attemptedEmail,
        Long targetUserId,
        String targetEmail,
        String requestId,
        String httpMethod,
        String requestPath,
        String remoteIp,
        String forwardedFor,
        String userAgent,
        String details,
        Instant createdAt
) {
}

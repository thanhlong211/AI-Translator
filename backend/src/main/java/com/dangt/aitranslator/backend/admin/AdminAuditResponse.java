package com.dangt.aitranslator.backend.admin;

import java.time.Instant;

public record AdminAuditResponse(
        long id,
        Long actorUserId,
        String actorEmail,
        String actorRole,
        String action,
        Long targetUserId,
        String targetEmail,
        String details,
        Instant createdAt,
        String category,
        String requestId,
        String httpMethod,
        String requestPath,
        String remoteIp,
        String forwardedFor,
        String userAgent
) {
}

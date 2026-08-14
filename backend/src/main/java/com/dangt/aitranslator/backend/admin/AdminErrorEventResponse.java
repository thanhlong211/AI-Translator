package com.dangt.aitranslator.backend.admin;

import java.time.Instant;

public record AdminErrorEventResponse(
        long id,
        String status,
        String severity,
        String module,
        String errorCode,
        String exceptionType,
        String summary,
        boolean retryable,
        Long actorUserId,
        String actorEmail,
        String requestId,
        Integer httpStatus,
        String httpMethod,
        String requestPath,
        String remoteIp,
        String forwardedFor,
        String userAgent,
        Instant occurredAt,
        Long acknowledgedByUserId,
        String acknowledgedByEmail,
        Instant acknowledgedAt,
        String acknowledgementNote,
        Long resolvedByUserId,
        String resolvedByEmail,
        Instant resolvedAt,
        String resolutionNote
) {
}

package com.dangt.aitranslator.backend.admin;

import java.time.Instant;

public record AdminAuditResponse(
        long id,
        Long actorUserId,
        String actorEmail,
        String action,
        Long targetUserId,
        String targetEmail,
        String details,
        Instant createdAt
) {
}

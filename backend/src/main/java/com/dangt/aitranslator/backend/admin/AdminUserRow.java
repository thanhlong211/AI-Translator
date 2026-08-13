package com.dangt.aitranslator.backend.admin;

import java.time.Instant;
import java.util.List;

public record AdminUserRow(
        long id,
        String email,
        String status,
        String role,
        Instant createdAt,
        String planCode,
        String planSource,
        Instant planEndsAt,
        long monthlyUsage,
        long activeSessions,
        List<String> identities
) {
}

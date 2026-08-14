package com.dangt.aitranslator.backend.admin;

public record AdminAuditSummaryResponse(
        long totalActions,
        long uniqueActors,
        long affectedUsers,
        long accessActions,
        long billingActions,
        long sensitiveActions,
        int days,
        String timeZone
) {
}

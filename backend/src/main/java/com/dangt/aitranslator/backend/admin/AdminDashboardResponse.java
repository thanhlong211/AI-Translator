package com.dangt.aitranslator.backend.admin;

import java.util.List;
import java.util.Map;

public record AdminDashboardResponse(
        long totalUsers,
        long activeUsers,
        long suspendedUsers,
        long activeSessions,
        long usageToday,
        long usageMonth,
        Map<String, Long> planDistribution,
        List<AdminAuditResponse> recentAudit
) {
}

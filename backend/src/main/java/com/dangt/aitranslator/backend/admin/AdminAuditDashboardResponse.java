package com.dangt.aitranslator.backend.admin;

import java.util.List;

public record AdminAuditDashboardResponse(
        AdminAuditSummaryResponse summary,
        List<AdminAuditResponse> entries
) {
}

package com.dangt.aitranslator.backend.admin;

import java.util.List;

public record AdminSecurityDashboardResponse(
        AdminSecuritySummaryResponse summary,
        List<AdminSecurityEventResponse> events
) {
}

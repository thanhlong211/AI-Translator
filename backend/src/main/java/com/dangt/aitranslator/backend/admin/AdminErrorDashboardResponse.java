package com.dangt.aitranslator.backend.admin;

import java.util.List;

public record AdminErrorDashboardResponse(
        AdminErrorSummaryResponse summary,
        List<AdminErrorEventResponse> events
) {
}

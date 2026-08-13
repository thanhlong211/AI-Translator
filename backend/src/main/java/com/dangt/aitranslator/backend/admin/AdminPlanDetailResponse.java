package com.dangt.aitranslator.backend.admin;

import java.util.Map;

public record AdminPlanDetailResponse(
        String code,
        String displayName,
        String description,
        int rankOrder,
        boolean active,
        Map<String, Boolean> features,
        Map<String, Long> limits,
        AdminPlanUsageResponse usage
) {
}

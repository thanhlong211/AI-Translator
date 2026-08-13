package com.dangt.aitranslator.backend.admin;

public record AdminPlanResponse(
        String code,
        String displayName,
        int rankOrder,
        boolean active
) {
}

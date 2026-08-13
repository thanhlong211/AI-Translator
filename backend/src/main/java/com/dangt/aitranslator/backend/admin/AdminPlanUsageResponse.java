package com.dangt.aitranslator.backend.admin;

public record AdminPlanUsageResponse(
        long activeOverrides,
        long activeSubscriptions,
        long usableLicenses
) {
    public boolean hasActiveAssignments() {
        return activeOverrides > 0 || activeSubscriptions > 0;
    }
}

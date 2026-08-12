package com.dangt.aitranslator.backend.dashboard;

public record LearningDashboardOverview(
        long reviewed14Days,
        long correct14Days,
        long wrong14Days,
        int accuracy14Days,
        int activeDays14Days,
        int currentStreakDays,
        long weakItems,
        long masteredItems
) {
}

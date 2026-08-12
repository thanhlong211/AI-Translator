package com.dangt.aitranslator.backend.dashboard;

import java.time.LocalDate;

public record LearningDailyActivity(
        LocalDate date,
        long reviewed,
        long correct,
        long wrong,
        int accuracyPercent
) {
}

package com.dangt.aitranslator.backend.review;

import java.time.Instant;

public record ReviewSchedule(
        Instant dueAt,
        int intervalDays,
        double easeFactor,
        int repetitions,
        int lapseCount
) {
}

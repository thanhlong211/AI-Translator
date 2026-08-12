package com.dangt.aitranslator.backend.dashboard;

import com.dangt.aitranslator.backend.review.ReviewGrade;
import com.dangt.aitranslator.backend.review.ReviewItemType;

import java.time.Instant;

public record LearningRecentReview(
        Long eventId,
        ReviewItemType itemType,
        Long itemId,
        String primaryText,
        Boolean correct,
        ReviewGrade automaticGrade,
        Integer responseTimeMs,
        Instant reviewedAt
) {
}

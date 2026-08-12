package com.dangt.aitranslator.backend.dashboard;

import com.dangt.aitranslator.backend.review.ReviewItemType;
import com.dangt.aitranslator.backend.review.ReviewMasteryLevel;

public record LearningWeakItem(
        ReviewItemType itemType,
        Long itemId,
        String primaryText,
        String answer,
        String jlptLevel,
        ReviewMasteryLevel masteryLevel,
        int accuracyPercent,
        int correctCount,
        int wrongCount,
        int correctStreak,
        int priorityScore
) {
}

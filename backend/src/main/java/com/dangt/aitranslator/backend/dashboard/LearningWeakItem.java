package com.dangt.aitranslator.backend.dashboard;

import com.dangt.aitranslator.backend.review.ReviewItemType;
import com.dangt.aitranslator.backend.review.ReviewMasteryLevel;
import com.dangt.aitranslator.backend.study.StudyLanguage;

public record LearningWeakItem(
        ReviewItemType itemType,
        Long itemId,
        StudyLanguage language,
        String primaryText,
        String answer,
        String jlptLevel,
        String cefrLevel,
        ReviewMasteryLevel masteryLevel,
        int accuracyPercent,
        int correctCount,
        int wrongCount,
        int correctStreak,
        int priorityScore
) {
}

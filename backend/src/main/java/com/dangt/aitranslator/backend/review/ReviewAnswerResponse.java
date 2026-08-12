package com.dangt.aitranslator.backend.review;

public record ReviewAnswerResponse(
        boolean success,
        boolean correct,
        boolean practice,
        ReviewGrade automaticGrade,
        ReviewMasteryLevel masteryLevel,
        int accuracyPercent,
        String correctAnswer,
        ReviewItemResponse item
) {
}

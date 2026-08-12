package com.dangt.aitranslator.backend.review;

import org.springframework.stereotype.Service;

@Service
public class ReviewMasteryService {

    public ReviewMasteryLevel level(
            int correctCount,
            int wrongCount,
            int correctStreak
    ) {
        int correct =
                Math.max(0, correctCount);

        int wrong =
                Math.max(0, wrongCount);

        int streak =
                Math.max(0, correctStreak);

        int total =
                correct + wrong;

        if (total == 0) {
            return ReviewMasteryLevel.NEW;
        }

        double accuracy =
                (double) correct
                        /
                (double) total;

        if (
                accuracy < 0.50
                ||
                wrong >= correct + 2
        ) {
            return ReviewMasteryLevel.WEAK;
        }

        if (
                correct < 3
                ||
                streak < 2
                ||
                accuracy < 0.70
        ) {
            return ReviewMasteryLevel.LEARNING;
        }

        if (
                correct >= 8
                &&
                streak >= 5
                &&
                accuracy >= 0.90
        ) {
            return ReviewMasteryLevel.MASTERED;
        }

        return ReviewMasteryLevel.FAMILIAR;
    }

    public ReviewGrade automaticGrade(
            boolean correct,
            int correctCountAfter,
            int wrongCountAfter,
            int correctStreakAfter
    ) {
        if (!correct) {
            return ReviewGrade.AGAIN;
        }

        ReviewMasteryLevel level =
                level(
                        correctCountAfter,
                        wrongCountAfter,
                        correctStreakAfter
                );

        return switch (level) {
            case NEW, WEAK ->
                    ReviewGrade.HARD;

            case LEARNING, FAMILIAR ->
                    ReviewGrade.GOOD;

            case MASTERED ->
                    ReviewGrade.EASY;
        };
    }

    public int accuracyPercent(
            int correctCount,
            int wrongCount
    ) {
        int correct =
                Math.max(0, correctCount);

        int wrong =
                Math.max(0, wrongCount);

        int total =
                correct + wrong;

        if (total == 0) {
            return 0;
        }

        return (int) Math.round(
                (
                        (double) correct
                        /
                        (double) total
                )
                *
                100.0
        );
    }
}

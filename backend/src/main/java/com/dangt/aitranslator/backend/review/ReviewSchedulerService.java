package com.dangt.aitranslator.backend.review;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class ReviewSchedulerService {

    private static final double MIN_EASE = 1.30;
    private static final double MAX_EASE = 3.00;

    public ReviewSchedule next(
            int currentIntervalDays,
            double currentEaseFactor,
            int currentRepetitions,
            int currentLapseCount,
            ReviewGrade grade,
            Instant now
    ) {
        if (grade == null) {
            throw new IllegalArgumentException(
                    "Review grade không được để trống."
            );
        }

        int interval =
                Math.max(
                        0,
                        currentIntervalDays
                );

        double ease =
                clampEase(
                        currentEaseFactor
                );

        int repetitions =
                Math.max(
                        0,
                        currentRepetitions
                );

        int lapses =
                Math.max(
                        0,
                        currentLapseCount
                );

        return switch (grade) {
            case AGAIN -> {
                double nextEase =
                        clampEase(
                                ease - 0.20
                        );

                yield new ReviewSchedule(
                        now.plus(
                                10,
                                ChronoUnit.MINUTES
                        ),
                        0,
                        nextEase,
                        0,
                        lapses + 1
                );
            }

            case HARD -> {
                int nextInterval =
                        interval <= 0
                                ? 1
                                : Math.max(
                                        1,
                                        (int) Math.round(
                                                interval * 1.20
                                        )
                                );

                yield new ReviewSchedule(
                        now.plus(
                                nextInterval,
                                ChronoUnit.DAYS
                        ),
                        nextInterval,
                        clampEase(
                                ease - 0.15
                        ),
                        repetitions + 1,
                        lapses
                );
            }

            case GOOD -> {
                int nextRepetitions =
                        repetitions + 1;

                int nextInterval =
                        switch (repetitions) {
                            case 0 -> 1;
                            case 1 -> 3;
                            default -> Math.max(
                                    1,
                                    (int) Math.round(
                                            Math.max(
                                                    1,
                                                    interval
                                            ) * ease
                                    )
                            );
                        };

                yield new ReviewSchedule(
                        now.plus(
                                nextInterval,
                                ChronoUnit.DAYS
                        ),
                        nextInterval,
                        ease,
                        nextRepetitions,
                        lapses
                );
            }

            case EASY -> {
                int nextRepetitions =
                        repetitions + 1;

                double nextEase =
                        clampEase(
                                ease + 0.15
                        );

                int nextInterval =
                        switch (repetitions) {
                            case 0 -> 3;
                            case 1 -> 7;
                            default -> Math.max(
                                    2,
                                    (int) Math.round(
                                            Math.max(
                                                    1,
                                                    interval
                                            )
                                            *
                                            nextEase
                                            *
                                            1.30
                                    )
                            );
                        };

                yield new ReviewSchedule(
                        now.plus(
                                nextInterval,
                                ChronoUnit.DAYS
                        ),
                        nextInterval,
                        nextEase,
                        nextRepetitions,
                        lapses
                );
            }
        };
    }

    private double clampEase(
            double value
    ) {
        double normalized =
                value <= 0
                        ? 2.50
                        : value;

        return Math.max(
                MIN_EASE,
                Math.min(
                        MAX_EASE,
                        normalized
                )
        );
    }
}

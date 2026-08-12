package com.dangt.aitranslator.backend.review;

public record ReviewStatsResponse(
        long dueNow,
        long vocabularyDue,
        long grammarDue,
        long reviewedLast24h,
        long correctLast24h,
        long wrongLast24h,
        int accuracyLast24h,
        long againLast24h,
        long hardLast24h,
        long goodLast24h,
        long easyLast24h
) {
}

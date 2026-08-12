package com.dangt.aitranslator.backend.dashboard;

import java.util.List;

public record LearningDashboardResponse(
        LearningDashboardOverview overview,
        List<LearningDailyActivity> dailyActivity,
        List<LearningWeakItem> weakItems,
        List<LearningRecentReview> recentReviews
) {
}

package com.dangt.aitranslator.backend.admin;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record AdminMarginDashboardResponse(
        String reportingCurrency,
        String analyticsTimeZone,
        int days,
        Instant from,
        Instant to,
        BigDecimal grossRevenue,
        BigDecimal refunds,
        BigDecimal netRevenue,
        BigDecimal aiCost,
        BigDecimal grossProfit,
        BigDecimal grossMarginPercent,
        boolean marginAvailable,
        long paidTransactions,
        long refundTransactions,
        long revenueEvents,
        long normalizedRevenueEvents,
        long missingFxEvents,
        BigDecimal revenueCoveragePercent,
        long aiEvents,
        long calculatedAiCostEvents,
        long missingAiCostEvents,
        BigDecimal aiCostCoveragePercent,
        List<AdminMarginDailyResponse> daily,
        List<AdminMarginBreakdownResponse> plans,
        List<AdminMarginBreakdownResponse> users
) {
}

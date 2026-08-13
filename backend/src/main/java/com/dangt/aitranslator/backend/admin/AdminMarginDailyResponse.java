package com.dangt.aitranslator.backend.admin;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AdminMarginDailyResponse(
        LocalDate date,
        BigDecimal grossRevenue,
        BigDecimal refunds,
        BigDecimal netRevenue,
        BigDecimal aiCost,
        BigDecimal grossProfit,
        BigDecimal grossMarginPercent,
        boolean marginAvailable,
        long revenueEvents,
        long missingFxEvents,
        long aiEvents,
        long missingAiCostEvents
) {
}

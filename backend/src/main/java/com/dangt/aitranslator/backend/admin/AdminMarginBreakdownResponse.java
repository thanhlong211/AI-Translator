package com.dangt.aitranslator.backend.admin;

import java.math.BigDecimal;

public record AdminMarginBreakdownResponse(
        String key,
        String label,
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

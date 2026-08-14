package com.dangt.aitranslator.backend.entitlement;

public record DailyQuotaReservation(
        long userId,
        String quotaKey,
        long units,
        boolean reserved
) {
    public static DailyQuotaReservation unlimited(long userId, String quotaKey, long units) {
        return new DailyQuotaReservation(userId, quotaKey, units, false);
    }
}

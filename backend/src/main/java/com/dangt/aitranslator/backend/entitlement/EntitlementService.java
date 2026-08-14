package com.dangt.aitranslator.backend.entitlement;

import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class EntitlementService {

    private final JdbcTemplate jdbcTemplate;
    private final DailyQuotaService dailyQuotaService;
    private final String developmentPlanOverride;

    public EntitlementService(
            JdbcTemplate jdbcTemplate,
            DailyQuotaService dailyQuotaService,
            @Value("${app.entitlements.dev-plan-override:}")
            String developmentPlanOverride
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.dailyQuotaService = dailyQuotaService;
        this.developmentPlanOverride = normalizePlan(developmentPlanOverride);
    }

    @Transactional(readOnly = true)
    public EntitlementResponse resolve(UserAccount user) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("Không xác định được tài khoản.");
        }

        EffectiveSubscription subscription =
                developmentPlanOverride.isBlank()
                        ? findEffectiveSubscription(user.getId())
                        : new EffectiveSubscription(
                                developmentPlanOverride,
                                "DEVELOPMENT_OVERRIDE",
                                "ENVIRONMENT",
                                null
                        );

        String planCode = subscription.planCode();
        PlanInfo plan = findPlan(planCode);

        return new EntitlementResponse(
                plan.code(),
                plan.displayName(),
                subscription.status(),
                subscription.source(),
                subscription.periodEnd(),
                loadFeatures(plan.code()),
                loadLimits(plan.code()),
                loadUsage(user.getId()),
                !developmentPlanOverride.isBlank()
        );
    }

    @Transactional(readOnly = true)
    public String resolvePlanCode(long userId) {
        if (userId <= 0) {
            throw new IllegalArgumentException("userId không hợp lệ.");
        }

        EffectiveSubscription subscription =
                developmentPlanOverride.isBlank()
                        ? findEffectiveSubscription(userId)
                        : new EffectiveSubscription(
                                developmentPlanOverride,
                                "DEVELOPMENT_OVERRIDE",
                                "ENVIRONMENT",
                                null
                        );

        return findPlan(subscription.planCode()).code();
    }

    @Transactional(readOnly = true)
    public void requireTranslationQuota(UserAccount user) {
        EntitlementResponse entitlement = resolve(user);
        long limit = entitlement.limits().getOrDefault(
                "monthlyTranslations",
                0L
        );

        if (limit < 0) {
            return;
        }

        long used = entitlement.usage().getOrDefault(
                "monthlyTranslationsUsed",
                0L
        );

        if (used >= limit) {
            throw new ForbiddenException(
                    "Đã dùng hết quota dịch tháng của gói "
                            + entitlement.planName()
                            + "."
            );
        }
    }

    @Transactional(readOnly = true)
    public void requireContextItems(UserAccount user, int requestedItems) {
        if (requestedItems < 0) {
            throw new IllegalArgumentException("Số context item không hợp lệ.");
        }

        EntitlementResponse entitlement = resolve(user);
        long limit = entitlement.limits().getOrDefault("contextItems", 0L);
        if (limit < 0 || requestedItems <= limit) {
            return;
        }

        throw new ForbiddenException(
                "Gói "
                        + entitlement.planName()
                        + " cho phép tối đa "
                        + limit
                        + " context item mỗi request."
        );
    }

    @Transactional
    public List<DailyQuotaReservation> reserveMangaPage(
            UserAccount user,
            boolean continuous
    ) {
        EntitlementResponse entitlement = resolve(user);
        List<DailyQuotaReservation> reservations = new java.util.ArrayList<>();

        reserveDailyQuota(
                user,
                entitlement,
                "mangaPagesPerDay",
                "MANGA_PAGE",
                1L,
                reservations
        );

        if (continuous) {
            try {
                reserveDailyQuota(
                        user,
                        entitlement,
                        "continuousMangaPagesPerDay",
                        "MANGA_CONTINUOUS_PAGE",
                        1L,
                        reservations
                );
            } catch (RuntimeException ex) {
                releaseDailyReservations(reservations);
                throw ex;
            }
        }

        return List.copyOf(reservations);
    }

    @Transactional
    public void releaseDailyReservations(List<DailyQuotaReservation> reservations) {
        if (reservations == null || reservations.isEmpty()) {
            return;
        }
        for (DailyQuotaReservation reservation : reservations) {
            if (reservation != null && reservation.reserved()) {
                dailyQuotaService.release(
                        reservation.userId(),
                        reservation.quotaKey(),
                        reservation.units()
                );
            }
        }
    }

    private void reserveDailyQuota(
            UserAccount user,
            EntitlementResponse entitlement,
            String limitKey,
            String quotaKey,
            long units,
            List<DailyQuotaReservation> reservations
    ) {
        long limit = entitlement.limits().getOrDefault(limitKey, 0L);
        if (limit < 0) {
            reservations.add(DailyQuotaReservation.unlimited(
                    user.getId(), quotaKey, units
            ));
            return;
        }

        boolean reserved = dailyQuotaService.reserve(
                user.getId(),
                quotaKey,
                limit,
                units
        );
        if (!reserved) {
            throw new ForbiddenException(
                    "Đã dùng hết quota "
                            + limitKey
                            + " của gói "
                            + entitlement.planName()
                            + " trong ngày hôm nay."
            );
        }

        reservations.add(new DailyQuotaReservation(
                user.getId(), quotaKey, units, true
        ));
    }

    @Transactional(readOnly = true)
    public void requireDeviceSlot(UserAccount user, long activeOtherDevices) {
        EntitlementResponse entitlement = resolve(user);
        long limit = entitlement.limits().getOrDefault("devices", 0L);

        if (limit < 0) {
            return;
        }

        if (activeOtherDevices >= limit) {
            throw new ForbiddenException(
                    "Đã đạt giới hạn "
                            + limit
                            + " thiết bị của gói "
                            + entitlement.planName()
                            + ". Hãy thu hồi một thiết bị cũ trước khi đăng nhập thiết bị mới."
            );
        }
    }

    @Transactional(readOnly = true)
    public boolean hasFeature(UserAccount user, String featureKey) {
        String cleanKey = String.valueOf(featureKey == null ? "" : featureKey).trim();
        if (cleanKey.isEmpty()) {
            return false;
        }

        return Boolean.TRUE.equals(
                resolve(user).features().get(cleanKey)
        );
    }

    @Transactional(readOnly = true)
    public void requireFeature(
            UserAccount user,
            String featureKey,
            String featureName,
            String requiredPlan
    ) {
        String cleanKey = String.valueOf(featureKey == null ? "" : featureKey).trim();
        if (cleanKey.isEmpty()) {
            throw new IllegalArgumentException("Feature key không được để trống.");
        }

        EntitlementResponse entitlement = resolve(user);
        if (Boolean.TRUE.equals(entitlement.features().get(cleanKey))) {
            return;
        }

        String cleanFeatureName = String.valueOf(
                featureName == null ? cleanKey : featureName
        ).trim();
        String minimumPlan = findMinimumPlanNameForFeature(cleanKey);
        if (minimumPlan.isBlank()) {
            minimumPlan = String.valueOf(
                    requiredPlan == null ? "gói trả phí" : requiredPlan
            ).trim();
        }

        throw new ForbiddenException(
                cleanFeatureName
                        + " không có trong gói "
                        + entitlement.planName()
                        + ". Gói tối thiểu đang bật: "
                        + minimumPlan
                        + "."
        );
    }

    private EffectiveSubscription findEffectiveSubscription(long userId) {
        List<EffectiveSubscription> adminOverrides = jdbcTemplate.query(
                """
                SELECT o.plan_code, o.expires_at
                FROM user_plan_overrides o
                INNER JOIN plan_catalog p
                    ON p.code = o.plan_code
                   AND p.active = TRUE
                WHERE o.user_id = ?
                  AND o.active = TRUE
                  AND o.effective_from <= CURRENT_TIMESTAMP(6)
                  AND (o.expires_at IS NULL OR o.expires_at > CURRENT_TIMESTAMP(6))
                LIMIT 1
                """,
                (rs, rowNum) -> new EffectiveSubscription(
                        normalizePlan(rs.getString("plan_code")),
                        "ACTIVE",
                        "ADMIN",
                        toInstant(rs.getTimestamp("expires_at"))
                ),
                userId
        );

        if (!adminOverrides.isEmpty()) {
            return adminOverrides.getFirst();
        }

        List<EffectiveSubscription> matches = jdbcTemplate.query(
                """
                SELECT s.plan, s.status, s.source, s.period_end
                FROM subscriptions s
                INNER JOIN plan_catalog p
                    ON p.code = s.plan
                   AND p.active = TRUE
                WHERE s.user_id = ?
                  AND s.status IN ('ACTIVE', 'TRIAL', 'GRANDFATHERED')
                  AND (s.period_start IS NULL OR s.period_start <= CURRENT_TIMESTAMP(6))
                  AND (s.period_end IS NULL OR s.period_end > CURRENT_TIMESTAMP(6))
                ORDER BY p.rank_order DESC, s.id DESC
                LIMIT 1
                """,
                (rs, rowNum) -> new EffectiveSubscription(
                        normalizePlan(rs.getString("plan")),
                        rs.getString("status"),
                        rs.getString("source"),
                        toInstant(rs.getTimestamp("period_end"))
                ),
                userId
        );

        if (matches.isEmpty()) {
            return new EffectiveSubscription(
                    "FREE",
                    "ACTIVE",
                    "DEFAULT",
                    null
            );
        }

        return matches.getFirst();
    }

    private PlanInfo findPlan(String requestedPlan) {
        String planCode = requestedPlan.isBlank() ? "FREE" : requestedPlan;

        List<PlanInfo> plans = jdbcTemplate.query(
                """
                SELECT code, display_name
                FROM plan_catalog
                WHERE code = ? AND active = TRUE
                LIMIT 1
                """,
                (rs, rowNum) -> new PlanInfo(
                        rs.getString("code"),
                        rs.getString("display_name")
                ),
                planCode
        );

        if (!plans.isEmpty()) {
            return plans.getFirst();
        }

        if (!"FREE".equals(planCode)) {
            return findPlan("FREE");
        }

        throw new IllegalStateException("Plan FREE chưa được cấu hình trong database.");
    }

    private String findMinimumPlanNameForFeature(String featureKey) {
        List<String> plans = jdbcTemplate.query(
                """
                SELECT p.display_name
                FROM plan_catalog p
                INNER JOIN plan_features f
                    ON f.plan_code = p.code
                   AND f.feature_key = ?
                   AND f.enabled = TRUE
                WHERE p.active = TRUE
                ORDER BY p.rank_order ASC, p.code ASC
                LIMIT 1
                """,
                (rs, rowNum) -> rs.getString("display_name"),
                featureKey
        );
        return plans.isEmpty() ? "" : plans.getFirst();
    }

    private Map<String, Boolean> loadFeatures(String planCode) {
        Map<String, Boolean> features = new LinkedHashMap<>();

        jdbcTemplate.query(
                """
                SELECT feature_key, enabled
                FROM plan_features
                WHERE plan_code = ?
                ORDER BY feature_key
                """,
                (RowCallbackHandler) rs -> {
                    features.put(
                            rs.getString("feature_key"),
                            rs.getBoolean("enabled")
                    );
                },
                planCode
        );

        return Map.copyOf(features);
    }

    private Map<String, Long> loadUsage(long userId) {
        Instant monthStart = YearMonth
                .now(ZoneOffset.UTC)
                .atDay(1)
                .atStartOfDay()
                .toInstant(ZoneOffset.UTC);

        Long used = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM translation_usage_events
                WHERE user_id = ?
                  AND created_at >= ?
                """,
                Long.class,
                userId,
                Timestamp.from(monthStart)
        );

        return Map.of(
                "monthlyTranslationsUsed", used == null ? 0L : used,
                "mangaPagesToday", dailyQuotaService.usedToday(userId, "MANGA_PAGE"),
                "continuousMangaPagesToday", dailyQuotaService.usedToday(userId, "MANGA_CONTINUOUS_PAGE")
        );
    }

    private Map<String, Long> loadLimits(String planCode) {
        Map<String, Long> limits = new LinkedHashMap<>();

        jdbcTemplate.query(
                """
                SELECT limit_key, limit_value
                FROM plan_limits
                WHERE plan_code = ?
                ORDER BY limit_key
                """,
                (RowCallbackHandler) rs -> {
                    limits.put(
                            rs.getString("limit_key"),
                            rs.getLong("limit_value")
                    );
                },
                planCode
        );

        return Map.copyOf(limits);
    }

    static String normalizePlan(String value) {
        return String.valueOf(value == null ? "" : value)
                .trim()
                .toUpperCase(Locale.ROOT);
    }

    private static Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private record EffectiveSubscription(
            String planCode,
            String status,
            String source,
            Instant periodEnd
    ) {
    }

    private record PlanInfo(
            String code,
            String displayName
    ) {
    }
}

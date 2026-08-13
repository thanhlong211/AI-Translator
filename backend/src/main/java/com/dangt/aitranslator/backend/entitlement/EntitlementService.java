package com.dangt.aitranslator.backend.entitlement;

import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final String developmentPlanOverride;

    public EntitlementService(
            JdbcTemplate jdbcTemplate,
            @Value("${app.entitlements.dev-plan-override:}")
            String developmentPlanOverride
    ) {
        this.jdbcTemplate = jdbcTemplate;
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
        String cleanRequiredPlan = String.valueOf(
                requiredPlan == null ? "PRO" : requiredPlan
        ).trim().toUpperCase(Locale.ROOT);

        throw new ForbiddenException(
                cleanFeatureName
                        + " yêu cầu gói "
                        + cleanRequiredPlan
                        + " hoặc cao hơn."
        );
    }

    private EffectiveSubscription findEffectiveSubscription(long userId) {
        List<EffectiveSubscription> adminOverrides = jdbcTemplate.query(
                """
                SELECT plan_code, expires_at
                FROM user_plan_overrides
                WHERE user_id = ?
                  AND active = TRUE
                  AND effective_from <= CURRENT_TIMESTAMP(6)
                  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP(6))
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

    private Map<String, Boolean> loadFeatures(String planCode) {
        Map<String, Boolean> features = new LinkedHashMap<>();

        jdbcTemplate.query(
                """
                SELECT feature_key, enabled
                FROM plan_features
                WHERE plan_code = ?
                ORDER BY feature_key
                """,
                rs -> {
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
                "monthlyTranslationsUsed",
                used == null ? 0L : used
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
                rs -> {
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

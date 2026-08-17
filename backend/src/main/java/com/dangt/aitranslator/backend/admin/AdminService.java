package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.common.ConflictException;
import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminService {

    private final JdbcTemplate jdbcTemplate;
    private final AdminGuard adminGuard;
    private final AdminAuditService auditService;
    private final AdminSafetyService safetyService;

    public AdminService(
            JdbcTemplate jdbcTemplate,
            AdminGuard adminGuard,
            AdminAuditService auditService,
            AdminSafetyService safetyService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.adminGuard = adminGuard;
        this.auditService = auditService;
        this.safetyService = safetyService;
    }

    @Transactional(readOnly = true)
    public AdminDashboardResponse dashboard() {
        long totalUsers = count("SELECT COUNT(*) FROM users");
        long activeUsers = count("SELECT COUNT(*) FROM users WHERE status = 'ACTIVE'");
        long suspendedUsers = count("SELECT COUNT(*) FROM users WHERE status <> 'ACTIVE'");
        long activeSessions = count(
                """
                SELECT COUNT(*)
                FROM auth_sessions
                WHERE revoked_at IS NULL
                  AND expires_at > CURRENT_TIMESTAMP(6)
                """
        );

        Instant todayStart = Instant.now()
                .atZone(ZoneOffset.UTC)
                .toLocalDate()
                .atStartOfDay()
                .toInstant(ZoneOffset.UTC);

        Instant monthStart = YearMonth.now(ZoneOffset.UTC)
                .atDay(1)
                .atStartOfDay()
                .toInstant(ZoneOffset.UTC);

        long usageToday = usageSince(todayStart);
        long usageMonth = usageSince(monthStart);

        Map<String, Long> planDistribution = new LinkedHashMap<>();
        jdbcTemplate.query(
                """
                SELECT x.plan_code, COUNT(*) AS total
                FROM (
                    SELECT u.id,
                           COALESCE(
                               (
                                   SELECT o.plan_code
                                   FROM user_plan_overrides o
                                   INNER JOIN plan_catalog op ON op.code = o.plan_code AND op.active = TRUE
                                   WHERE o.user_id = u.id
                                     AND o.active = TRUE
                                     AND o.effective_from <= CURRENT_TIMESTAMP(6)
                                     AND (o.expires_at IS NULL OR o.expires_at > CURRENT_TIMESTAMP(6))
                                   LIMIT 1
                               ),
                               (
                                   SELECT s.plan
                                   FROM subscriptions s
                                   INNER JOIN plan_catalog p ON p.code = s.plan AND p.active = TRUE
                                   WHERE s.user_id = u.id
                                     AND s.status IN ('ACTIVE', 'TRIAL', 'GRANDFATHERED')
                                     AND (s.period_start IS NULL OR s.period_start <= CURRENT_TIMESTAMP(6))
                                     AND (s.period_end IS NULL OR s.period_end > CURRENT_TIMESTAMP(6))
                                   ORDER BY p.rank_order DESC, s.id DESC
                                   LIMIT 1
                               ),
                               'FREE'
                           ) AS plan_code
                    FROM users u
                ) x
                GROUP BY x.plan_code
                ORDER BY x.plan_code
                """,
                (rs, rowNum) -> Map.entry(
                        rs.getString("plan_code"),
                        rs.getLong("total")
                )
        ).forEach(entry -> planDistribution.put(entry.getKey(), entry.getValue()));

        return new AdminDashboardResponse(
                totalUsers,
                activeUsers,
                suspendedUsers,
                activeSessions,
                usageToday,
                usageMonth,
                Map.copyOf(planDistribution),
                auditService.recent(12)
        );
    }

    @Transactional(readOnly = true)
    public List<AdminPlanResponse> listPlans() {
        return jdbcTemplate.query(
                """
                SELECT code, display_name, rank_order, active
                FROM plan_catalog
                ORDER BY rank_order, code
                """,
                (rs, rowNum) -> new AdminPlanResponse(
                        rs.getString("code"),
                        rs.getString("display_name"),
                        rs.getInt("rank_order"),
                        rs.getBoolean("active")
                )
        );
    }

    @Transactional(readOnly = true)
    public AdminPlanSchemaResponse planSchema() {
        return new AdminPlanSchemaResponse(
                knownFeatureKeys(),
                knownLimitKeys()
        );
    }

    @Transactional(readOnly = true)
    public AdminPlanDetailResponse planDetail(String requestedPlanCode) {
        String planCode = requirePlanCode(requestedPlanCode);

        List<PlanMetadata> rows = jdbcTemplate.query(
                """
                SELECT code, display_name, description, rank_order, active
                FROM plan_catalog
                WHERE code = ?
                LIMIT 1
                """,
                (rs, rowNum) -> new PlanMetadata(
                        rs.getString("code"),
                        rs.getString("display_name"),
                        rs.getString("description"),
                        rs.getInt("rank_order"),
                        rs.getBoolean("active")
                ),
                planCode
        );

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Plan không tồn tại.");
        }

        PlanMetadata plan = rows.getFirst();
        return new AdminPlanDetailResponse(
                plan.code(),
                plan.displayName(),
                plan.description(),
                plan.rankOrder(),
                plan.active(),
                loadPlanFeatures(plan.code()),
                loadPlanLimits(plan.code()),
                loadPlanUsage(plan.code())
        );
    }

    @Transactional
    public AdminPlanDetailResponse createPlan(
            UserAccount actor,
            AdminPlanCreateRequest request
    ) {
        String planCode = requirePlanCode(request.code());
        String displayName = cleanRequiredText(request.displayName(), "Tên hiển thị");
        String description = cleanOptionalText(request.description());
        String reason = cleanRequiredText(request.reason(), "Lý do");
        int rankOrder = request.rankOrder() == null
                ? nextPlanRank()
                : request.rankOrder();
        boolean active = request.active() == null || request.active();

        Integer exists = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM plan_catalog WHERE code = ?",
                Integer.class,
                planCode
        );
        if (exists != null && exists > 0) {
            throw new ConflictException("Plan " + planCode + " đã tồn tại.");
        }

        List<String> featureKeys = knownFeatureKeys();
        List<String> limitKeys = knownLimitKeys();
        Map<String, Boolean> features = normalizedFeatures(request.features(), featureKeys);
        Map<String, Long> limits = normalizedLimits(request.limits(), limitKeys);

        jdbcTemplate.update(
                """
                INSERT INTO plan_catalog (
                    code, display_name, description, rank_order, active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                """,
                planCode,
                displayName,
                description,
                rankOrder,
                active
        );

        replacePlanFeatures(planCode, featureKeys, features);
        replacePlanLimits(planCode, limitKeys, limits);

        auditService.record(
                actor.getId(),
                "PLAN_CREATED",
                null,
                "plan=" + planCode
                        + "; rank=" + rankOrder
                        + "; active=" + active
                        + "; reason=" + reason
        );

        return planDetail(planCode);
    }

    @Transactional
    public AdminPlanDetailResponse updatePlan(
            UserAccount actor,
            String requestedPlanCode,
            AdminPlanDefinitionUpdateRequest request
    ) {
        String planCode = requirePlanCode(requestedPlanCode);
        AdminPlanDetailResponse before = planDetail(planCode);
        String displayName = cleanRequiredText(request.displayName(), "Tên hiển thị");
        String description = cleanOptionalText(request.description());
        String reason = cleanRequiredText(request.reason(), "Lý do");
        boolean active = request.active();

        if ("FREE".equals(planCode) && !active) {
            throw new IllegalArgumentException("Plan FREE là fallback hệ thống và không thể tắt.");
        }

        if (before.active() && !active && before.usage().hasActiveAssignments()) {
            throw new ConflictException(
                    "Không thể tắt plan " + planCode
                            + " vì đang có " + before.usage().activeSubscriptions()
                            + " user subscription và " + before.usage().activeOverrides()
                            + " user Admin override còn hiệu lực. Hãy chuyển quyền user trước."
            );
        }

        List<String> featureKeys = knownFeatureKeys();
        List<String> limitKeys = knownLimitKeys();
        requireCompleteKeys(request.features(), featureKeys, "feature");
        requireCompleteKeys(request.limits(), limitKeys, "limit");
        Map<String, Boolean> features = normalizedFeatures(request.features(), featureKeys);
        Map<String, Long> limits = normalizedLimits(request.limits(), limitKeys);

        jdbcTemplate.update(
                """
                UPDATE plan_catalog
                SET display_name = ?,
                    description = ?,
                    rank_order = ?,
                    active = ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE code = ?
                """,
                displayName,
                description,
                request.rankOrder(),
                active,
                planCode
        );

        replacePlanFeatures(planCode, featureKeys, features);
        replacePlanLimits(planCode, limitKeys, limits);

        auditService.record(
                actor.getId(),
                "PLAN_UPDATED",
                null,
                "plan=" + planCode
                        + "; displayName=" + before.displayName() + "->" + displayName
                        + "; rank=" + before.rankOrder() + "->" + request.rankOrder()
                        + "; active=" + before.active() + "->" + active
                        + "; reason=" + reason
        );

        return planDetail(planCode);
    }

    @Transactional(readOnly = true)
    public AdminUserPageResponse listUsers(
            String query,
            String status,
            int requestedPage,
            int requestedSize
    ) {
        int page = Math.max(0, requestedPage);
        int size = Math.max(10, Math.min(requestedSize, 100));
        int offset = page * size;

        String cleanQuery = String.valueOf(query == null ? "" : query)
                .trim()
                .toLowerCase(Locale.ROOT);
        String cleanStatus = String.valueOf(status == null ? "" : status)
                .trim()
                .toUpperCase(Locale.ROOT);
        String like = "%" + cleanQuery + "%";

        Long total = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM users u
                WHERE (? = '' OR LOWER(u.email) LIKE ? OR CAST(u.id AS CHAR) = ?)
                  AND (? = '' OR u.status = ?)
                """,
                Long.class,
                cleanQuery,
                like,
                cleanQuery,
                cleanStatus,
                cleanStatus
        );

        List<AdminUserRow> items = jdbcTemplate.query(
                userRowsSql() +
                        """
                        WHERE (? = '' OR LOWER(u.email) LIKE ? OR CAST(u.id AS CHAR) = ?)
                          AND (? = '' OR u.status = ?)
                        ORDER BY u.id DESC
                        LIMIT ? OFFSET ?
                        """,
                (rs, rowNum) -> mapUserRow(rs),
                cleanQuery,
                like,
                cleanQuery,
                cleanStatus,
                cleanStatus,
                size,
                offset
        );

        return new AdminUserPageResponse(
                items,
                page,
                size,
                total == null ? 0L : total
        );
    }

    @Transactional(readOnly = true)
    public AdminUserDetailResponse userDetail(long userId) {
        List<AdminUserRow> users = jdbcTemplate.query(
                userRowsSql() + " WHERE u.id = ? LIMIT 1",
                (rs, rowNum) -> mapUserRow(rs),
                userId
        );

        if (users.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy user.");
        }

        List<AdminSessionResponse> sessions = jdbcTemplate.query(
                """
                SELECT id, device_id, device_name, created_at, last_used_at, expires_at
                FROM auth_sessions
                WHERE user_id = ?
                  AND revoked_at IS NULL
                  AND expires_at > CURRENT_TIMESTAMP(6)
                ORDER BY created_at DESC
                """,
                (rs, rowNum) -> new AdminSessionResponse(
                        rs.getLong("id"),
                        rs.getString("device_id"),
                        rs.getString("device_name"),
                        toInstant(rs.getTimestamp("created_at")),
                        toInstant(rs.getTimestamp("last_used_at")),
                        toInstant(rs.getTimestamp("expires_at"))
                ),
                userId
        );

        return new AdminUserDetailResponse(
                users.getFirst(),
                sessions,
                auditService.recentForTarget(userId, 30)
        );
    }

    @Transactional
    public AdminActionResponse updateStatus(
            UserAccount actor,
            long userId,
            AdminStatusUpdateRequest request
    ) {
        TargetUser target = requireTarget(userId);
        requireCanManage(actor, target);

        String status = request.status().trim().toUpperCase(Locale.ROOT);
        if (!List.of("ACTIVE", "SUSPENDED").contains(status)) {
            throw new IllegalArgumentException("Status chỉ hỗ trợ ACTIVE hoặc SUSPENDED.");
        }

        if (!"ACTIVE".equals(status)) {
            safetyService.requireCanSuspendUser(actor, userId, target.role());
        }

        jdbcTemplate.update(
                "UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
                status,
                userId
        );

        if (!"ACTIVE".equals(status)) {
            revokeAllSessions(userId);
        }

        auditService.record(
                actor.getId(),
                "USER_STATUS_CHANGED",
                userId,
                "status=" + status + "; reason=" + request.reason().trim()
        );

        return AdminActionResponse.ok(
                "Đã cập nhật trạng thái user thành " + status + "."
        );
    }

    @Transactional
    public AdminActionResponse revokeSessions(
            UserAccount actor,
            long userId,
            AdminReasonRequest request
    ) {
        TargetUser target = requireTarget(userId);
        requireCanManage(actor, target);
        safetyService.requireCanRevokeSessions(actor, userId);

        int changed = revokeAllSessions(userId);

        auditService.record(
                actor.getId(),
                "USER_SESSIONS_REVOKED",
                userId,
                "revoked=" + changed + "; reason=" + request.reason().trim()
        );

        return AdminActionResponse.ok(
                "Đã thu hồi " + changed + " phiên đăng nhập."
        );
    }

    @Transactional
    public AdminActionResponse resetDeviceBinding(
            UserAccount actor,
            long userId,
            AdminReasonRequest request
    ) {
        TargetUser target = requireTarget(userId);

        requireCanManage(actor, target);
        safetyService.requireCanRevokeSessions(actor, userId);

        int revokedSessions = revokeAllSessions(userId);

        int updated = jdbcTemplate.update(
                """
                UPDATE users
                SET bound_device_id = NULL,
                    bound_device_name = NULL,
                    device_bound_at = NULL,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                userId
        );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Không tìm thấy user cần reset thiết bị."
            );
        }

        auditService.record(
                actor.getId(),
                "USER_DEVICE_BINDING_RESET",
                userId,
                "sessionsRevoked="
                        + revokedSessions
                        + "; reason="
                        + request.reason().trim()
        );

        return AdminActionResponse.ok(
                "Đã gỡ liên kết thiết bị và thu hồi toàn bộ phiên đăng nhập."
        );
    }


    @Transactional
    public AdminActionResponse setPlanOverride(
            UserAccount actor,
            long userId,
            AdminPlanUpdateRequest request
    ) {
        TargetUser target = requireTarget(userId);
        requireCanManage(actor, target);

        String planCode = request.planCode()
                .trim()
                .toUpperCase(Locale.ROOT);

        Integer planExists = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM plan_catalog WHERE code = ? AND active = TRUE",
                Integer.class,
                planCode
        );

        if (planExists == null || planExists == 0) {
            throw new IllegalArgumentException("Plan không tồn tại hoặc đang bị tắt.");
        }

        Instant expiresAt = parseOptionalFutureInstant(request.expiresAt());

        jdbcTemplate.update(
                """
                INSERT INTO user_plan_overrides (
                    user_id,
                    plan_code,
                    active,
                    effective_from,
                    expires_at,
                    reason,
                    updated_by_user_id,
                    created_at,
                    updated_at
                ) VALUES (?, ?, TRUE, CURRENT_TIMESTAMP(6), ?, ?, ?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                ON DUPLICATE KEY UPDATE
                    plan_code = VALUES(plan_code),
                    active = TRUE,
                    effective_from = CURRENT_TIMESTAMP(6),
                    expires_at = VALUES(expires_at),
                    reason = VALUES(reason),
                    updated_by_user_id = VALUES(updated_by_user_id),
                    updated_at = CURRENT_TIMESTAMP(6)
                """,
                userId,
                planCode,
                expiresAt == null ? null : Timestamp.from(expiresAt),
                request.reason().trim(),
                actor.getId()
        );

        auditService.record(
                actor.getId(),
                "USER_PLAN_OVERRIDE_SET",
                userId,
                "plan=" + planCode
                        + "; expiresAt=" + (expiresAt == null ? "none" : expiresAt)
                        + "; reason=" + request.reason().trim()
        );

        return AdminActionResponse.ok(
                "Đã áp dụng Admin plan override: " + planCode + "."
        );
    }

    @Transactional
    public AdminActionResponse clearPlanOverride(
            UserAccount actor,
            long userId,
            AdminReasonRequest request
    ) {
        TargetUser target = requireTarget(userId);
        requireCanManage(actor, target);

        int changed = jdbcTemplate.update(
                """
                UPDATE user_plan_overrides
                SET active = FALSE,
                    reason = ?,
                    updated_by_user_id = ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE user_id = ?
                  AND active = TRUE
                """,
                request.reason().trim(),
                actor.getId(),
                userId
        );

        auditService.record(
                actor.getId(),
                "USER_PLAN_OVERRIDE_CLEARED",
                userId,
                "changed=" + changed + "; reason=" + request.reason().trim()
        );

        return AdminActionResponse.ok(
                changed > 0
                        ? "Đã xóa Admin plan override."
                        : "User không có Admin plan override đang hoạt động."
        );
    }

    private List<String> knownFeatureKeys() {
        return List.copyOf(jdbcTemplate.query(
                """
                SELECT DISTINCT feature_key
                FROM plan_features
                ORDER BY feature_key
                """,
                (rs, rowNum) -> rs.getString("feature_key")
        ));
    }

    private List<String> knownLimitKeys() {
        return List.copyOf(jdbcTemplate.query(
                """
                SELECT DISTINCT limit_key
                FROM plan_limits
                ORDER BY limit_key
                """,
                (rs, rowNum) -> rs.getString("limit_key")
        ));
    }

    private Map<String, Boolean> loadPlanFeatures(String planCode) {
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

    private Map<String, Long> loadPlanLimits(String planCode) {
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


    private AdminPlanUsageResponse loadPlanUsage(String planCode) {
        Long activeOverrides = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM user_plan_overrides
                WHERE plan_code = ?
                  AND active = TRUE
                  AND effective_from <= CURRENT_TIMESTAMP(6)
                  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP(6))
                """,
                Long.class,
                planCode
        );

        Long activeSubscriptions = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(DISTINCT user_id)
                FROM subscriptions
                WHERE plan = ?
                  AND status IN ('ACTIVE', 'TRIAL', 'GRANDFATHERED')
                  AND (period_start IS NULL OR period_start <= CURRENT_TIMESTAMP(6))
                  AND (period_end IS NULL OR period_end > CURRENT_TIMESTAMP(6))
                """,
                Long.class,
                planCode
        );

        Long usableLicenses = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM license_keys
                WHERE plan_code = ?
                  AND status = 'AVAILABLE'
                  AND activation_count < max_activations
                  AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP(6))
                  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP(6))
                """,
                Long.class,
                planCode
        );

        return new AdminPlanUsageResponse(
                activeOverrides == null ? 0L : activeOverrides,
                activeSubscriptions == null ? 0L : activeSubscriptions,
                usableLicenses == null ? 0L : usableLicenses
        );
    }

    private void requireCompleteKeys(
            Map<String, ?> requested,
            List<String> knownKeys,
            String type
    ) {
        Map<String, ?> source = requested == null ? Map.of() : requested;
        List<String> missing = new ArrayList<>();
        for (String key : knownKeys) {
            if (!source.containsKey(key)) {
                missing.add(key);
            }
        }
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException(
                    "Thiếu " + type + " key: " + String.join(", ", missing)
                            + ". Hãy tải lại Admin Console để lấy schema mới nhất."
            );
        }
    }

    private Map<String, Boolean> normalizedFeatures(
            Map<String, Boolean> requested,
            List<String> knownKeys
    ) {
        Map<String, Boolean> source = requested == null ? Map.of() : requested;
        rejectUnknownKeys(source.keySet(), knownKeys, "feature");

        Map<String, Boolean> result = new LinkedHashMap<>();
        for (String key : knownKeys) {
            result.put(key, Boolean.TRUE.equals(source.get(key)));
        }
        return result;
    }

    private Map<String, Long> normalizedLimits(
            Map<String, Long> requested,
            List<String> knownKeys
    ) {
        Map<String, Long> source = requested == null ? Map.of() : requested;
        rejectUnknownKeys(source.keySet(), knownKeys, "limit");

        Map<String, Long> result = new LinkedHashMap<>();
        for (String key : knownKeys) {
            Long value = source.getOrDefault(key, 0L);
            if (value == null || value < -1L) {
                throw new IllegalArgumentException(
                        "Limit " + key + " phải >= -1 (-1 = không giới hạn)."
                );
            }
            result.put(key, value);
        }
        return result;
    }

    private void rejectUnknownKeys(
            java.util.Set<String> requestedKeys,
            List<String> knownKeys,
            String type
    ) {
        List<String> unknown = new ArrayList<>();
        for (String key : requestedKeys) {
            if (!knownKeys.contains(key)) {
                unknown.add(key);
            }
        }
        if (!unknown.isEmpty()) {
            throw new IllegalArgumentException(
                    "Có " + type + " key chưa được hệ thống định nghĩa: "
                            + String.join(", ", unknown)
            );
        }
    }

    private void replacePlanFeatures(
            String planCode,
            List<String> knownKeys,
            Map<String, Boolean> features
    ) {
        jdbcTemplate.update(
                "DELETE FROM plan_features WHERE plan_code = ?",
                planCode
        );
        for (String key : knownKeys) {
            jdbcTemplate.update(
                    "INSERT INTO plan_features (plan_code, feature_key, enabled) VALUES (?, ?, ?)",
                    planCode,
                    key,
                    Boolean.TRUE.equals(features.get(key))
            );
        }
    }

    private void replacePlanLimits(
            String planCode,
            List<String> knownKeys,
            Map<String, Long> limits
    ) {
        jdbcTemplate.update(
                "DELETE FROM plan_limits WHERE plan_code = ?",
                planCode
        );
        for (String key : knownKeys) {
            jdbcTemplate.update(
                    "INSERT INTO plan_limits (plan_code, limit_key, limit_value) VALUES (?, ?, ?)",
                    planCode,
                    key,
                    limits.getOrDefault(key, 0L)
            );
        }
    }

    private int nextPlanRank() {
        Integer max = jdbcTemplate.queryForObject(
                "SELECT COALESCE(MAX(rank_order), 0) FROM plan_catalog",
                Integer.class
        );
        return (max == null ? 0 : max) + 10;
    }

    private static String requirePlanCode(String value) {
        String code = String.valueOf(value == null ? "" : value)
                .trim()
                .toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z][A-Z0-9_]{0,29}")) {
            throw new IllegalArgumentException(
                    "Plan code chỉ được dùng A-Z, 0-9, dấu gạch dưới và phải bắt đầu bằng chữ."
            );
        }
        return code;
    }

    private static String cleanRequiredText(String value, String fieldName) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isEmpty()) {
            throw new IllegalArgumentException(fieldName + " không được để trống.");
        }
        return clean;
    }

    private static String cleanOptionalText(String value) {
        return String.valueOf(value == null ? "" : value).trim();
    }

    private int revokeAllSessions(long userId) {
        return jdbcTemplate.update(
                """
                UPDATE auth_sessions
                SET revoked_at = CURRENT_TIMESTAMP(6)
                WHERE user_id = ?
                  AND revoked_at IS NULL
                """,
                userId
        );
    }

    private TargetUser requireTarget(long userId) {
        List<TargetUser> rows = jdbcTemplate.query(
                "SELECT id, email, role FROM users WHERE id = ? LIMIT 1",
                (rs, rowNum) -> new TargetUser(
                        rs.getLong("id"),
                        rs.getString("email"),
                        rs.getString("role")
                ),
                userId
        );

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy user.");
        }
        return rows.getFirst();
    }

    private void requireCanManage(UserAccount actor, TargetUser target) {
        if (adminGuard.isAdminRole(target.role()) && !adminGuard.isSuperAdmin(actor)) {
            throw new ForbiddenException("Chỉ SUPER_ADMIN được quản lý tài khoản Admin khác.");
        }
    }

    private Instant parseOptionalFutureInstant(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isEmpty()) {
            return null;
        }

        try {
            Instant parsed = Instant.parse(clean);
            if (!parsed.isAfter(Instant.now())) {
                throw new IllegalArgumentException("Ngày hết hạn phải ở tương lai.");
            }
            return parsed;
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException(
                    "expiresAt phải là ISO-8601 UTC, ví dụ 2026-12-31T23:59:59Z."
            );
        }
    }

    private long usageSince(Instant start) {
        Long value = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM translation_usage_events WHERE created_at >= ?",
                Long.class,
                Timestamp.from(start)
        );
        return value == null ? 0L : value;
    }

    private long count(String sql) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class);
        return value == null ? 0L : value;
    }

    private AdminUserRow mapUserRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        String providers = rs.getString("identity_providers");
        List<String> identities = providers == null || providers.isBlank()
                ? List.of()
                : Arrays.stream(providers.split(","))
                        .map(String::trim)
                        .filter(value -> !value.isEmpty())
                        .toList();

        return new AdminUserRow(
                rs.getLong("id"),
                rs.getString("email"),
                rs.getString("status"),
                rs.getString("role"),
                toInstant(rs.getTimestamp("created_at")),
                rs.getString("plan_code"),
                rs.getString("plan_source"),
                toInstant(rs.getTimestamp("plan_ends_at")),
                rs.getLong("monthly_usage"),
                rs.getLong("active_sessions"),
                identities
        );
    }

    private String userRowsSql() {
        return """
                SELECT u.id,
                       u.email,
                       u.status,
                       u.role,
                       u.created_at,
                       COALESCE(
                           (
                               SELECT o.plan_code
                               FROM user_plan_overrides o
                               INNER JOIN plan_catalog op ON op.code = o.plan_code AND op.active = TRUE
                               WHERE o.user_id = u.id
                                 AND o.active = TRUE
                                 AND o.effective_from <= CURRENT_TIMESTAMP(6)
                                 AND (o.expires_at IS NULL OR o.expires_at > CURRENT_TIMESTAMP(6))
                               LIMIT 1
                           ),
                           (
                               SELECT s.plan
                               FROM subscriptions s
                               INNER JOIN plan_catalog p ON p.code = s.plan AND p.active = TRUE
                               WHERE s.user_id = u.id
                                 AND s.status IN ('ACTIVE', 'TRIAL', 'GRANDFATHERED')
                                 AND (s.period_start IS NULL OR s.period_start <= CURRENT_TIMESTAMP(6))
                                 AND (s.period_end IS NULL OR s.period_end > CURRENT_TIMESTAMP(6))
                               ORDER BY p.rank_order DESC, s.id DESC
                               LIMIT 1
                           ),
                           'FREE'
                       ) AS plan_code,
                       CASE
                           WHEN EXISTS (
                               SELECT 1
                               FROM user_plan_overrides o
                               INNER JOIN plan_catalog op ON op.code = o.plan_code AND op.active = TRUE
                               WHERE o.user_id = u.id
                                 AND o.active = TRUE
                                 AND o.effective_from <= CURRENT_TIMESTAMP(6)
                                 AND (o.expires_at IS NULL OR o.expires_at > CURRENT_TIMESTAMP(6))
                           ) THEN 'ADMIN'
                           ELSE COALESCE(
                               (
                                   SELECT s.source
                                   FROM subscriptions s
                                   INNER JOIN plan_catalog p ON p.code = s.plan AND p.active = TRUE
                                   WHERE s.user_id = u.id
                                     AND s.status IN ('ACTIVE', 'TRIAL', 'GRANDFATHERED')
                                     AND (s.period_start IS NULL OR s.period_start <= CURRENT_TIMESTAMP(6))
                                     AND (s.period_end IS NULL OR s.period_end > CURRENT_TIMESTAMP(6))
                                   ORDER BY p.rank_order DESC, s.id DESC
                                   LIMIT 1
                               ),
                               'DEFAULT'
                           )
                       END AS plan_source,
                       CASE
                           WHEN EXISTS (
                               SELECT 1
                               FROM user_plan_overrides o
                               INNER JOIN plan_catalog op ON op.code = o.plan_code AND op.active = TRUE
                               WHERE o.user_id = u.id
                                 AND o.active = TRUE
                                 AND o.effective_from <= CURRENT_TIMESTAMP(6)
                                 AND (o.expires_at IS NULL OR o.expires_at > CURRENT_TIMESTAMP(6))
                           ) THEN (
                               SELECT o.expires_at
                               FROM user_plan_overrides o
                               INNER JOIN plan_catalog op ON op.code = o.plan_code AND op.active = TRUE
                               WHERE o.user_id = u.id
                                 AND o.active = TRUE
                                 AND o.effective_from <= CURRENT_TIMESTAMP(6)
                                 AND (o.expires_at IS NULL OR o.expires_at > CURRENT_TIMESTAMP(6))
                               LIMIT 1
                           )
                           ELSE (
                               SELECT s.period_end
                               FROM subscriptions s
                               INNER JOIN plan_catalog p ON p.code = s.plan AND p.active = TRUE
                               WHERE s.user_id = u.id
                                 AND s.status IN ('ACTIVE', 'TRIAL', 'GRANDFATHERED')
                                 AND (s.period_start IS NULL OR s.period_start <= CURRENT_TIMESTAMP(6))
                                 AND (s.period_end IS NULL OR s.period_end > CURRENT_TIMESTAMP(6))
                               ORDER BY p.rank_order DESC, s.id DESC
                               LIMIT 1
                           )
                       END AS plan_ends_at,
                       (
                           SELECT COUNT(*)
                           FROM translation_usage_events t
                           WHERE t.user_id = u.id
                             AND t.created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01 00:00:00')
                       ) AS monthly_usage,
                       (
                           SELECT COUNT(*)
                           FROM auth_sessions a
                           WHERE a.user_id = u.id
                             AND a.revoked_at IS NULL
                             AND a.expires_at > CURRENT_TIMESTAMP(6)
                       ) AS active_sessions,
                       (
                           SELECT GROUP_CONCAT(DISTINCT i.provider ORDER BY i.provider SEPARATOR ',')
                           FROM user_identities i
                           WHERE i.user_id = u.id
                       ) AS identity_providers
                FROM users u
                """;
    }

    private static Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private record PlanMetadata(
            String code,
            String displayName,
            String description,
            int rankOrder,
            boolean active
    ) {
    }

    private record TargetUser(
            long id,
            String email,
            String role
    ) {
    }
}

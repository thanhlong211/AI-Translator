package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
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

    public AdminService(
            JdbcTemplate jdbcTemplate,
            AdminGuard adminGuard,
            AdminAuditService auditService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.adminGuard = adminGuard;
        this.auditService = auditService;
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

        if (actor.getId().equals(userId) && !"ACTIVE".equals(status)) {
            throw new IllegalArgumentException("Không thể tự khóa tài khoản Admin đang dùng.");
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
                       COALESCE(
                           (
                               SELECT o.expires_at
                               FROM user_plan_overrides o
                               WHERE o.user_id = u.id
                                 AND o.active = TRUE
                                 AND o.effective_from <= CURRENT_TIMESTAMP(6)
                                 AND (o.expires_at IS NULL OR o.expires_at > CURRENT_TIMESTAMP(6))
                               LIMIT 1
                           ),
                           (
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
                       ) AS plan_ends_at,
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

    private record TargetUser(
            long id,
            String email,
            String role
    ) {
    }
}

package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.common.RequestCorrelation;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;

@Service
public class AdminAuditService {

    private static final String CATEGORY_SQL = """
            CASE
                WHEN CAST(a.action AS BINARY) LIKE CAST('PLAN_%' AS BINARY) OR CAST(a.action AS BINARY) LIKE CAST('USER_PLAN_%' AS BINARY) THEN 'PLANS'
                WHEN CAST(a.action AS BINARY) LIKE CAST('PRICE_%' AS BINARY)
                  OR CAST(a.action AS BINARY) LIKE CAST('PRICING_%' AS BINARY)
                  OR CAST(a.action AS BINARY) LIKE CAST('SUBSCRIPTION_%' AS BINARY)
                  OR CAST(a.action AS BINARY) LIKE CAST('LICENSE_%' AS BINARY)
                  OR CAST(a.action AS BINARY) LIKE CAST('PAYMENT_%' AS BINARY)
                  OR CAST(a.action AS BINARY) LIKE CAST('TRANSACTION_%' AS BINARY)
                  OR CAST(a.action AS BINARY) LIKE CAST('FX_%' AS BINARY)
                  OR CAST(a.action AS BINARY) LIKE CAST('REVENUE_%' AS BINARY) THEN 'BILLING'
                WHEN CAST(a.action AS BINARY) LIKE CAST('AI_%' AS BINARY) THEN 'AI_COST'
                WHEN CAST(a.action AS BINARY) LIKE CAST('USER_%' AS BINARY)
                  OR CAST(a.action AS BINARY) LIKE CAST('ADMIN_%' AS BINARY)
                  OR CAST(a.action AS BINARY) LIKE CAST('ROLE_%' AS BINARY)
                  OR CAST(a.action AS BINARY) LIKE CAST('SESSION_%' AS BINARY) THEN 'ACCESS'
                ELSE 'OPERATIONS'
            END
            """;

    private static final String FILTER_SQL = """
              AND (? = '' OR CAST(%s AS BINARY) = CAST(? AS BINARY))
              AND (? = '' OR CAST(a.action AS BINARY) = CAST(? AS BINARY))
              AND (
                    ? = '' OR
                    CAST(LOWER(CONCAT_WS(' ', actor.email, CAST(a.actor_user_id AS CHAR))) AS BINARY) LIKE CAST(? AS BINARY)
              )
              AND (
                    ? = '' OR
                    CAST(LOWER(CONCAT_WS(' ', target.email, CAST(a.target_user_id AS CHAR))) AS BINARY) LIKE CAST(? AS BINARY)
              )
              AND (
                    ? = '' OR
                    CAST(LOWER(CONCAT_WS(' ',
                        a.action,
                        a.details,
                        actor.email,
                        target.email,
                        a.request_id,
                        a.request_path,
                        a.remote_ip
                    )) AS BINARY) LIKE CAST(? AS BINARY)
              )
            """.formatted(CATEGORY_SQL);

    private final JdbcTemplate jdbcTemplate;
    private final AdminSecurityEventService securityEventService;
    private final ZoneId analyticsZone;

    public AdminAuditService(
            JdbcTemplate jdbcTemplate,
            AdminSecurityEventService securityEventService,
            @Value("${app.admin.analytics-time-zone:Asia/Ho_Chi_Minh}") String analyticsTimeZone
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.securityEventService = securityEventService;
        this.analyticsZone = ZoneId.of(analyticsTimeZone);
    }

    public void record(
            Long actorUserId,
            String action,
            Long targetUserId,
            String details
    ) {
        String cleanDetails = cleanDetails(details);
        RequestMeta request = currentRequest();
        jdbcTemplate.update(
                """
                INSERT INTO admin_audit_log (
                    actor_user_id,
                    actor_role,
                    action,
                    target_user_id,
                    details,
                    request_id,
                    http_method,
                    request_path,
                    remote_ip,
                    forwarded_for,
                    user_agent,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                """,
                actorUserId,
                currentActorRole(),
                cleanToken(action, 80),
                targetUserId,
                cleanDetails,
                cleanToken(RequestCorrelation.currentId(), 100),
                request.method(),
                request.path(),
                request.remoteIp(),
                request.forwardedFor(),
                request.userAgent()
        );

        securityEventService.recordAuditAction(
                actorUserId,
                action,
                targetUserId,
                cleanDetails
        );
    }

    public AdminAuditDashboardResponse dashboard(
            int requestedDays,
            String category,
            String action,
            String actor,
            String target,
            String query,
            int requestedLimit
    ) {
        int days = Math.max(1, Math.min(requestedDays, 90));
        int limit = Math.max(1, Math.min(requestedLimit, 500));

        String cleanCategory = upper(category);
        String cleanAction = upper(action);
        String cleanActor = lower(actor);
        String cleanTarget = lower(target);
        String cleanQuery = lower(query);
        String actorLike = "%" + cleanActor + "%";
        String targetLike = "%" + cleanTarget + "%";
        String queryLike = "%" + cleanQuery + "%";

        Object[] filterArgs = filterArgs(
                cleanCategory,
                cleanAction,
                cleanActor,
                actorLike,
                cleanTarget,
                targetLike,
                cleanQuery,
                queryLike
        );

        String summarySql = """
                SELECT COUNT(*) AS total_actions,
                       COUNT(DISTINCT a.actor_user_id) AS unique_actors,
                       COUNT(DISTINCT a.target_user_id) AS affected_users,
                       COALESCE(SUM(CASE WHEN %s = 'ACCESS' THEN 1 ELSE 0 END), 0) AS access_actions,
                       COALESCE(SUM(CASE WHEN %s = 'BILLING' THEN 1 ELSE 0 END), 0) AS billing_actions,
                       COALESCE(SUM(CASE
                           WHEN CAST(a.action AS BINARY) LIKE CAST('%%REFUND%%' AS BINARY)
                             OR CAST(a.action AS BINARY) LIKE CAST('%%REVOK%%' AS BINARY)
                             OR CAST(a.action AS BINARY) LIKE CAST('%%CANCEL%%' AS BINARY)
                             OR CAST(a.action AS BINARY) LIKE CAST('%%ROLE_CHANGED%%' AS BINARY)
                             OR CAST(a.action AS BINARY) LIKE CAST('%%STATUS_CHANGED%%' AS BINARY)
                             OR CAST(a.action AS BINARY) LIKE CAST('%%BACKFILL%%' AS BINARY)
                           THEN 1 ELSE 0 END), 0) AS sensitive_actions
                FROM admin_audit_log a
                LEFT JOIN users actor ON actor.id = a.actor_user_id
                LEFT JOIN users target ON target.id = a.target_user_id
                WHERE a.created_at >= TIMESTAMPADD(DAY, ?, CURRENT_TIMESTAMP(6))
                  AND a.created_at <= CURRENT_TIMESTAMP(6)
                %s
                """.formatted(CATEGORY_SQL, CATEGORY_SQL, FILTER_SQL);

        Object[] summaryArgs = prepend(-days, filterArgs);
        AdminAuditSummaryResponse summary = jdbcTemplate.queryForObject(
                summarySql,
                (rs, rowNum) -> new AdminAuditSummaryResponse(
                        rs.getLong("total_actions"),
                        rs.getLong("unique_actors"),
                        rs.getLong("affected_users"),
                        rs.getLong("access_actions"),
                        rs.getLong("billing_actions"),
                        rs.getLong("sensitive_actions"),
                        days,
                        analyticsZone.getId()
                ),
                summaryArgs
        );

        String entriesSql = """
                SELECT a.id,
                       a.actor_user_id,
                       actor.email AS actor_email,
                       a.actor_role,
                       a.action,
                       a.target_user_id,
                       target.email AS target_email,
                       a.details,
                       a.created_at,
                       %s AS audit_category,
                       a.request_id,
                       a.http_method,
                       a.request_path,
                       a.remote_ip,
                       a.forwarded_for,
                       a.user_agent
                FROM admin_audit_log a
                LEFT JOIN users actor ON actor.id = a.actor_user_id
                LEFT JOIN users target ON target.id = a.target_user_id
                WHERE a.created_at >= TIMESTAMPADD(DAY, ?, CURRENT_TIMESTAMP(6))
                  AND a.created_at <= CURRENT_TIMESTAMP(6)
                %s
                ORDER BY a.id DESC
                LIMIT ?
                """.formatted(CATEGORY_SQL, FILTER_SQL);

        Object[] entriesArgs = append(prepend(-days, filterArgs), limit);
        List<AdminAuditResponse> entries = jdbcTemplate.query(
                entriesSql,
                (rs, rowNum) -> mapAudit(rs),
                entriesArgs
        );

        return new AdminAuditDashboardResponse(summary, entries);
    }

    public List<AdminAuditResponse> recent(int requestedLimit) {
        int limit = Math.max(1, Math.min(requestedLimit, 200));

        return jdbcTemplate.query(
                """
                SELECT a.id,
                       a.actor_user_id,
                       actor.email AS actor_email,
                       a.actor_role,
                       a.action,
                       a.target_user_id,
                       target.email AS target_email,
                       a.details,
                       a.created_at,
                       %s AS audit_category,
                       a.request_id,
                       a.http_method,
                       a.request_path,
                       a.remote_ip,
                       a.forwarded_for,
                       a.user_agent
                FROM admin_audit_log a
                LEFT JOIN users actor ON actor.id = a.actor_user_id
                LEFT JOIN users target ON target.id = a.target_user_id
                ORDER BY a.id DESC
                LIMIT ?
                """.formatted(CATEGORY_SQL),
                (rs, rowNum) -> mapAudit(rs),
                limit
        );
    }

    public List<AdminAuditResponse> recentForTarget(
            long targetUserId,
            int requestedLimit
    ) {
        int limit = Math.max(1, Math.min(requestedLimit, 100));

        return jdbcTemplate.query(
                """
                SELECT a.id,
                       a.actor_user_id,
                       actor.email AS actor_email,
                       a.actor_role,
                       a.action,
                       a.target_user_id,
                       target.email AS target_email,
                       a.details,
                       a.created_at,
                       %s AS audit_category,
                       a.request_id,
                       a.http_method,
                       a.request_path,
                       a.remote_ip,
                       a.forwarded_for,
                       a.user_agent
                FROM admin_audit_log a
                LEFT JOIN users actor ON actor.id = a.actor_user_id
                LEFT JOIN users target ON target.id = a.target_user_id
                WHERE a.target_user_id = ?
                ORDER BY a.id DESC
                LIMIT ?
                """.formatted(CATEGORY_SQL),
                (rs, rowNum) -> mapAudit(rs),
                targetUserId,
                limit
        );
    }

    private static AdminAuditResponse mapAudit(ResultSet rs) throws SQLException {
        return new AdminAuditResponse(
                rs.getLong("id"),
                nullableLong(rs.getObject("actor_user_id")),
                rs.getString("actor_email"),
                rs.getString("actor_role"),
                rs.getString("action"),
                nullableLong(rs.getObject("target_user_id")),
                rs.getString("target_email"),
                rs.getString("details"),
                toInstant(rs.getTimestamp("created_at")),
                rs.getString("audit_category"),
                rs.getString("request_id"),
                rs.getString("http_method"),
                rs.getString("request_path"),
                rs.getString("remote_ip"),
                rs.getString("forwarded_for"),
                rs.getString("user_agent")
        );
    }

    private RequestMeta currentRequest() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) {
            return RequestMeta.EMPTY;
        }
        HttpServletRequest request = attributes.getRequest();
        return new RequestMeta(
                cleanToken(request.getMethod(), 12),
                cleanToken(request.getRequestURI(), 500),
                cleanToken(request.getRemoteAddr(), 64),
                cleanToken(request.getHeader("X-Forwarded-For"), 500),
                cleanToken(request.getHeader("User-Agent"), 500)
        );
    }

    private static String currentActorRole() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            return "";
        }
        return cleanToken(jwt.getClaimAsString("role"), 30);
    }

    private static Object[] filterArgs(
            String category,
            String action,
            String actor,
            String actorLike,
            String target,
            String targetLike,
            String query,
            String queryLike
    ) {
        return new Object[]{
                category, category,
                action, action,
                actor, actorLike,
                target, targetLike,
                query, queryLike
        };
    }

    private static Object[] prepend(Object first, Object[] rest) {
        Object[] result = new Object[rest.length + 1];
        result[0] = first;
        System.arraycopy(rest, 0, result, 1, rest.length);
        return result;
    }

    private static Object[] append(Object[] source, Object last) {
        Object[] result = new Object[source.length + 1];
        System.arraycopy(source, 0, result, 0, source.length);
        result[source.length] = last;
        return result;
    }

    private static String cleanDetails(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        return clean.length() <= 2000 ? clean : clean.substring(0, 2000);
    }

    private static String cleanToken(String value, int max) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        return clean.length() <= max ? clean : clean.substring(0, max);
    }

    private static String upper(String value) {
        return String.valueOf(value == null ? "" : value).trim().toUpperCase(Locale.ROOT);
    }

    private static String lower(String value) {
        return String.valueOf(value == null ? "" : value).trim().toLowerCase(Locale.ROOT);
    }

    private static Long nullableLong(Object value) {
        if (value == null) {
            return null;
        }
        return ((Number) value).longValue();
    }

    private static Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private record RequestMeta(
            String method,
            String path,
            String remoteIp,
            String forwardedFor,
            String userAgent
    ) {
        private static final RequestMeta EMPTY = new RequestMeta("", "", "", "", "");
    }
}

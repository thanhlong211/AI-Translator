package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.common.RequestCorrelation;
import com.dangt.aitranslator.backend.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;

@Service
public class AdminSecurityEventService {

    private static final Logger log = LoggerFactory.getLogger(AdminSecurityEventService.class);

    private final JdbcTemplate jdbcTemplate;
    private final ZoneId analyticsZone;

    public AdminSecurityEventService(
            JdbcTemplate jdbcTemplate,
            @Value("${app.admin.analytics-time-zone:Asia/Ho_Chi_Minh}") String analyticsTimeZone
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.analyticsZone = ZoneId.of(analyticsTimeZone);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordLoginSuccess(UserAccount user, String attemptedEmail) {
        recordSafely(
                "AUTHENTICATION",
                "ADMIN_LOGIN_SUCCESS",
                "INFO",
                "SUCCESS",
                user == null ? null : user.getId(),
                user == null ? null : user.getRole(),
                cleanEmail(attemptedEmail),
                user == null ? null : user.getId(),
                "Admin Console login accepted."
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordLoginFailure(
            String attemptedEmail,
            UserAccount user,
            String reasonCode
    ) {
        recordSafely(
                "AUTHENTICATION",
                "ADMIN_LOGIN_FAILED",
                "WARNING",
                "DENIED",
                user == null ? null : user.getId(),
                user == null ? null : user.getRole(),
                cleanEmail(attemptedEmail),
                user == null ? null : user.getId(),
                "reason=" + cleanToken(reasonCode, 80)
        );
    }

    public void recordAdminAccessDenied(
            HttpServletRequest request,
            String eventType,
            String reasonCode
    ) {
        HttpServletRequest effectiveRequest = request == null ? currentHttpRequest() : request;
        if (!isAdminPath(effectiveRequest)) {
            return;
        }

        Actor actor = currentActor();
        recordSafely(
                "AUTHORIZATION",
                cleanToken(eventType, 80),
                "WARNING",
                "DENIED",
                actor.userId(),
                actor.role(),
                null,
                null,
                "reason=" + cleanToken(reasonCode, 80)
        );
    }

    public void recordAuditAction(
            Long actorUserId,
            String action,
            Long targetUserId,
            String details
    ) {
        String cleanAction = cleanToken(action, 80);
        if (cleanAction.isBlank() || "ADMIN_LOGIN".equals(cleanAction)) {
            return;
        }

        Actor actor = currentActor();
        String role = actor.role();
        if (actorUserId != null && actor.userId() != null && !actorUserId.equals(actor.userId())) {
            role = null;
        }

        recordSafely(
                "ADMIN_ACTION",
                cleanAction,
                severityForAction(cleanAction),
                "SUCCESS",
                actorUserId,
                role,
                null,
                targetUserId,
                cleanDetails(details)
        );
    }

    public AdminSecurityDashboardResponse dashboard(
            int requestedDays,
            String severity,
            String outcome,
            String category,
            String eventType,
            String query,
            int requestedLimit
    ) {
        int days = Math.max(1, Math.min(requestedDays, 90));
        int limit = Math.max(1, Math.min(requestedLimit, 500));
        Instant until = Instant.now();
        Instant since = until.minusSeconds(days * 86_400L);

        String cleanSeverity = upper(severity);
        String cleanOutcome = upper(outcome);
        String cleanCategory = upper(category);
        String cleanEventType = upper(eventType);
        String cleanQuery = String.valueOf(query == null ? "" : query).trim().toLowerCase(Locale.ROOT);
        String like = "%" + cleanQuery + "%";

        AdminSecuritySummaryResponse summary = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) AS total_events,
                       COALESCE(SUM(CASE WHEN event_type = 'ADMIN_LOGIN_SUCCESS' THEN 1 ELSE 0 END), 0) AS login_success,
                       COALESCE(SUM(CASE WHEN event_type = 'ADMIN_LOGIN_FAILED' THEN 1 ELSE 0 END), 0) AS login_failure,
                       COALESCE(SUM(CASE WHEN category = 'AUTHORIZATION' AND outcome = 'DENIED' THEN 1 ELSE 0 END), 0) AS denied_access,
                       COALESCE(SUM(CASE WHEN category = 'ADMIN_ACTION' THEN 1 ELSE 0 END), 0) AS sensitive_actions,
                       COALESCE(SUM(CASE WHEN severity = 'WARNING' THEN 1 ELSE 0 END), 0) AS warning_events,
                       COALESCE(SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END), 0) AS critical_events
                FROM admin_security_events
                WHERE created_at >= TIMESTAMPADD(DAY, ?, CURRENT_TIMESTAMP(6))
                  AND created_at <= CURRENT_TIMESTAMP(6)
                """,
                (rs, rowNum) -> new AdminSecuritySummaryResponse(
                        rs.getLong("total_events"),
                        rs.getLong("login_success"),
                        rs.getLong("login_failure"),
                        rs.getLong("denied_access"),
                        rs.getLong("sensitive_actions"),
                        rs.getLong("warning_events"),
                        rs.getLong("critical_events"),
                        since,
                        until,
                        analyticsZone.getId()
                ),
                -days
        );

        List<AdminSecurityEventResponse> events = jdbcTemplate.query(
                """
                SELECT e.id,
                       e.category,
                       e.event_type,
                       e.severity,
                       e.outcome,
                       e.actor_user_id,
                       actor.email AS actor_email,
                       e.actor_role,
                       e.attempted_email,
                       e.target_user_id,
                       target.email AS target_email,
                       e.request_id,
                       e.http_method,
                       e.request_path,
                       e.remote_ip,
                       e.forwarded_for,
                       e.user_agent,
                       e.details,
                       e.created_at
                FROM admin_security_events e
                LEFT JOIN users actor ON actor.id = e.actor_user_id
                LEFT JOIN users target ON target.id = e.target_user_id
                WHERE e.created_at >= TIMESTAMPADD(DAY, ?, CURRENT_TIMESTAMP(6))
                  AND e.created_at <= CURRENT_TIMESTAMP(6)
                  AND (? = '' OR e.severity = ?)
                  AND (? = '' OR e.outcome = ?)
                  AND (? = '' OR e.category = ?)
                  AND (? = '' OR e.event_type = ?)
                  AND (
                        ? = '' OR
                        LOWER(CONCAT_WS(' ',
                            e.event_type,
                            e.category,
                            e.severity,
                            e.outcome,
                            e.attempted_email,
                            actor.email,
                            target.email,
                            e.request_id,
                            e.request_path,
                            e.remote_ip,
                            e.details
                        )) LIKE ?
                  )
                ORDER BY e.id DESC
                LIMIT ?
                """,
                (rs, rowNum) -> new AdminSecurityEventResponse(
                        rs.getLong("id"),
                        rs.getString("category"),
                        rs.getString("event_type"),
                        rs.getString("severity"),
                        rs.getString("outcome"),
                        nullableLong(rs.getObject("actor_user_id")),
                        rs.getString("actor_email"),
                        rs.getString("actor_role"),
                        rs.getString("attempted_email"),
                        nullableLong(rs.getObject("target_user_id")),
                        rs.getString("target_email"),
                        rs.getString("request_id"),
                        rs.getString("http_method"),
                        rs.getString("request_path"),
                        rs.getString("remote_ip"),
                        rs.getString("forwarded_for"),
                        rs.getString("user_agent"),
                        rs.getString("details"),
                        toInstant(rs.getTimestamp("created_at"))
                ),
                -days,
                cleanSeverity, cleanSeverity,
                cleanOutcome, cleanOutcome,
                cleanCategory, cleanCategory,
                cleanEventType, cleanEventType,
                cleanQuery, like,
                limit
        );

        return new AdminSecurityDashboardResponse(summary, events);
    }

    private void recordSafely(
            String category,
            String eventType,
            String severity,
            String outcome,
            Long actorUserId,
            String actorRole,
            String attemptedEmail,
            Long targetUserId,
            String details
    ) {
        try {
            RequestMeta request = currentRequest();
            jdbcTemplate.update(
                    """
                    INSERT INTO admin_security_events (
                        category,
                        event_type,
                        severity,
                        outcome,
                        actor_user_id,
                        actor_role,
                        attempted_email,
                        target_user_id,
                        request_id,
                        http_method,
                        request_path,
                        remote_ip,
                        forwarded_for,
                        user_agent,
                        details,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                    """,
                    category,
                    eventType,
                    severity,
                    outcome,
                    actorUserId,
                    cleanToken(actorRole, 30),
                    attemptedEmail,
                    targetUserId,
                    cleanToken(RequestCorrelation.currentId(), 100),
                    request.method(),
                    request.path(),
                    request.remoteIp(),
                    request.forwardedFor(),
                    request.userAgent(),
                    cleanDetails(details)
            );
        } catch (DataAccessException ex) {
            log.warn(
                    "Unable to persist admin security event type={} requestId={}",
                    eventType,
                    RequestCorrelation.currentId(),
                    ex
            );
        }
    }

    private RequestMeta currentRequest() {
        HttpServletRequest request = currentHttpRequest();
        if (request == null) {
            return RequestMeta.EMPTY;
        }
        return new RequestMeta(
                cleanToken(request.getMethod(), 12),
                cleanToken(request.getRequestURI(), 500),
                cleanToken(request.getRemoteAddr(), 64),
                cleanToken(request.getHeader("X-Forwarded-For"), 500),
                cleanToken(request.getHeader("User-Agent"), 500)
        );
    }

    private HttpServletRequest currentHttpRequest() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) {
            return null;
        }
        return attributes.getRequest();
    }

    private Actor currentActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            return Actor.EMPTY;
        }

        Long userId = null;
        try {
            userId = Long.valueOf(jwt.getSubject());
        } catch (RuntimeException ignored) {
            // Keep event logging best-effort; malformed/missing subject is represented as anonymous.
        }
        return new Actor(userId, cleanToken(jwt.getClaimAsString("role"), 30));
    }

    private static boolean isAdminPath(HttpServletRequest request) {
        return request != null && String.valueOf(request.getRequestURI()).startsWith("/api/v1/admin/");
    }

    private static String severityForAction(String action) {
        if (action.contains("ROLE_CHANGED") || action.contains("SUPER_ADMIN")) {
            return "CRITICAL";
        }
        if (action.contains("REFUND")
                || action.contains("REVOK")
                || action.contains("CANCEL")
                || action.contains("SUSPEND")
                || action.contains("STATUS_CHANGED")
                || action.contains("BACKFILL")
                || action.contains("RESET")) {
            return "WARNING";
        }
        return "INFO";
    }

    private static String upper(String value) {
        return String.valueOf(value == null ? "" : value).trim().toUpperCase(Locale.ROOT);
    }

    private static String cleanEmail(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim().toLowerCase(Locale.ROOT);
        return clean.length() <= 190 ? clean : clean.substring(0, 190);
    }

    private static String cleanToken(String value, int max) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        return clean.length() <= max ? clean : clean.substring(0, max);
    }

    private static String cleanDetails(String value) {
        return cleanToken(value, 2000);
    }

    private static Long nullableLong(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    private static Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private record Actor(Long userId, String role) {
        private static final Actor EMPTY = new Actor(null, "");
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

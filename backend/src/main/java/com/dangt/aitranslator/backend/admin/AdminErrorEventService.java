package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.common.RequestCorrelation;
import com.dangt.aitranslator.backend.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;

@Service
public class AdminErrorEventService {

    private static final Logger log = LoggerFactory.getLogger(AdminErrorEventService.class);

    private static final String FILTER_SQL = """
              AND (? = '' OR CAST(e.status AS BINARY) = CAST(? AS BINARY))
              AND (? = '' OR CAST(e.severity AS BINARY) = CAST(? AS BINARY))
              AND (? = '' OR CAST(e.module AS BINARY) = CAST(? AS BINARY))
              AND (? = '' OR CAST(e.error_code AS BINARY) = CAST(? AS BINARY))
              AND (
                    ? = '' OR
                    CAST(LOWER(CONCAT_WS(' ',
                        e.error_code,
                        e.exception_type,
                        e.summary,
                        e.request_id,
                        e.request_path,
                        e.remote_ip
                    )) AS BINARY) LIKE CAST(? AS BINARY)
              )
            """;

    private final JdbcTemplate jdbcTemplate;
    private final AdminAuditService auditService;
    private final ZoneId analyticsZone;

    public AdminErrorEventService(
            JdbcTemplate jdbcTemplate,
            AdminAuditService auditService,
            @Value("${app.admin.analytics-time-zone:Asia/Ho_Chi_Minh}") String analyticsTimeZone
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.auditService = auditService;
        this.analyticsZone = ZoneId.of(analyticsTimeZone);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordHttpFailure(
            HttpServletRequest request,
            String errorCode,
            Throwable throwable,
            int httpStatus,
            boolean retryable
    ) {
        try {
            HttpServletRequest effectiveRequest = request == null ? currentRequest() : request;
            String path = effectiveRequest == null ? "" : String.valueOf(effectiveRequest.getRequestURI());
            String cleanCode = upperToken(errorCode, 80, "INTERNAL_ERROR");
            String module = moduleFor(path, cleanCode);
            String severity = httpStatus >= 500 && httpStatus != 502 ? "CRITICAL" : "WARNING";
            String summary = summaryFor(cleanCode, module);
            Long actorUserId = currentActorUserId();

            jdbcTemplate.update(
                    """
                    INSERT INTO admin_error_events (
                        status, severity, module, error_code, exception_type, summary, retryable,
                        actor_user_id, request_id, http_status, http_method, request_path,
                        remote_ip, forwarded_for, user_agent, occurred_at
                    ) VALUES (
                        'OPEN', ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6)
                    )
                    """,
                    severity,
                    module,
                    cleanCode,
                    throwable == null ? null : clean(throwable.getClass().getName(), 190),
                    summary,
                    retryable,
                    actorUserId,
                    clean(RequestCorrelation.currentId(), 100),
                    httpStatus,
                    effectiveRequest == null ? null : clean(effectiveRequest.getMethod(), 12),
                    effectiveRequest == null ? null : clean(effectiveRequest.getRequestURI(), 500),
                    effectiveRequest == null ? null : clean(effectiveRequest.getRemoteAddr(), 64),
                    effectiveRequest == null ? null : clean(effectiveRequest.getHeader("X-Forwarded-For"), 500),
                    effectiveRequest == null ? null : clean(effectiveRequest.getHeader("User-Agent"), 500)
            );
        } catch (RuntimeException loggingFailure) {
            log.warn(
                    "Could not persist operational error event requestId={} cause={}",
                    RequestCorrelation.currentId(),
                    loggingFailure.getClass().getSimpleName()
            );
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordJobFailure(
            String module,
            String errorCode,
            Throwable throwable,
            boolean retryable
    ) {
        try {
            String cleanModule = normalizeModule(module);
            String cleanCode = upperToken(errorCode, 80, "JOB_FAILED");
            jdbcTemplate.update(
                    """
                    INSERT INTO admin_error_events (
                        status, severity, module, error_code, exception_type, summary, retryable,
                        request_id, occurred_at
                    ) VALUES (
                        'OPEN', 'WARNING', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6)
                    )
                    """,
                    cleanModule,
                    cleanCode,
                    throwable == null ? null : clean(throwable.getClass().getName(), 190),
                    summaryFor(cleanCode, cleanModule),
                    retryable,
                    clean(RequestCorrelation.currentId(), 100)
            );
        } catch (RuntimeException loggingFailure) {
            log.warn("Could not persist failed-job event cause={}", loggingFailure.getClass().getSimpleName());
        }
    }

    public AdminErrorDashboardResponse dashboard(
            int requestedDays,
            String status,
            String severity,
            String module,
            String errorCode,
            String query,
            int requestedLimit
    ) {
        int days = Math.max(1, Math.min(requestedDays, 90));
        int limit = Math.max(1, Math.min(requestedLimit, 500));
        String cleanStatus = upper(status);
        String cleanSeverity = upper(severity);
        String cleanModule = upper(module);
        String cleanErrorCode = upper(errorCode);
        String cleanQuery = lower(query);
        String queryLike = "%" + cleanQuery + "%";

        Object[] filterArgs = filterArgs(cleanStatus, cleanSeverity, cleanModule, cleanErrorCode, cleanQuery, queryLike);

        AdminErrorSummaryResponse summary = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) AS total_events,
                       COALESCE(SUM(CASE WHEN e.status = 'OPEN' THEN 1 ELSE 0 END), 0) AS open_events,
                       COALESCE(SUM(CASE WHEN e.status = 'ACKNOWLEDGED' THEN 1 ELSE 0 END), 0) AS acknowledged_events,
                       COALESCE(SUM(CASE WHEN e.status = 'RESOLVED' THEN 1 ELSE 0 END), 0) AS resolved_events,
                       COALESCE(SUM(CASE WHEN e.status <> 'RESOLVED' AND e.severity = 'CRITICAL' THEN 1 ELSE 0 END), 0) AS critical_open_events,
                       COALESCE(SUM(CASE WHEN e.status <> 'RESOLVED' AND e.retryable = TRUE THEN 1 ELSE 0 END), 0) AS retryable_open_events
                FROM admin_error_events e
                WHERE e.occurred_at >= TIMESTAMPADD(DAY, ?, CURRENT_TIMESTAMP(6))
                  AND e.occurred_at <= CURRENT_TIMESTAMP(6)
                """ + FILTER_SQL,
                (rs, rowNum) -> new AdminErrorSummaryResponse(
                        rs.getLong("total_events"),
                        rs.getLong("open_events"),
                        rs.getLong("acknowledged_events"),
                        rs.getLong("resolved_events"),
                        rs.getLong("critical_open_events"),
                        rs.getLong("retryable_open_events"),
                        days,
                        analyticsZone.getId()
                ),
                prepend(-days, filterArgs)
        );

        List<AdminErrorEventResponse> events = jdbcTemplate.query(
                """
                SELECT e.*,
                       actor.email AS actor_email,
                       ack_user.email AS acknowledged_by_email,
                       resolved_user.email AS resolved_by_email
                FROM admin_error_events e
                LEFT JOIN users actor ON actor.id = e.actor_user_id
                LEFT JOIN users ack_user ON ack_user.id = e.acknowledged_by_user_id
                LEFT JOIN users resolved_user ON resolved_user.id = e.resolved_by_user_id
                WHERE e.occurred_at >= TIMESTAMPADD(DAY, ?, CURRENT_TIMESTAMP(6))
                  AND e.occurred_at <= CURRENT_TIMESTAMP(6)
                """ + FILTER_SQL + """
                ORDER BY
                    CASE e.status WHEN 'OPEN' THEN 0 WHEN 'ACKNOWLEDGED' THEN 1 ELSE 2 END,
                    CASE e.severity WHEN 'CRITICAL' THEN 0 ELSE 1 END,
                    e.occurred_at DESC,
                    e.id DESC
                LIMIT ?
                """,
                this::mapEvent,
                append(prepend(-days, filterArgs), limit)
        );

        return new AdminErrorDashboardResponse(summary, events);
    }

    public AdminErrorEventResponse get(long id) {
        List<AdminErrorEventResponse> events = jdbcTemplate.query(
                """
                SELECT e.*,
                       actor.email AS actor_email,
                       ack_user.email AS acknowledged_by_email,
                       resolved_user.email AS resolved_by_email
                FROM admin_error_events e
                LEFT JOIN users actor ON actor.id = e.actor_user_id
                LEFT JOIN users ack_user ON ack_user.id = e.acknowledged_by_user_id
                LEFT JOIN users resolved_user ON resolved_user.id = e.resolved_by_user_id
                WHERE e.id = ?
                """,
                this::mapEvent,
                id
        );
        if (events.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy error event.");
        }
        return events.getFirst();
    }

    @Transactional
    public AdminErrorEventResponse acknowledge(long id, UserAccount actor, String reason) {
        requireActor(actor);
        int updated = jdbcTemplate.update(
                """
                UPDATE admin_error_events
                SET status = 'ACKNOWLEDGED',
                    acknowledged_by_user_id = ?,
                    acknowledged_at = CURRENT_TIMESTAMP(6),
                    acknowledgement_note = ?
                WHERE id = ? AND status = 'OPEN'
                """,
                actor.getId(), clean(reason, 500), id
        );
        if (updated == 0) {
            AdminErrorEventResponse existing = get(id);
            if ("RESOLVED".equals(existing.status())) {
                throw new IllegalArgumentException("Error event đã được resolve.");
            }
            return existing;
        }
        auditService.record(actor.getId(), "ERROR_EVENT_ACKNOWLEDGED", null,
                "errorEventId=" + id + "; reason=" + clean(reason, 500));
        return get(id);
    }

    @Transactional
    public AdminErrorEventResponse resolve(long id, UserAccount actor, String reason) {
        requireActor(actor);
        int updated = jdbcTemplate.update(
                """
                UPDATE admin_error_events
                SET status = 'RESOLVED',
                    resolved_by_user_id = ?,
                    resolved_at = CURRENT_TIMESTAMP(6),
                    resolution_note = ?
                WHERE id = ? AND status <> 'RESOLVED'
                """,
                actor.getId(), clean(reason, 500), id
        );
        if (updated == 0) {
            return get(id);
        }
        auditService.record(actor.getId(), "ERROR_EVENT_RESOLVED", null,
                "errorEventId=" + id + "; reason=" + clean(reason, 500));
        return get(id);
    }

    private AdminErrorEventResponse mapEvent(ResultSet rs, int rowNum) throws SQLException {
        return new AdminErrorEventResponse(
                rs.getLong("id"),
                rs.getString("status"),
                rs.getString("severity"),
                rs.getString("module"),
                rs.getString("error_code"),
                rs.getString("exception_type"),
                rs.getString("summary"),
                rs.getBoolean("retryable"),
                nullableLong(rs, "actor_user_id"),
                rs.getString("actor_email"),
                rs.getString("request_id"),
                nullableInt(rs, "http_status"),
                rs.getString("http_method"),
                rs.getString("request_path"),
                rs.getString("remote_ip"),
                rs.getString("forwarded_for"),
                rs.getString("user_agent"),
                instant(rs, "occurred_at"),
                nullableLong(rs, "acknowledged_by_user_id"),
                rs.getString("acknowledged_by_email"),
                instant(rs, "acknowledged_at"),
                rs.getString("acknowledgement_note"),
                nullableLong(rs, "resolved_by_user_id"),
                rs.getString("resolved_by_email"),
                instant(rs, "resolved_at"),
                rs.getString("resolution_note")
        );
    }

    private static Object[] filterArgs(String status, String severity, String module, String errorCode, String query, String queryLike) {
        return new Object[]{
                status, status,
                severity, severity,
                module, module,
                errorCode, errorCode,
                query, queryLike
        };
    }

    private static Object[] prepend(Object value, Object[] values) {
        Object[] result = new Object[values.length + 1];
        result[0] = value;
        System.arraycopy(values, 0, result, 1, values.length);
        return result;
    }

    private static Object[] append(Object[] values, Object value) {
        Object[] result = new Object[values.length + 1];
        System.arraycopy(values, 0, result, 0, values.length);
        result[result.length - 1] = value;
        return result;
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private static Integer nullableInt(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }

    private static java.time.Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static void requireActor(UserAccount actor) {
        if (actor == null || actor.getId() == null) {
            throw new IllegalArgumentException("Không xác định được Admin actor.");
        }
    }

    private static String moduleFor(String path, String errorCode) {
        String normalizedPath = String.valueOf(path == null ? "" : path).toLowerCase(Locale.ROOT);
        if (errorCode.startsWith("AI_") || normalizedPath.contains("translate") || normalizedPath.contains("manga") || normalizedPath.contains("novel") || normalizedPath.contains("pdf")) {
            return "AI";
        }
        if (normalizedPath.contains("transaction") || normalizedPath.contains("payment") || normalizedPath.contains("subscription") || normalizedPath.contains("license")) {
            return "PAYMENT";
        }
        if (normalizedPath.contains("revenue") || normalizedPath.contains("fx-rate") || normalizedPath.contains("margin")) {
            return "REVENUE";
        }
        if (normalizedPath.startsWith("/api/v1/admin/")) {
            return "ADMIN";
        }
        return normalizedPath.isBlank() ? "SYSTEM" : "HTTP";
    }

    private static String normalizeModule(String module) {
        String value = upperToken(module, 30, "JOB");
        return switch (value) {
            case "HTTP", "AI", "PAYMENT", "REVENUE", "JOB", "ADMIN", "SYSTEM" -> value;
            default -> "JOB";
        };
    }

    private static String summaryFor(String errorCode, String module) {
        if ("AI_RESPONSE_FORMAT".equals(errorCode)) {
            return "AI provider response không đúng format mong đợi.";
        }
        if ("AI_PROVIDER_ERROR".equals(errorCode)) {
            return "AI provider request thất bại.";
        }
        if ("JOB".equals(module)) {
            return "Background job xử lý thất bại.";
        }
        if ("PAYMENT".equals(module)) {
            return "Payment/subscription operation phát sinh lỗi backend.";
        }
        if ("REVENUE".equals(module)) {
            return "Revenue/FX operation phát sinh lỗi backend.";
        }
        return "Backend request phát sinh lỗi server.";
    }

    private static Long currentActorUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            return null;
        }
        try {
            return Long.valueOf(jwt.getSubject());
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static HttpServletRequest currentRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            return attributes.getRequest();
        }
        return null;
    }

    private static String upper(String value) {
        return String.valueOf(value == null ? "" : value).trim().toUpperCase(Locale.ROOT);
    }

    private static String lower(String value) {
        return String.valueOf(value == null ? "" : value).trim().toLowerCase(Locale.ROOT);
    }

    private static String upperToken(String value, int max, String fallback) {
        String result = upper(value).replaceAll("[^A-Z0-9_.-]", "_");
        if (result.isBlank()) {
            result = fallback;
        }
        return result.length() <= max ? result : result.substring(0, max);
    }

    private static String clean(String value, int max) {
        if (value == null) {
            return null;
        }
        String result = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return result.length() <= max ? result : result.substring(0, max);
    }
}

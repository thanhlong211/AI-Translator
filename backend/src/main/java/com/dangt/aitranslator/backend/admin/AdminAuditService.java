package com.dangt.aitranslator.backend.admin;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

@Service
public class AdminAuditService {

    private final JdbcTemplate jdbcTemplate;
    private final AdminSecurityEventService securityEventService;

    public AdminAuditService(
            JdbcTemplate jdbcTemplate,
            AdminSecurityEventService securityEventService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.securityEventService = securityEventService;
    }

    public void record(
            Long actorUserId,
            String action,
            Long targetUserId,
            String details
    ) {
        String cleanDetails = cleanDetails(details);
        jdbcTemplate.update(
                """
                INSERT INTO admin_audit_log (
                    actor_user_id,
                    action,
                    target_user_id,
                    details,
                    created_at
                ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                """,
                actorUserId,
                action,
                targetUserId,
                cleanDetails
        );

        securityEventService.recordAuditAction(
                actorUserId,
                action,
                targetUserId,
                cleanDetails
        );
    }

    public List<AdminAuditResponse> recent(int requestedLimit) {
        int limit = Math.max(1, Math.min(requestedLimit, 200));

        return jdbcTemplate.query(
                """
                SELECT a.id,
                       a.actor_user_id,
                       actor.email AS actor_email,
                       a.action,
                       a.target_user_id,
                       target.email AS target_email,
                       a.details,
                       a.created_at
                FROM admin_audit_log a
                LEFT JOIN users actor ON actor.id = a.actor_user_id
                LEFT JOIN users target ON target.id = a.target_user_id
                ORDER BY a.id DESC
                LIMIT ?
                """,
                (rs, rowNum) -> new AdminAuditResponse(
                        rs.getLong("id"),
                        nullableLong(rs.getObject("actor_user_id")),
                        rs.getString("actor_email"),
                        rs.getString("action"),
                        nullableLong(rs.getObject("target_user_id")),
                        rs.getString("target_email"),
                        rs.getString("details"),
                        toInstant(rs.getTimestamp("created_at"))
                ),
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
                       a.action,
                       a.target_user_id,
                       target.email AS target_email,
                       a.details,
                       a.created_at
                FROM admin_audit_log a
                LEFT JOIN users actor ON actor.id = a.actor_user_id
                LEFT JOIN users target ON target.id = a.target_user_id
                WHERE a.target_user_id = ?
                ORDER BY a.id DESC
                LIMIT ?
                """,
                (rs, rowNum) -> new AdminAuditResponse(
                        rs.getLong("id"),
                        nullableLong(rs.getObject("actor_user_id")),
                        rs.getString("actor_email"),
                        rs.getString("action"),
                        nullableLong(rs.getObject("target_user_id")),
                        rs.getString("target_email"),
                        rs.getString("details"),
                        toInstant(rs.getTimestamp("created_at"))
                ),
                targetUserId,
                limit
        );
    }

    private static String cleanDetails(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        return clean.length() <= 2000 ? clean : clean.substring(0, 2000);
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
}

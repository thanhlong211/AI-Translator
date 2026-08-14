package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
public class AdminSafetyService {

    public static final String MODE_NORMAL = "NORMAL";
    public static final String MODE_READ_ONLY = "READ_ONLY";
    public static final String ENABLE_CONFIRMATION = "ENABLE READ_ONLY";
    public static final String DISABLE_CONFIRMATION = "DISABLE READ_ONLY";

    private final JdbcTemplate jdbcTemplate;
    private final AdminGuard adminGuard;
    private final AdminAuditService auditService;

    public AdminSafetyService(
            JdbcTemplate jdbcTemplate,
            AdminGuard adminGuard,
            AdminAuditService auditService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.adminGuard = adminGuard;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public AdminSafetyResponse snapshot() {
        List<AdminSafetyResponse> rows = jdbcTemplate.query(
                """
                SELECT s.mode,
                       s.reason,
                       s.changed_by_user_id,
                       u.email AS changed_by_email,
                       s.changed_at,
                       (
                           SELECT COUNT(*)
                           FROM users su
                           WHERE su.role = 'SUPER_ADMIN'
                             AND su.status = 'ACTIVE'
                       ) AS active_super_admins
                FROM admin_safety_state s
                LEFT JOIN users u ON u.id = s.changed_by_user_id
                WHERE s.id = 1
                LIMIT 1
                """,
                (rs, rowNum) -> new AdminSafetyResponse(
                        rs.getString("mode"),
                        MODE_READ_ONLY.equals(rs.getString("mode")),
                        rs.getString("reason"),
                        nullableLong(rs.getObject("changed_by_user_id")),
                        rs.getString("changed_by_email"),
                        toInstant(rs.getTimestamp("changed_at")),
                        rs.getLong("active_super_admins")
                )
        );

        if (rows.isEmpty()) {
            throw new IllegalStateException("Không tìm thấy Admin safety state singleton.");
        }
        return rows.getFirst();
    }

    @Transactional(readOnly = true)
    public boolean isReadOnly() {
        String mode = jdbcTemplate.queryForObject(
                "SELECT mode FROM admin_safety_state WHERE id = 1",
                String.class
        );
        return MODE_READ_ONLY.equals(mode);
    }

    @Transactional
    public AdminSafetyResponse changeMode(
            UserAccount actor,
            AdminSafetyModeUpdateRequest request
    ) {
        requireSuperAdmin(actor);

        String targetMode = normalizeMode(request.mode());
        String reason = cleanReason(request.reason());
        String confirmation = String.valueOf(request.confirmation()).trim();
        String requiredConfirmation = MODE_READ_ONLY.equals(targetMode)
                ? ENABLE_CONFIRMATION
                : DISABLE_CONFIRMATION;

        if (!requiredConfirmation.equals(confirmation)) {
            throw new IllegalArgumentException(
                    "Confirmation phrase không đúng. Cần nhập chính xác: " + requiredConfirmation
            );
        }

        String beforeMode = jdbcTemplate.queryForObject(
                "SELECT mode FROM admin_safety_state WHERE id = 1 FOR UPDATE",
                String.class
        );
        if (targetMode.equals(beforeMode)) {
            throw new IllegalArgumentException("Admin safety mode đã ở trạng thái " + targetMode + ".");
        }

        jdbcTemplate.update(
                """
                UPDATE admin_safety_state
                SET mode = ?,
                    reason = ?,
                    changed_by_user_id = ?,
                    changed_at = CURRENT_TIMESTAMP(6)
                WHERE id = 1
                """,
                targetMode,
                reason,
                actor.getId()
        );

        auditService.record(
                actor.getId(),
                "ADMIN_SAFETY_MODE_CHANGED",
                null,
                "from=" + String.valueOf(beforeMode)
                        + "; to=" + targetMode
                        + "; reason=" + reason
        );

        return snapshot();
    }

    @Transactional(readOnly = true)
    public void requireCanSuspendUser(
            UserAccount actor,
            long targetUserId,
            String targetRole
    ) {
        if (actor != null && actor.getId() != null && actor.getId().equals(targetUserId)) {
            throw new IllegalArgumentException("Không thể tự khóa tài khoản Admin đang dùng.");
        }

        if ("SUPER_ADMIN".equals(String.valueOf(targetRole))) {
            Long activeSuperAdmins = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM users WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE'",
                    Long.class
            );
            if (activeSuperAdmins != null && activeSuperAdmins <= 1L) {
                throw new ForbiddenException("Không thể khóa SUPER_ADMIN hoạt động cuối cùng.");
            }
        }
    }

    public void requireCanRevokeSessions(
            UserAccount actor,
            long targetUserId
    ) {
        if (actor != null && actor.getId() != null && actor.getId().equals(targetUserId)) {
            throw new IllegalArgumentException(
                    "Không thể thu hồi toàn bộ session của chính tài khoản Admin đang dùng từ Admin Console."
            );
        }
    }

    private void requireSuperAdmin(UserAccount actor) {
        if (!adminGuard.isSuperAdmin(actor)) {
            throw new ForbiddenException("Chỉ SUPER_ADMIN được thay đổi Admin safety mode.");
        }
    }

    private static String normalizeMode(String value) {
        String mode = String.valueOf(value == null ? "" : value).trim().toUpperCase(Locale.ROOT);
        if (!MODE_NORMAL.equals(mode) && !MODE_READ_ONLY.equals(mode)) {
            throw new IllegalArgumentException("Mode chỉ hỗ trợ NORMAL hoặc READ_ONLY.");
        }
        return mode;
    }

    private static String cleanReason(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isBlank()) {
            throw new IllegalArgumentException("Cần nhập lý do thay đổi safety mode.");
        }
        return clean.length() <= 500 ? clean : clean.substring(0, 500);
    }

    private static Long nullableLong(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    private static Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }
}

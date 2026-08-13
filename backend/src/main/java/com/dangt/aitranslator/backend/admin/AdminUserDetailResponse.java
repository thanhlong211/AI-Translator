package com.dangt.aitranslator.backend.admin;

import java.util.List;

public record AdminUserDetailResponse(
        AdminUserRow user,
        List<AdminSessionResponse> sessions,
        List<AdminAuditResponse> recentAudit
) {
}

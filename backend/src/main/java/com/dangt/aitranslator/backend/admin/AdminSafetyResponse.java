package com.dangt.aitranslator.backend.admin;

import java.time.Instant;

public record AdminSafetyResponse(
        String mode,
        boolean readOnly,
        String reason,
        Long changedByUserId,
        String changedByEmail,
        Instant changedAt,
        long activeSuperAdmins
) {
}

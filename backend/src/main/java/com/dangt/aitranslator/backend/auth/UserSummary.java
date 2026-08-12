package com.dangt.aitranslator.backend.auth;

import com.dangt.aitranslator.backend.user.UserAccount;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

public record UserSummary(
        @Schema(example = "1") Long id,
        @Schema(example = "user@example.com") String email,
        @Schema(example = "ACTIVE") String status,
        @Schema(example = "USER") String role,
        Instant createdAt
) {
    public static UserSummary from(UserAccount user) {
        return new UserSummary(
                user.getId(),
                user.getEmail(),
                user.getStatus(),
                user.getRole(),
                user.getCreatedAt()
        );
    }
}

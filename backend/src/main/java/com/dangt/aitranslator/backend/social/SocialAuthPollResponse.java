package com.dangt.aitranslator.backend.social;

import com.dangt.aitranslator.backend.auth.AuthResponse;

public record SocialAuthPollResponse(
        boolean success,
        String status,
        String provider,
        String message,
        String errorCode,
        AuthResponse auth,
        SocialIdentityResponse identity
) {
    public static SocialAuthPollResponse pending(String provider) {
        return new SocialAuthPollResponse(
                true,
                "PENDING",
                provider,
                "Đang chờ hoàn tất đăng nhập trong trình duyệt.",
                null,
                null,
                null
        );
    }
}

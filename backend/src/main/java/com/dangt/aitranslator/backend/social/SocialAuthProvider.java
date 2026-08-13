package com.dangt.aitranslator.backend.social;

import com.dangt.aitranslator.backend.common.ForbiddenException;

import java.util.Locale;

public enum SocialAuthProvider {
    GOOGLE("Google"),
    FACEBOOK("Facebook");

    private final String displayName;

    SocialAuthProvider(String displayName) {
        this.displayName = displayName;
    }

    public String displayName() {
        return displayName;
    }

    public String pathCode() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static SocialAuthProvider fromPath(String raw) {
        try {
            return valueOf(String.valueOf(raw).trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new ForbiddenException("Nhà cung cấp đăng nhập không được hỗ trợ.");
        }
    }
}

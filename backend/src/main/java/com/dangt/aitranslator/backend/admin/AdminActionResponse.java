package com.dangt.aitranslator.backend.admin;

public record AdminActionResponse(
        boolean success,
        String message
) {
    public static AdminActionResponse ok(String message) {
        return new AdminActionResponse(true, message);
    }
}

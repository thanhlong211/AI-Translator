package com.dangt.aitranslator.backend.auth.email;

public class EmailVerificationException extends RuntimeException {

    private final String code;

    public EmailVerificationException(
            String code,
            String message
    ) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}

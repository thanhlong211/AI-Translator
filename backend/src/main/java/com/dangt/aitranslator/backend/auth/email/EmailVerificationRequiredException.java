package com.dangt.aitranslator.backend.auth.email;

public class EmailVerificationRequiredException extends RuntimeException {

    public static final String CODE =
            "EMAIL_VERIFICATION_REQUIRED";

    public EmailVerificationRequiredException() {
        super(
                "Vui lòng xác minh email trước khi đăng nhập."
        );
    }

    public String getCode() {
        return CODE;
    }
}

package com.dangt.aitranslator.backend.auth.device;

public class DeviceTransferVerificationException extends RuntimeException {

    private final String code;

    public DeviceTransferVerificationException(
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

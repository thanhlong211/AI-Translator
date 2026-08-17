package com.dangt.aitranslator.backend.common;

public class DeviceBindingException extends RuntimeException {

    private final String code;

    public DeviceBindingException(
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

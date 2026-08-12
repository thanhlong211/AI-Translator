package com.dangt.aitranslator.backend.common;

public class AiResponseFormatException extends RuntimeException {

    public AiResponseFormatException(
            String message
    ) {
        super(message);
    }

    public AiResponseFormatException(
            String message,
            Throwable cause
    ) {
        super(message, cause);
    }
}

package com.dangt.aitranslator.backend.common;

import org.slf4j.MDC;

public final class RequestCorrelation {

    public static final String HEADER_NAME =
            "X-Request-Id";

    public static final String MDC_KEY =
            "requestId";

    private RequestCorrelation() {
    }

    public static String currentId() {
        String value =
                MDC.get(
                        MDC_KEY
                );

        return value == null
                ? ""
                : value;
    }
}

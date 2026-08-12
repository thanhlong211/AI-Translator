package com.dangt.aitranslator.backend.common;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        description =
                "Server-side timing để benchmark local/staging. Không chứa nội dung người dùng."
)
public record ApiPerformanceTiming(

        String requestId,

        long profileMs,

        long promptMs,

        long openAiMs,

        long parseMs,

        long persistenceMs,

        long totalMs

) {
}

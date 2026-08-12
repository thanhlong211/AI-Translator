package com.dangt.aitranslator.backend.system;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Trạng thái kết nối MySQL của backend.")
public record DatabaseStatusResponse(
        @Schema(example = "true")
        boolean connected,

        @Schema(example = "MySQL")
        String product,

        @Schema(example = "8.4.0")
        String version,

        @Schema(example = "ai_translator")
        String database,

        @Schema(example = "25")
        long translationUsageEvents
) {
}

package com.dangt.aitranslator.backend.grammar;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

public record GrammarUpdateRequest(

        @Schema(example = "LEARNING")
        GrammarStatus status,

        @Schema(example = "true")
        Boolean favorite,

        @Size(max = 3000)
        @Schema(
                example =
                        "Ôn lại cách chia thể ない trước khi dùng mẫu này."
        )
        String personalNote

) {
}

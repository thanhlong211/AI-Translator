package com.dangt.aitranslator.backend.vocabulary;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

public record VocabularyUpdateRequest(

        @Schema(example = "LEARNING")
        VocabularyStatus status,

        @Schema(example = "true")
        Boolean favorite,

        @Size(max = 3000)
        @Schema(
                example =
                        "Hay nhầm với 行う. Ôn lại thể ない."
        )
        String personalNote

) {
}

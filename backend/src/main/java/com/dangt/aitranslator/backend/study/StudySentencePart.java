package com.dangt.aitranslator.backend.study;

import io.swagger.v3.oas.annotations.media.Schema;

public record StudySentencePart(

        @Schema(example = "学校へ")
        String text,

        @Schema(example = "がっこう へ")
        String reading,

        @Schema(example = "gakkou e")
        String romaji,

        @Schema(example = "Cụm chỉ đích đến")
        String role,

        @Schema(example = "đến trường")
        String meaning,

        @Schema(
                example =
                        "学校 là địa điểm; へ đánh dấu hướng di chuyển."
        )
        String explanation

) {
}

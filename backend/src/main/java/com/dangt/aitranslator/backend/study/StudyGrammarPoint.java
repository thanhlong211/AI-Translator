package com.dangt.aitranslator.backend.study;

import io.swagger.v3.oas.annotations.media.Schema;

public record StudyGrammarPoint(

        @Schema(example = "～なければならない")
        String pattern,

        @Schema(example = "N4")
        String jlptLevel,

        @Schema(example = "phải làm...")
        String meaning,

        @Schema(example = "行かなければならない")
        String matchedText,

        @Schema(
                example =
                        "Mẫu bắt buộc: động từ thể ない bỏ い + ければならない."
        )
        String explanation

) {
}

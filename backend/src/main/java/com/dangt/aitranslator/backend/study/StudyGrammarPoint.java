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
        String explanation,

        @Schema(
                example =
                        "明日は早く起きなければならない。"
        )
        String example

) {

    /*
     * Backward compatibility cho code/test cũ
     * vẫn dùng constructor 5 tham số.
     */
    public StudyGrammarPoint(
            String pattern,
            String jlptLevel,
            String meaning,
            String matchedText,
            String explanation
    ) {
        this(
                pattern,
                jlptLevel,
                meaning,
                matchedText,
                explanation,
                ""
        );
    }
}

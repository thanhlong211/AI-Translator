package com.dangt.aitranslator.backend.grammar;

import com.dangt.aitranslator.backend.study.StudyGrammarPoint;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GrammarSaveRequest(

        @NotBlank
        @Size(max = 255)
        @Schema(example = "～なければならない")
        String pattern,

        @Size(max = 20)
        @Schema(example = "N4")
        String jlptLevel,

        @Size(max = 500)
        @Schema(example = "phải làm...")
        String meaning,

        @Size(max = 3000)
        @Schema(
                example =
                        "Mẫu diễn tả nghĩa vụ hoặc việc bắt buộc phải làm."
        )
        String explanation,

        @Schema(
                description =
                        "true = đây là một lần gặp mới; false = chỉ Save thủ công."
        )
        boolean recordEncounter

) {
    public StudyGrammarPoint toStudyPoint() {
        return new StudyGrammarPoint(
                pattern,
                jlptLevel,
                meaning,
                "",
                explanation
        );
    }
}

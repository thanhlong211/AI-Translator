package com.dangt.aitranslator.backend.grammar;

import com.dangt.aitranslator.backend.study.EnglishStudyGrammarPoint;
import com.dangt.aitranslator.backend.study.StudyGrammarPoint;
import com.dangt.aitranslator.backend.study.StudyLanguage;
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

        @Schema(example = "JA")
        StudyLanguage language,

        @Size(max = 20)
        @Schema(example = "B1")
        String cefrLevel,

        @Size(max = 500)
        @Schema(example = "have been studying")
        String matchedText,

        @Size(max = 1000)
        @Schema(example = "I have been studying English for three years.")
        String example,

        @Schema(
                description =
                        "true = đây là một lần gặp mới; false = chỉ Save thủ công."
        )
        boolean recordEncounter

) {
    public GrammarSaveRequest(
            String pattern,
            String jlptLevel,
            String meaning,
            String explanation,
            boolean recordEncounter
    ) {
        this(
                pattern,
                jlptLevel,
                meaning,
                explanation,
                StudyLanguage.JA,
                null,
                null,
                null,
                recordEncounter
        );
    }

    public StudyLanguage normalizedLanguage() {
        return language == StudyLanguage.EN
                ? StudyLanguage.EN
                : StudyLanguage.JA;
    }

    public StudyGrammarPoint toStudyPoint() {
        return new StudyGrammarPoint(
                pattern,
                jlptLevel,
                meaning,
                matchedText,
                explanation,
                example
        );
    }

    public EnglishStudyGrammarPoint toEnglishStudyPoint() {
        return new EnglishStudyGrammarPoint(
                pattern,
                cefrLevel,
                meaning,
                matchedText,
                explanation,
                example
        );
    }
}

package com.dangt.aitranslator.backend.study;

import io.swagger.v3.oas.annotations.media.Schema;

public record StudyVocabularyItem(

        @Schema(example = "学校")
        String surface,

        @Schema(example = "学校")
        String dictionaryForm,

        @Schema(example = "がっこう")
        String reading,

        @Schema(example = "gakkou")
        String romaji,

        @Schema(example = "trường học")
        String meaning,

        @Schema(example = "Danh từ")
        String partOfSpeech,

        @Schema(example = "N5")
        String jlptLevel,

        @Schema(
                example =
                        "Danh từ chỉ trường học; thường gặp trong hội thoại đời sống."
        )
        String note

) {
}

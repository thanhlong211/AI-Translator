package com.dangt.aitranslator.backend.study;

import io.swagger.v3.oas.annotations.media.Schema;

public record StudyVocabularyItem(

        @Schema(example = "食べました")
        String surface,

        @Schema(example = "食べる")
        String dictionaryForm,

        @Schema(example = "たべる")
        String reading,

        @Schema(example = "taberu")
        String romaji,

        @Schema(example = "ăn")
        String meaning,

        @Schema(example = "Động từ nhóm 2")
        String partOfSpeech,

        @Schema(example = "N5")
        String jlptLevel,

        @Schema(
                example =
                        "毎朝、パンを食べます。 → Mỗi sáng tôi ăn bánh mì."
        )
        String example,

        @Schema(
                example =
                        "Cách dùng: dùng cho hành động ăn | Phân biệt: 食う thô và casual hơn."
        )
        String note

) {

    /*
     * Backward compatibility:
     * code/test cũ dùng constructor 8 field
     * vẫn tiếp tục hoạt động.
     */
    public StudyVocabularyItem(
            String surface,
            String dictionaryForm,
            String reading,
            String romaji,
            String meaning,
            String partOfSpeech,
            String jlptLevel,
            String note
    ) {
        this(
                surface,
                dictionaryForm,
                reading,
                romaji,
                meaning,
                partOfSpeech,
                jlptLevel,
                "",
                note
        );
    }
}

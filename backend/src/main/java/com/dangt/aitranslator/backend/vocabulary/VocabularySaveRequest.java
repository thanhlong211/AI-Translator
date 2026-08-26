package com.dangt.aitranslator.backend.vocabulary;

import com.dangt.aitranslator.backend.study.EnglishStudyVocabularyItem;
import com.dangt.aitranslator.backend.study.StudyLanguage;
import com.dangt.aitranslator.backend.study.StudyVocabularyItem;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VocabularySaveRequest(

        @Size(max = 190)
        @Schema(example = "行かなければ")
        String surface,

        @NotBlank
        @Size(max = 190)
        @Schema(example = "行く")
        String dictionaryForm,

        @Size(max = 190)
        @Schema(example = "いく")
        String reading,

        @Size(max = 255)
        @Schema(example = "iku")
        String romaji,

        @Size(max = 500)
        @Schema(example = "đi")
        String meaning,

        @Size(max = 120)
        @Schema(example = "Động từ")
        String partOfSpeech,

        @Size(max = 20)
        @Schema(example = "N5")
        String jlptLevel,

        @Schema(example = "JA")
        StudyLanguage language,

        @Size(max = 190)
        @Schema(example = "study")
        String lemma,

        @Size(max = 255)
        @Schema(example = "ˈstʌdi")
        String ipa,

        @Size(max = 20)
        @Schema(example = "B1")
        String cefrLevel,

        @Size(max = 1000)
        @Schema(example = "I study English every day.")
        String example,

        @Schema(
                description =
                        "true = đây là một lần gặp mới; false = chỉ Save thủ công."
        )
        boolean recordEncounter

) {
    public VocabularySaveRequest(
            String surface,
            String dictionaryForm,
            String reading,
            String romaji,
            String meaning,
            String partOfSpeech,
            String jlptLevel,
            boolean recordEncounter
    ) {
        this(
                surface,
                dictionaryForm,
                reading,
                romaji,
                meaning,
                partOfSpeech,
                jlptLevel,
                StudyLanguage.JA,
                null,
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

    public StudyVocabularyItem toStudyItem() {
        return new StudyVocabularyItem(
                surface,
                dictionaryForm,
                reading,
                romaji,
                meaning,
                partOfSpeech,
                jlptLevel,
                ""
        );
    }

    public EnglishStudyVocabularyItem toEnglishStudyItem() {
        return new EnglishStudyVocabularyItem(
                surface,
                lemma == null || lemma.isBlank()
                        ? dictionaryForm
                        : lemma,
                ipa,
                meaning,
                partOfSpeech,
                cefrLevel,
                example,
                ""
        );
    }
}

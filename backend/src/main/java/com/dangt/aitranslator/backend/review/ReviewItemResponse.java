package com.dangt.aitranslator.backend.review;

import com.dangt.aitranslator.backend.grammar.UserGrammar;
import com.dangt.aitranslator.backend.study.StudyLanguage;
import com.dangt.aitranslator.backend.vocabulary.UserVocabulary;

import java.time.Instant;
import java.util.List;

public record ReviewItemResponse(
        ReviewItemType itemType,
        Long itemId,
        String primaryText,
        String secondaryText,
        String reading,
        String romaji,
        String answer,
        String detail,
        String jlptLevel,
        StudyLanguage language,
        String ipa,
        String cefrLevel,
        String example,
        String learningStatus,
        boolean favorite,
        int encounterCount,
        String personalNote,
        Instant dueAt,
        int intervalDays,
        double easeFactor,
        int repetitions,
        int lapseCount,
        Instant lastReviewedAt,

        boolean quizReady,
        ReviewQuestionType questionType,
        List<ReviewOptionResponse> options,

        ReviewMasteryLevel masteryLevel,
        int accuracyPercent,
        int correctCount,
        int wrongCount,
        int correctStreak
) {

    /*
     * Compatibility:
     * code cũ không truyền questionType
     * vẫn hoạt động như WORD -> MEANING.
     */
    public static ReviewItemResponse from(
            UserVocabulary vocabulary,
            List<ReviewOptionResponse> options,
            ReviewMasteryLevel masteryLevel,
            int accuracyPercent
    ) {
        return from(
                vocabulary,
                ReviewQuestionType.MEANING,
                options,
                masteryLevel,
                accuracyPercent
        );
    }

    public static ReviewItemResponse from(
            UserVocabulary vocabulary,
            ReviewQuestionType questionType,
            List<ReviewOptionResponse> options,
            ReviewMasteryLevel masteryLevel,
            int accuracyPercent
    ) {
        ReviewQuestionType safeQuestionType =
                questionType == null
                        ? ReviewQuestionType.MEANING
                        : questionType;

        List<ReviewOptionResponse> safeOptions =
                options == null
                        ? List.of()
                        : List.copyOf(options);

        String word =
                vocabularyWord(
                        vocabulary
                );

        String prompt =
                switch (
                        safeQuestionType
                ) {
                    case MEANING,
                         WORD_TO_MEANING ->
                            word;

                    case MEANING_TO_WORD ->
                            safe(
                                    vocabulary.getMeaning()
                            );

                    case READING_TO_WORD ->
                            safe(
                                    vocabulary.getReading()
                            );

                    case IPA_TO_WORD ->
                            safe(
                                    vocabulary.getIpa()
                            );

                    case PATTERN_TO_MEANING,
                         MEANING_TO_PATTERN,
                         EXAMPLE_TO_PATTERN ->
                            throw new IllegalArgumentException(
                                    "Question type không phù hợp với Vocabulary."
                            );
                };

        /*
         * Không gửi surface làm context ở reverse quiz,
         * vì có thể làm lộ đáp án.
         */
        String secondaryText =
                switch (
                        safeQuestionType
                ) {
                    case MEANING,
                         WORD_TO_MEANING ->
                            safe(
                                    vocabulary.getSurface()
                            );

                    default ->
                            "";
                };

        return new ReviewItemResponse(
                ReviewItemType.VOCABULARY,
                vocabulary.getId(),
                prompt,
                secondaryText,
                vocabulary.getReading(),
                vocabulary.getRomaji(),
                vocabulary.getMeaning(),
                vocabulary.getPartOfSpeech(),
                vocabulary.getJlptLevel(),
                vocabulary.getLanguage(),
                vocabulary.getIpa(),
                vocabulary.getCefrLevel(),
                vocabulary.getExample(),
                vocabulary.getStatus().name(),
                vocabulary.isFavorite(),
                vocabulary.getEncounterCount(),
                vocabulary.getPersonalNote(),
                vocabulary.getDueAt(),
                vocabulary.getIntervalDays(),
                vocabulary.getEaseFactor(),
                vocabulary.getRepetitions(),
                vocabulary.getLapseCount(),
                vocabulary.getLastReviewedAt(),

                safeOptions.size() == 4
                &&
                !safe(prompt).isBlank(),

                safeQuestionType,
                safeOptions,

                masteryLevel,
                accuracyPercent,
                vocabulary.getReviewCorrectCount(),
                vocabulary.getReviewWrongCount(),
                vocabulary.getCorrectStreak()
        );
    }

    /*
     * Compatibility cho code cũ:
     * Grammar mặc định vẫn là PATTERN -> MEANING.
     */
    public static ReviewItemResponse from(
            UserGrammar grammar,
            List<ReviewOptionResponse> options,
            ReviewMasteryLevel masteryLevel,
            int accuracyPercent
    ) {
        return from(
                grammar,
                ReviewQuestionType.MEANING,
                options,
                masteryLevel,
                accuracyPercent
        );
    }

    public static ReviewItemResponse from(
            UserGrammar grammar,
            ReviewQuestionType questionType,
            List<ReviewOptionResponse> options,
            ReviewMasteryLevel masteryLevel,
            int accuracyPercent
    ) {
        ReviewQuestionType safeQuestionType =
                questionType == null
                        ? ReviewQuestionType.MEANING
                        : questionType;

        List<ReviewOptionResponse> safeOptions =
                options == null
                        ? List.of()
                        : List.copyOf(options);

        String prompt =
                switch (
                        safeQuestionType
                ) {
                    /*
                     * MEANING là alias legacy.
                     */
                    case MEANING,
                         PATTERN_TO_MEANING ->
                            safe(
                                    grammar.getPattern()
                            );

                    case MEANING_TO_PATTERN ->
                            safe(
                                    grammar.getMeaning()
                            );

                    case EXAMPLE_TO_PATTERN ->
                            safe(
                                    grammar.getExample()
                            );

                    case WORD_TO_MEANING,
                         MEANING_TO_WORD,
                         READING_TO_WORD,
                         IPA_TO_WORD ->
                            throw new IllegalArgumentException(
                                    "Question type không phù hợp với Grammar."
                            );
                };

        String correctAnswer =
                switch (
                        safeQuestionType
                ) {
                    case MEANING,
                         PATTERN_TO_MEANING ->
                            safe(
                                    grammar.getMeaning()
                            );

                    case MEANING_TO_PATTERN,
                         EXAMPLE_TO_PATTERN ->
                            safe(
                                    grammar.getPattern()
                            );

                    case WORD_TO_MEANING,
                         MEANING_TO_WORD,
                         READING_TO_WORD,
                         IPA_TO_WORD ->
                            throw new IllegalArgumentException(
                                    "Question type không phù hợp với Grammar."
                            );
                };

        return new ReviewItemResponse(
                ReviewItemType.GRAMMAR,
                grammar.getId(),
                prompt,
                safe(
                        grammar.getMatchedText()
                ),
                "",
                "",
                correctAnswer,
                grammar.getExplanation(),
                grammar.getJlptLevel(),
                grammar.getLanguage(),
                "",
                grammar.getCefrLevel(),
                grammar.getExample(),
                grammar.getStatus().name(),
                grammar.isFavorite(),
                grammar.getEncounterCount(),
                grammar.getPersonalNote(),
                grammar.getDueAt(),
                grammar.getIntervalDays(),
                grammar.getEaseFactor(),
                grammar.getRepetitions(),
                grammar.getLapseCount(),
                grammar.getLastReviewedAt(),

                safeOptions.size() == 4
                &&
                !safe(prompt).isBlank(),

                safeQuestionType,
                safeOptions,

                masteryLevel,
                accuracyPercent,
                grammar.getReviewCorrectCount(),
                grammar.getReviewWrongCount(),
                grammar.getCorrectStreak()
        );
    }

    private static String vocabularyWord(
            UserVocabulary vocabulary
    ) {
        /*
         * EN ưu tiên lemma.
         * JA ưu tiên dictionary form.
         */
        if (
                vocabulary.getLanguage()
                ==
                StudyLanguage.EN
        ) {
            String lemma =
                    safe(
                            vocabulary.getLemma()
                    );

            if (!lemma.isBlank()) {
                return lemma;
            }
        }

        String dictionaryForm =
                safe(
                        vocabulary.getDictionaryForm()
                );

        if (!dictionaryForm.isBlank()) {
            return dictionaryForm;
        }

        return safe(
                vocabulary.getSurface()
        );
    }

    private static String safe(
            String value
    ) {
        return value == null
                ? ""
                : value.trim();
    }
}

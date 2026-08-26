package com.dangt.aitranslator.backend.review;

import com.dangt.aitranslator.backend.study.StudyLanguage;
import com.dangt.aitranslator.backend.grammar.UserGrammar;
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

    public static ReviewItemResponse from(
            UserVocabulary vocabulary,
            List<ReviewOptionResponse> options,
            ReviewMasteryLevel masteryLevel,
            int accuracyPercent
    ) {
        List<ReviewOptionResponse> safeOptions =
                options == null
                        ? List.of()
                        : List.copyOf(options);

        return new ReviewItemResponse(
                ReviewItemType.VOCABULARY,
                vocabulary.getId(),
                vocabulary.getDictionaryForm(),
                vocabulary.getSurface(),
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

                safeOptions.size() == 4,
                ReviewQuestionType.MEANING,
                safeOptions,

                masteryLevel,
                accuracyPercent,
                vocabulary.getReviewCorrectCount(),
                vocabulary.getReviewWrongCount(),
                vocabulary.getCorrectStreak()
        );
    }

    public static ReviewItemResponse from(
            UserGrammar grammar,
            List<ReviewOptionResponse> options,
            ReviewMasteryLevel masteryLevel,
            int accuracyPercent
    ) {
        List<ReviewOptionResponse> safeOptions =
                options == null
                        ? List.of()
                        : List.copyOf(options);

        return new ReviewItemResponse(
                ReviewItemType.GRAMMAR,
                grammar.getId(),
                grammar.getPattern(),
                "",
                "",
                "",
                grammar.getMeaning(),
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

                safeOptions.size() == 4,
                ReviewQuestionType.MEANING,
                safeOptions,

                masteryLevel,
                accuracyPercent,
                grammar.getReviewCorrectCount(),
                grammar.getReviewWrongCount(),
                grammar.getCorrectStreak()
        );
    }
}

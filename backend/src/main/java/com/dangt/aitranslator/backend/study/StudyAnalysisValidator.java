package com.dangt.aitranslator.backend.study;

import com.dangt.aitranslator.backend.common.AiResponseFormatException;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class StudyAnalysisValidator {

    public StudyAnalysisPayload validateAndNormalize(
            StudyAnalysisPayload payload,
            String expectedOriginal
    ) {
        if (payload == null) {
            throw new AiResponseFormatException(
                    "AI không trả về Study Analysis."
            );
        }

        String original =
                clean(payload.original());

        if (original.isBlank()) {
            original =
                    clean(expectedOriginal);
        }

        String translation =
                clean(payload.translation());

        if (translation.isBlank()) {
            throw new AiResponseFormatException(
                    "Study Analysis thiếu bản dịch tiếng Việt."
            );
        }

        return new StudyAnalysisPayload(
                original,
                clean(payload.reading()),
                clean(payload.romaji()),
                translation,
                clean(payload.sentenceSummary()),
                normalizeParts(
                        payload.sentenceParts()
                ),
                normalizeGrammar(
                        payload.grammar()
                ),
                normalizeVocabulary(
                        payload.vocabulary()
                ),
                normalizeNotes(
                        payload.notes()
                )
        );
    }

    private List<StudySentencePart> normalizeParts(
            List<StudySentencePart> items
    ) {
        if (items == null) {
            return List.of();
        }

        return items
                .stream()
                .filter(item ->
                        item != null &&
                        !clean(item.text()).isBlank()
                )
                .limit(12)
                .map(item ->
                        new StudySentencePart(
                                clean(item.text()),
                                clean(item.reading()),
                                clean(item.romaji()),
                                clean(item.role()),
                                clean(item.meaning()),
                                clean(item.explanation())
                        )
                )
                .toList();
    }

    private List<StudyGrammarPoint> normalizeGrammar(
            List<StudyGrammarPoint> items
    ) {
        if (items == null) {
            return List.of();
        }

        return items
                .stream()
                .filter(item ->
                        item != null &&
                        !clean(item.pattern()).isBlank()
                )
                .limit(6)
                .map(item ->
                        new StudyGrammarPoint(
                                clean(item.pattern()),
                                normalizeJlpt(
                                        item.jlptLevel()
                                ),
                                clean(item.meaning()),
                                clean(item.matchedText()),
                                clean(item.explanation())
                        )
                )
                .toList();
    }

    private List<StudyVocabularyItem> normalizeVocabulary(
            List<StudyVocabularyItem> items
    ) {
        if (items == null) {
            return List.of();
        }

        return items
                .stream()
                .filter(item ->
                        item != null &&
                        (
                                !clean(
                                        item.dictionaryForm()
                                ).isBlank()
                                ||
                                !clean(
                                        item.surface()
                                ).isBlank()
                        )
                )
                .limit(15)
                .map(item ->
                        new StudyVocabularyItem(
                                clean(item.surface()),
                                clean(item.dictionaryForm()),
                                clean(item.reading()),
                                clean(item.romaji()),
                                clean(item.meaning()),
                                clean(item.partOfSpeech()),
                                normalizeJlpt(
                                        item.jlptLevel()
                                ),
                                clean(item.note())
                        )
                )
                .toList();
    }

    private List<String> normalizeNotes(
            List<String> notes
    ) {
        if (notes == null) {
            return List.of();
        }

        return notes
                .stream()
                .map(this::clean)
                .filter(value ->
                        !value.isBlank()
                )
                .limit(3)
                .toList();
    }

    private String normalizeJlpt(
            String value
    ) {
        String normalized =
                clean(value)
                        .toUpperCase();

        return switch (normalized) {
            case "N5", "N4", "N3", "N2", "N1" ->
                    normalized;
            default ->
                    "UNKNOWN";
        };
    }

    private String clean(String value) {
        return value == null
                ? ""
                : value.trim();
    }
}

package com.dangt.aitranslator.backend.study;

import com.dangt.aitranslator.backend.common.AiResponseFormatException;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class EnglishStudyAnalysisValidator {

    public StudyAnalysisPayload validateAndNormalize(
            EnglishStudyStructuredOutput output,
            String expectedOriginal
    ) {
        if (output == null) {
            throw new AiResponseFormatException(
                    "AI không trả về English Study Analysis."
            );
        }

        String original =
                clean(output.original);

        if (original.isBlank()) {
            original =
                    clean(expectedOriginal);
        }

        String translation =
                clean(output.translation);

        if (translation.isBlank()) {
            throw new AiResponseFormatException(
                    "English Study Analysis thiếu bản dịch tiếng Việt."
            );
        }


        List<StudySentencePart> parts =
                output.sentenceParts == null
                        ? List.of()
                        : output.sentenceParts
                                .stream()
                                .filter(item ->
                                        item != null &&
                                        !clean(item.text).isBlank()
                                )
                                .limit(12)
                                .map(item ->
                                        new StudySentencePart(
                                                clean(item.text),
                                                "",
                                                "",
                                                clean(item.role),
                                                clean(item.meaning),
                                                clean(item.explanation)
                                        )
                                )
                                .toList();


        List<EnglishStudyGrammarPoint> grammar =
                output.grammar == null
                        ? List.of()
                        : output.grammar
                                .stream()
                                .filter(item ->
                                        item != null &&
                                        !clean(item.pattern).isBlank()
                                )
                                .limit(6)
                                .map(item ->
                                        new EnglishStudyGrammarPoint(
                                                clean(item.pattern),
                                                normalizeCefr(
                                                        item.cefrLevel
                                                ),
                                                clean(item.meaning),
                                                clean(item.matchedText),
                                                clean(item.explanation),
                                                clean(item.example)
                                        )
                                )
                                .toList();


        List<EnglishStudyVocabularyItem> vocabulary =
                output.vocabulary == null
                        ? List.of()
                        : output.vocabulary
                                .stream()
                                .filter(item ->
                                        item != null &&
                                        (
                                                !clean(
                                                        item.surface
                                                ).isBlank()
                                                ||
                                                !clean(
                                                        item.lemma
                                                ).isBlank()
                                        )
                                )
                                .limit(15)
                                .map(item ->
                                        new EnglishStudyVocabularyItem(
                                                clean(item.surface),
                                                clean(item.lemma),
                                                clean(item.ipa),
                                                clean(item.meaning),
                                                clean(item.partOfSpeech),
                                                normalizeCefr(
                                                        item.cefrLevel
                                                ),
                                                clean(item.example),
                                                clean(item.note)
                                        )
                                )
                                .toList();


        List<EnglishStudyCollocationItem> collocations =
                output.collocations == null
                        ? List.of()
                        : output.collocations
                                .stream()
                                .filter(item ->
                                        item != null &&
                                        !clean(item.phrase).isBlank()
                                )
                                .limit(6)
                                .map(item ->
                                        new EnglishStudyCollocationItem(
                                                clean(item.phrase),
                                                clean(item.meaning),
                                                clean(item.example)
                                        )
                                )
                                .toList();


        List<EnglishStudyCommonMistake> mistakes =
                output.commonMistakes == null
                        ? List.of()
                        : output.commonMistakes
                                .stream()
                                .filter(item ->
                                        item != null &&
                                        (
                                                !clean(
                                                        item.incorrect
                                                ).isBlank()
                                                ||
                                                !clean(
                                                        item.correct
                                                ).isBlank()
                                        )
                                )
                                .limit(4)
                                .map(item ->
                                        new EnglishStudyCommonMistake(
                                                clean(item.incorrect),
                                                clean(item.correct),
                                                clean(item.explanation)
                                        )
                                )
                                .toList();


        List<String> notes =
                output.notes == null
                        ? List.of()
                        : output.notes
                                .stream()
                                .map(this::clean)
                                .filter(value ->
                                        !value.isBlank()
                                )
                                .limit(3)
                                .toList();


        return new StudyAnalysisPayload(
                original,

                "",
                "",

                translation,
                clean(
                        output.sentenceSummary
                ),

                parts,

                List.of(),
                List.of(),

                notes,

                clean(output.ipa),

                normalizeCefr(
                        output.cefrLevel
                ),

                grammar,
                vocabulary,
                collocations,
                mistakes
        );
    }


    private String normalizeCefr(
            String value
    ) {
        String normalized =
                clean(value)
                        .toUpperCase();

        return switch (normalized) {

            case "A1",
                 "A2",
                 "B1",
                 "B2",
                 "C1",
                 "C2" ->
                    normalized;

            default ->
                    "UNKNOWN";
        };
    }


    private String clean(
            String value
    ) {
        return value == null
                ? ""
                : value.trim();
    }
}

package com.dangt.aitranslator.backend.study;

import java.util.List;

public record StudyAnalysisPayload(
        String original,
        String reading,
        String romaji,
        String translation,
        String sentenceSummary,
        List<StudySentencePart> sentenceParts,
        List<StudyGrammarPoint> grammar,
        List<StudyVocabularyItem> vocabulary,
        List<String> notes
) {
    public StudyAnalysisPayload {
        sentenceParts =
                sentenceParts == null
                        ? List.of()
                        : List.copyOf(sentenceParts);

        grammar =
                grammar == null
                        ? List.of()
                        : List.copyOf(grammar);

        vocabulary =
                vocabulary == null
                        ? List.of()
                        : List.copyOf(vocabulary);

        notes =
                notes == null
                        ? List.of()
                        : List.copyOf(notes);
    }
}

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
        List<String> notes,

        /*
         * English Study fields.
         */
        String ipa,
        String cefrLevel,

        List<EnglishStudyGrammarPoint> englishGrammar,
        List<EnglishStudyVocabularyItem> englishVocabulary,
        List<EnglishStudyCollocationItem> collocations,
        List<EnglishStudyCommonMistake> commonMistakes

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

        ipa =
                ipa == null
                        ? ""
                        : ipa;

        cefrLevel =
                cefrLevel == null ||
                cefrLevel.isBlank()
                        ? "UNKNOWN"
                        : cefrLevel;

        englishGrammar =
                englishGrammar == null
                        ? List.of()
                        : List.copyOf(englishGrammar);

        englishVocabulary =
                englishVocabulary == null
                        ? List.of()
                        : List.copyOf(englishVocabulary);

        collocations =
                collocations == null
                        ? List.of()
                        : List.copyOf(collocations);

        commonMistakes =
                commonMistakes == null
                        ? List.of()
                        : List.copyOf(commonMistakes);
    }


    /*
     * Constructor cũ cho Japanese Study.
     */
    public StudyAnalysisPayload(
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
        this(
                original,
                reading,
                romaji,
                translation,
                sentenceSummary,
                sentenceParts,
                grammar,
                vocabulary,
                notes,

                "",
                "UNKNOWN",

                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
    }
}

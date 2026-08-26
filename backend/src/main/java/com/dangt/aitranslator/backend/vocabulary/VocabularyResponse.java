package com.dangt.aitranslator.backend.vocabulary;

import com.dangt.aitranslator.backend.study.StudyLanguage;
import java.time.Instant;

public record VocabularyResponse(
        Long id,
        String surface,
        String dictionaryForm,
        String reading,
        String romaji,
        String meaning,
        String partOfSpeech,
        String jlptLevel,
        StudyLanguage language,
        String lemma,
        String ipa,
        String cefrLevel,
        String example,
        VocabularyStatus status,
        boolean favorite,
        int encounterCount,
        String personalNote,
        Instant firstSeenAt,
        Instant lastSeenAt,
        Instant createdAt,
        Instant updatedAt
) {
    public static VocabularyResponse from(
            UserVocabulary vocabulary
    ) {
        return new VocabularyResponse(
                vocabulary.getId(),
                vocabulary.getSurface(),
                vocabulary.getDictionaryForm(),
                vocabulary.getReading(),
                vocabulary.getRomaji(),
                vocabulary.getMeaning(),
                vocabulary.getPartOfSpeech(),
                vocabulary.getJlptLevel(),
                vocabulary.getLanguage(),
                vocabulary.getLemma(),
                vocabulary.getIpa(),
                vocabulary.getCefrLevel(),
                vocabulary.getExample(),
                vocabulary.getStatus(),
                vocabulary.isFavorite(),
                vocabulary.getEncounterCount(),
                vocabulary.getPersonalNote(),
                vocabulary.getFirstSeenAt(),
                vocabulary.getLastSeenAt(),
                vocabulary.getCreatedAt(),
                vocabulary.getUpdatedAt()
        );
    }
}

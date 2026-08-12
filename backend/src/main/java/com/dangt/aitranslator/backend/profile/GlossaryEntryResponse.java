package com.dangt.aitranslator.backend.profile;

import com.dangt.aitranslator.backend.translation.TranslationLanguage;

public record GlossaryEntryResponse(
        Long id,
        TranslationLanguage sourceLanguage,
        TranslationLanguage targetLanguage,
        String source,
        String target,
        String note
) {
    public static GlossaryEntryResponse from(
            ProfileGlossaryEntry entry
    ) {
        return new GlossaryEntryResponse(
                entry.getId(),
                entry.getSourceLanguage(),
                entry.getTargetLanguage(),
                entry.getSource(),
                entry.getTarget(),
                entry.getNote()
        );
    }
}

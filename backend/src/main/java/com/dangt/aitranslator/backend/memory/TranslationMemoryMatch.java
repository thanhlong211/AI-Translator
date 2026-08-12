package com.dangt.aitranslator.backend.memory;

import com.dangt.aitranslator.backend.translation.TranslationLanguage;

public record TranslationMemoryMatch(
        Long memoryId,
        String translatedText,
        TranslationLanguage matchedSourceLanguage
) {
}

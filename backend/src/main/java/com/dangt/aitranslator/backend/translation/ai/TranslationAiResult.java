package com.dangt.aitranslator.backend.translation.ai;

public record TranslationAiResult(
        String text,
        String provider,
        String model
) {
}

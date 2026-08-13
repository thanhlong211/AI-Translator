package com.dangt.aitranslator.backend.translation.ai;

import com.dangt.aitranslator.backend.usage.AiProviderUsage;

public record TranslationAiResult(
        String text,
        String provider,
        String model,
        AiProviderUsage usage
) {
}

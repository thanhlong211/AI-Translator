package com.dangt.aitranslator.backend.usage;

/**
 * Provider-side metadata for one AI call.
 *
 * No prompt, source text, translated text, OCR content, or document content
 * belongs in this record.
 */
public record AiProviderUsage(
        String provider,
        String model,
        String providerRequestId,
        Long inputTokens,
        Long outputTokens,
        Long cachedTokens,
        Long totalTokens
) {
}

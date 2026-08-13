package com.dangt.aitranslator.backend.usage;

import com.openai.models.responses.Response;
import com.openai.models.responses.ResponseUsage;

/**
 * Extracts billing metadata from the OpenAI Responses API without allowing
 * malformed/missing usage metadata to break a successful translation.
 */
public final class OpenAiUsageExtractor {

    private OpenAiUsageExtractor() {
    }

    public static AiProviderUsage from(
            Response response,
            String configuredModel
    ) {
        if (response == null) {
            return empty(configuredModel);
        }

        ResponseUsage usage = response.usage().orElse(null);

        return new AiProviderUsage(
                "openai",
                cleanModel(response, configuredModel),
                safeResponseId(response),
                safeInputTokens(usage),
                safeOutputTokens(usage),
                safeCachedTokens(usage),
                safeTotalTokens(usage)
        );
    }

    public static AiProviderUsage empty(
            String configuredModel
    ) {
        return new AiProviderUsage(
                "openai",
                normalize(configuredModel, "unknown"),
                null,
                null,
                null,
                null,
                null
        );
    }

    private static String cleanModel(
            Response response,
            String fallback
    ) {
        /*
         * Use the configured wire model name as the stable billing key.
         * ResponsesModel#toString() is a debug representation, not the wire ID.
         */
        return normalize(fallback, "unknown");
    }

    private static String safeResponseId(
            Response response
    ) {
        try {
            return normalize(response.id(), null);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static Long safeInputTokens(
            ResponseUsage usage
    ) {
        if (usage == null) {
            return null;
        }
        try {
            return usage.inputTokens();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static Long safeOutputTokens(
            ResponseUsage usage
    ) {
        if (usage == null) {
            return null;
        }
        try {
            return usage.outputTokens();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static Long safeCachedTokens(
            ResponseUsage usage
    ) {
        if (usage == null) {
            return null;
        }
        try {
            return usage
                    .inputTokensDetails()
                    .cachedTokens();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static Long safeTotalTokens(
            ResponseUsage usage
    ) {
        if (usage == null) {
            return null;
        }
        try {
            return usage.totalTokens();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static String normalize(
            Object value,
            String fallback
    ) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        return clean.isEmpty() ? fallback : clean;
    }
}

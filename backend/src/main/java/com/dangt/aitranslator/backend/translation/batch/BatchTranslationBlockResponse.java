package com.dangt.aitranslator.backend.translation.batch;

import io.swagger.v3.oas.annotations.media.Schema;

public record BatchTranslationBlockResponse(
        String id,
        String original,
        String translatedText,

        @Deprecated
        @Schema(
                description = "Legacy alias của translatedText.",
                deprecated = true
        )
        String vietnamese,

        Source source
) {
    public enum Source {
        AI,
        PERSONAL_MEMORY
    }

    public static BatchTranslationBlockResponse ai(
            String id,
            String original,
            String translatedText
    ) {
        return new BatchTranslationBlockResponse(
                id,
                original,
                translatedText,
                translatedText,
                Source.AI
        );
    }

    public static BatchTranslationBlockResponse memory(
            String id,
            String original,
            String translatedText
    ) {
        return new BatchTranslationBlockResponse(
                id,
                original,
                translatedText,
                translatedText,
                Source.PERSONAL_MEMORY
        );
    }
}

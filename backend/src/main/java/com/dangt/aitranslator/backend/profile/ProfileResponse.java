package com.dangt.aitranslator.backend.profile;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

public record ProfileResponse(

        Long id,
        String name,
        TranslationStyle style,
        int contextLines,
        boolean keepHonorifics,
        String customInstruction,

        @Schema(
                description =
                        "Profile mặc định sẽ được dùng nếu /translate không truyền profileId."
        )
        boolean defaultProfile,

        List<CharacterRuleResponse> characters,
        List<GlossaryEntryResponse> glossary,
        Instant createdAt,
        Instant updatedAt

) {
    public static ProfileResponse from(
            TranslationProfile profile
    ) {
        return new ProfileResponse(
                profile.getId(),
                profile.getName(),
                profile.getStyle(),
                profile.getContextLines(),
                profile.isKeepHonorifics(),
                profile.getCustomInstruction(),
                profile.isDefaultProfile(),
                profile.getCharacters()
                        .stream()
                        .map(
                                CharacterRuleResponse::from
                        )
                        .toList(),
                profile.getGlossary()
                        .stream()
                        .map(
                                GlossaryEntryResponse::from
                        )
                        .toList(),
                profile.getCreatedAt(),
                profile.getUpdatedAt()
        );
    }
}

package com.dangt.aitranslator.backend.profile;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.util.List;

public record ProfileUpsertRequest(

        @NotBlank
        @Size(max = 80)
        @Schema(example = "Frieren")
        String name,

        @NotNull
        @Schema(example = "MANGA")
        TranslationStyle style,

        @Min(0)
        @Max(10)
        @Schema(example = "5")
        int contextLines,

        @Schema(example = "true")
        boolean keepHonorifics,

        @Size(max = 3000)
        @Schema(
                example =
                        "Dịch tự nhiên. Không Việt hóa tên riêng khi không chắc."
        )
        String customInstruction,

        @Valid
        @Size(max = 50)
        List<CharacterRuleRequest> characters,

        @Valid
        @Size(max = 100)
        List<GlossaryEntryRequest> glossary

) {
    public ProfileUpsertRequest {
        characters =
                characters == null
                        ? List.of()
                        : List.copyOf(characters);

        glossary =
                glossary == null
                        ? List.of()
                        : List.copyOf(glossary);
    }
}

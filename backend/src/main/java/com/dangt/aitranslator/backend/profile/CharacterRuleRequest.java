package com.dangt.aitranslator.backend.profile;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CharacterRuleRequest(

        @NotBlank
        @Size(max = 100)
        @Schema(example = "Frieren")
        String name,

        @Size(max = 10)
        List<
                @Size(max = 100)
                String
        > aliases,

        @NotBlank
        @Size(max = 1000)
        @Schema(
                example =
                        "Frieren xưng tôi. Fern gọi Frieren là sư phụ."
        )
        String rule

) {
    public CharacterRuleRequest {
        aliases =
                aliases == null
                        ? List.of()
                        : aliases.stream()
                                .map(value ->
                                        value == null
                                                ? ""
                                                : value.trim()
                                )
                                .filter(value ->
                                        !value.isBlank()
                                )
                                .toList();
    }
}

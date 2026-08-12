package com.dangt.aitranslator.backend.profile;

import java.util.Arrays;
import java.util.List;

public record CharacterRuleResponse(
        Long id,
        String name,
        List<String> aliases,
        String rule
) {
    public static CharacterRuleResponse from(
            ProfileCharacter character
    ) {
        List<String> aliases =
                character.getAliasesText() == null
                        || character.getAliasesText().isBlank()
                        ? List.of()
                        : Arrays.stream(
                                character
                                        .getAliasesText()
                                        .split("\\R")
                        )
                        .map(String::trim)
                        .filter(value ->
                                !value.isBlank()
                        )
                        .toList();

        return new CharacterRuleResponse(
                character.getId(),
                character.getName(),
                aliases,
                character.getRule()
        );
    }
}

package com.dangt.aitranslator.backend.grammar;

import org.springframework.data.domain.Page;

import java.util.List;

public record GrammarPageResponse(
        List<GrammarResponse> items,
        long totalItems,
        int page,
        int size,
        int totalPages
) {
    public static GrammarPageResponse from(
            Page<UserGrammar> result
    ) {
        return new GrammarPageResponse(
                result.getContent()
                        .stream()
                        .map(
                                GrammarResponse::from
                        )
                        .toList(),
                result.getTotalElements(),
                result.getNumber(),
                result.getSize(),
                result.getTotalPages()
        );
    }
}

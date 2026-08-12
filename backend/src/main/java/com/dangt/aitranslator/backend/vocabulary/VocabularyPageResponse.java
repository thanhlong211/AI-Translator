package com.dangt.aitranslator.backend.vocabulary;

import org.springframework.data.domain.Page;

import java.util.List;

public record VocabularyPageResponse(
        List<VocabularyResponse> items,
        long totalItems,
        int page,
        int size,
        int totalPages
) {
    public static VocabularyPageResponse from(
            Page<UserVocabulary> result
    ) {
        return new VocabularyPageResponse(
                result.getContent()
                        .stream()
                        .map(
                                VocabularyResponse::from
                        )
                        .toList(),
                result.getTotalElements(),
                result.getNumber(),
                result.getSize(),
                result.getTotalPages()
        );
    }
}

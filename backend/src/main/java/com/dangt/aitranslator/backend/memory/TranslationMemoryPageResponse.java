package com.dangt.aitranslator.backend.memory;

import org.springframework.data.domain.Page;

import java.util.List;

public record TranslationMemoryPageResponse(
        List<TranslationMemoryResponse> items,
        long totalItems,
        int page,
        int size,
        int totalPages
) {
    public static TranslationMemoryPageResponse from(
            Page<TranslationMemory> result
    ) {
        return new TranslationMemoryPageResponse(
                result.getContent()
                        .stream()
                        .map(TranslationMemoryResponse::from)
                        .toList(),
                result.getTotalElements(),
                result.getNumber(),
                result.getSize(),
                result.getTotalPages()
        );
    }
}

package com.dangt.aitranslator.backend.review;

import java.util.List;

public record ReviewQueueResponse(
        List<ReviewItemResponse> items,
        long totalDue,
        long vocabularyDue,
        long grammarDue
) {
}

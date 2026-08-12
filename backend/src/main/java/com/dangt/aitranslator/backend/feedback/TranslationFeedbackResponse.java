package com.dangt.aitranslator.backend.feedback;

import com.dangt.aitranslator.backend.memory.TranslationMemory;

import java.time.Instant;

public record TranslationFeedbackResponse(
        boolean success,
        Long feedbackId,
        boolean allowModelImprovement,
        boolean memoryUpdated,
        Long memoryId,
        Instant createdAt
) {
    public static TranslationFeedbackResponse from(
            TranslationFeedback feedback,
            TranslationMemory memory
    ) {
        return new TranslationFeedbackResponse(
                true,
                feedback.getId(),
                feedback.isAllowModelImprovement(),
                true,
                memory.getId(),
                feedback.getCreatedAt()
        );
    }
}

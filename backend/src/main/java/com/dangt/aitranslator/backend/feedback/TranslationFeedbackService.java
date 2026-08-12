package com.dangt.aitranslator.backend.feedback;

import com.dangt.aitranslator.backend.memory.TranslationMemory;
import com.dangt.aitranslator.backend.memory.TranslationMemoryService;
import com.dangt.aitranslator.backend.profile.ProfileService;
import com.dangt.aitranslator.backend.profile.TranslationProfile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TranslationFeedbackService {

    private final TranslationFeedbackRepository repository;
    private final ProfileService profileService;
    private final TranslationMemoryService memoryService;

    public TranslationFeedbackService(
            TranslationFeedbackRepository repository,
            ProfileService profileService,
            TranslationMemoryService memoryService
    ) {
        this.repository = repository;
        this.profileService = profileService;
        this.memoryService = memoryService;
    }

    @Transactional
    public TranslationFeedbackResponse save(
            Long userId,
            TranslationFeedbackRequest request
    ) {
        String sourceText = normalize(request.sourceText());
        String aiTranslation = normalize(request.aiTranslation());
        String correctedTranslation = normalize(request.correctedTranslation());

        if (aiTranslation.equals(correctedTranslation)) {
            throw new IllegalArgumentException(
                    "Bản sửa phải khác bản dịch trước đó."
            );
        }

        /*
         * Always resolve to a concrete owned profile id. This makes personal
         * memory deterministic even when the client sends profileId=null
         * to mean "use my default profile".
         */
        TranslationProfile profile =
                profileService.resolveProfile(
                        userId,
                        request.profileId()
                );

        TranslationFeedback feedback =
                repository.save(
                        new TranslationFeedback(
                                userId,
                                profile.getId(),
                                sourceText,
                                aiTranslation,
                                correctedTranslation,
                                request.sourceLanguage(),
                                request.targetLanguage(),
                                trimToNull(request.provider()),
                                trimToNull(request.model()),
                                trimToNull(request.requestId()),
                                request.allowModelImprovement()
                        )
                );

        TranslationMemory memory =
                memoryService.remember(
                        userId,
                        profile.getId(),
                        sourceText,
                        correctedTranslation,
                        request.sourceLanguage(),
                        request.targetLanguage(),
                        feedback.getId()
                );

        return TranslationFeedbackResponse.from(
                feedback,
                memory
        );
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}

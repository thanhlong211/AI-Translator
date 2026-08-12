package com.dangt.aitranslator.backend.feedback;

import com.dangt.aitranslator.backend.translation.TranslationLanguage;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(
        name = "translation_feedback",
        indexes = {
                @Index(name = "idx_translation_feedback_user_created", columnList = "user_id, created_at"),
                @Index(name = "idx_translation_feedback_language_pair", columnList = "source_language, target_language"),
                @Index(name = "idx_translation_feedback_model_improvement", columnList = "allow_model_improvement, created_at")
        }
)
public class TranslationFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "profile_id")
    private Long profileId;

    @Column(name = "source_text", nullable = false, columnDefinition = "TEXT")
    private String sourceText;

    @Column(name = "ai_translation", nullable = false, columnDefinition = "TEXT")
    private String aiTranslation;

    @Column(name = "corrected_translation", nullable = false, columnDefinition = "TEXT")
    private String correctedTranslation;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_language", nullable = false, length = 16)
    private TranslationLanguage sourceLanguage;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_language", nullable = false, length = 16)
    private TranslationLanguage targetLanguage;

    @Column(length = 80)
    private String provider;

    @Column(length = 120)
    private String model;

    @Column(name = "request_id", length = 120)
    private String requestId;

    @Column(name = "allow_model_improvement", nullable = false)
    private boolean allowModelImprovement;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected TranslationFeedback() {
    }

    public TranslationFeedback(
            Long userId,
            Long profileId,
            String sourceText,
            String aiTranslation,
            String correctedTranslation,
            TranslationLanguage sourceLanguage,
            TranslationLanguage targetLanguage,
            String provider,
            String model,
            String requestId,
            boolean allowModelImprovement
    ) {
        this.userId = userId;
        this.profileId = profileId;
        this.sourceText = sourceText;
        this.aiTranslation = aiTranslation;
        this.correctedTranslation = correctedTranslation;
        this.sourceLanguage = sourceLanguage;
        this.targetLanguage = targetLanguage;
        this.provider = provider;
        this.model = model;
        this.requestId = requestId;
        this.allowModelImprovement = allowModelImprovement;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Instant getCreatedAt() { return createdAt; }
    public boolean isAllowModelImprovement() { return allowModelImprovement; }
}

package com.dangt.aitranslator.backend.memory;

import com.dangt.aitranslator.backend.translation.TranslationLanguage;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(
        name = "translation_memory",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_translation_memory_exact",
                        columnNames = {
                                "user_id",
                                "profile_id",
                                "source_language",
                                "target_language",
                                "source_hash"
                        }
                )
        },
        indexes = {
                @Index(
                        name = "idx_translation_memory_user_updated",
                        columnList = "user_id, updated_at"
                )
        }
)
public class TranslationMemory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "profile_id", nullable = false)
    private Long profileId;

    @Column(name = "source_hash", nullable = false, length = 64)
    private String sourceHash;

    @Column(name = "source_text", nullable = false, columnDefinition = "TEXT")
    private String sourceText;

    @Column(name = "corrected_translation", nullable = false, columnDefinition = "TEXT")
    private String correctedTranslation;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_language", nullable = false, length = 16)
    private TranslationLanguage sourceLanguage;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_language", nullable = false, length = 16)
    private TranslationLanguage targetLanguage;

    @Column(name = "latest_feedback_id")
    private Long latestFeedbackId;

    @Column(name = "hit_count", nullable = false)
    private long hitCount;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected TranslationMemory() {
    }

    public TranslationMemory(
            Long userId,
            Long profileId,
            String sourceHash,
            String sourceText,
            String correctedTranslation,
            TranslationLanguage sourceLanguage,
            TranslationLanguage targetLanguage,
            Long latestFeedbackId
    ) {
        this.userId = userId;
        this.profileId = profileId;
        this.sourceHash = sourceHash;
        this.sourceText = sourceText;
        this.correctedTranslation = correctedTranslation;
        this.sourceLanguage = sourceLanguage;
        this.targetLanguage = targetLanguage;
        this.latestFeedbackId = latestFeedbackId;
        this.hitCount = 0L;

        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void updateCorrection(
            String sourceText,
            String correctedTranslation,
            Long latestFeedbackId
    ) {
        this.sourceText = sourceText;
        this.correctedTranslation = correctedTranslation;
        this.latestFeedbackId = latestFeedbackId;
        this.updatedAt = Instant.now();
    }

    public void updateCorrectedTranslation(
            String correctedTranslation
    ) {
        this.correctedTranslation = correctedTranslation;
        this.updatedAt = Instant.now();
    }

    public void markUsed() {
        this.hitCount += 1L;
        this.lastUsedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Long getProfileId() { return profileId; }
    public String getSourceText() { return sourceText; }
    public String getCorrectedTranslation() { return correctedTranslation; }
    public TranslationLanguage getSourceLanguage() { return sourceLanguage; }
    public TranslationLanguage getTargetLanguage() { return targetLanguage; }
    public Long getLatestFeedbackId() { return latestFeedbackId; }
    public long getHitCount() { return hitCount; }
    public Instant getLastUsedAt() { return lastUsedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

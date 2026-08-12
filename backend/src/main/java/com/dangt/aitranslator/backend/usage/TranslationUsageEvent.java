package com.dangt.aitranslator.backend.usage;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "translation_usage_events")
public class TranslationUsageEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, length = 100)
    private String model;

    @Column(name = "source_characters", nullable = false)
    private int sourceCharacters;

    @Column(name = "translated_characters", nullable = false)
    private int translatedCharacters;

    @Column(nullable = false)
    private boolean successful;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected TranslationUsageEvent() {
    }

    public TranslationUsageEvent(
            Long userId,
            String model,
            int sourceCharacters,
            int translatedCharacters,
            boolean successful
    ) {
        this.userId = userId;
        this.model = model;
        this.sourceCharacters = sourceCharacters;
        this.translatedCharacters = translatedCharacters;
        this.successful = successful;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }
}

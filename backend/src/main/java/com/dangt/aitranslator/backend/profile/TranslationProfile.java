package com.dangt.aitranslator.backend.profile;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "translation_profiles")
public class TranslationProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 80)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TranslationStyle style;

    @Column(name = "context_lines", nullable = false)
    private int contextLines;

    @Column(name = "keep_honorifics", nullable = false)
    private boolean keepHonorifics;

    @Column(name = "custom_instruction", columnDefinition = "TEXT")
    private String customInstruction;

    @Column(name = "is_default", nullable = false)
    private boolean defaultProfile;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(
            mappedBy = "profile",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @OrderBy("sortOrder ASC, id ASC")
    private List<ProfileCharacter> characters =
            new ArrayList<>();

    @OneToMany(
            mappedBy = "profile",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @OrderBy("sortOrder ASC, id ASC")
    private List<ProfileGlossaryEntry> glossary =
            new ArrayList<>();

    protected TranslationProfile() {
    }

    public TranslationProfile(
            Long userId,
            String name,
            TranslationStyle style,
            int contextLines,
            boolean keepHonorifics,
            String customInstruction,
            boolean defaultProfile
    ) {
        this.userId = userId;
        this.name = name;
        this.style = style;
        this.contextLines = contextLines;
        this.keepHonorifics = keepHonorifics;
        this.customInstruction = customInstruction;
        this.defaultProfile = defaultProfile;

        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(
            String name,
            TranslationStyle style,
            int contextLines,
            boolean keepHonorifics,
            String customInstruction
    ) {
        this.name = name;
        this.style = style;
        this.contextLines = contextLines;
        this.keepHonorifics = keepHonorifics;
        this.customInstruction = customInstruction;
        this.updatedAt = Instant.now();
    }

    public void replaceCharacters(
            List<CharacterRuleRequest> requests
    ) {
        characters.clear();

        int order = 0;

        for (CharacterRuleRequest request : requests) {
            characters.add(
                    new ProfileCharacter(
                            this,
                            request.name().trim(),
                            String.join(
                                    "\n",
                                    request.aliases()
                            ),
                            request.rule().trim(),
                            order++
                    )
            );
        }

        this.updatedAt = Instant.now();
    }

    public void replaceGlossary(
            List<GlossaryEntryRequest> requests
    ) {
        glossary.clear();

        int order = 0;

        for (GlossaryEntryRequest request : requests) {
            glossary.add(
                    new ProfileGlossaryEntry(
                            this,
                            request.sourceLanguage(),
                            request.targetLanguage(),
                            request.source().trim(),
                            request.target().trim(),
                            normalizeOptional(
                                    request.note()
                            ),
                            order++
                    )
            );
        }

        this.updatedAt = Instant.now();
    }

    public void markDefault(boolean value) {
        this.defaultProfile = value;
        this.updatedAt = Instant.now();
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }

        String clean = value.trim();

        return clean.isBlank()
                ? null
                : clean;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public TranslationStyle getStyle() {
        return style;
    }

    public int getContextLines() {
        return contextLines;
    }

    public boolean isKeepHonorifics() {
        return keepHonorifics;
    }

    public String getCustomInstruction() {
        return customInstruction;
    }

    public boolean isDefaultProfile() {
        return defaultProfile;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public List<ProfileCharacter> getCharacters() {
        return characters;
    }

    public List<ProfileGlossaryEntry> getGlossary() {
        return glossary;
    }
}

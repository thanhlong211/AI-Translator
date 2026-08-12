package com.dangt.aitranslator.backend.profile;

import com.dangt.aitranslator.backend.translation.TranslationLanguage;
import jakarta.persistence.*;

@Entity
@Table(name = "profile_glossary")
public class ProfileGlossaryEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "profile_id", nullable = false)
    private TranslationProfile profile;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "source_language",
            nullable = false,
            length = 16
    )
    private TranslationLanguage sourceLanguage =
            TranslationLanguage.AUTO;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "target_language",
            nullable = false,
            length = 16
    )
    private TranslationLanguage targetLanguage =
            TranslationLanguage.VI;

    @Column(name = "source_term", nullable = false, length = 120)
    private String source;

    @Column(name = "target_term", nullable = false, length = 160)
    private String target;

    @Column(length = 500)
    private String note;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected ProfileGlossaryEntry() {
    }

    public ProfileGlossaryEntry(
            TranslationProfile profile,
            TranslationLanguage sourceLanguage,
            TranslationLanguage targetLanguage,
            String source,
            String target,
            String note,
            int sortOrder
    ) {
        this.profile = profile;
        this.sourceLanguage =
                sourceLanguage == null
                        ? TranslationLanguage.AUTO
                        : sourceLanguage;
        this.targetLanguage =
                targetLanguage == null
                        ? TranslationLanguage.VI
                        : targetLanguage;

        if (this.targetLanguage == TranslationLanguage.AUTO) {
            throw new IllegalArgumentException(
                    "Glossary targetLanguage không được là AUTO."
            );
        }

        this.source = source;
        this.target = target;
        this.note = note;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public TranslationLanguage getSourceLanguage() {
        return sourceLanguage;
    }

    public TranslationLanguage getTargetLanguage() {
        return targetLanguage;
    }

    public String getSource() {
        return source;
    }

    public String getTarget() {
        return target;
    }

    public String getNote() {
        return note;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    /**
     * AUTO ở glossary được xem là rule nguồn dùng chung/fallback.
     * Khi request source=AUTO, không thể biết trước ngôn ngữ OCR nên mọi
     * rule có đúng targetLanguage đều có thể được đưa vào prompt.
     */
    public boolean appliesTo(
            TranslationLanguage requestSource,
            TranslationLanguage requestTarget
    ) {
        TranslationLanguage resolvedSource =
                requestSource == null
                        ? TranslationLanguage.AUTO
                        : requestSource;

        TranslationLanguage resolvedTarget =
                requestTarget == null
                        ? TranslationLanguage.VI
                        : requestTarget;

        if (targetLanguage != resolvedTarget) {
            return false;
        }

        if (resolvedSource == TranslationLanguage.AUTO) {
            return true;
        }

        return sourceLanguage == TranslationLanguage.AUTO ||
                sourceLanguage == resolvedSource;
    }
}

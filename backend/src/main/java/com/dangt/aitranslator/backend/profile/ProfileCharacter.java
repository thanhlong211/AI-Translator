package com.dangt.aitranslator.backend.profile;

import jakarta.persistence.*;

@Entity
@Table(name = "profile_characters")
public class ProfileCharacter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "profile_id", nullable = false)
    private TranslationProfile profile;

    @Column(name = "character_name", nullable = false, length = 100)
    private String name;

    @Column(name = "aliases_text", columnDefinition = "TEXT")
    private String aliasesText;

    @Column(name = "rule_text", nullable = false, length = 1000)
    private String rule;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected ProfileCharacter() {
    }

    public ProfileCharacter(
            TranslationProfile profile,
            String name,
            String aliasesText,
            String rule,
            int sortOrder
    ) {
        this.profile = profile;
        this.name = name;
        this.aliasesText = aliasesText;
        this.rule = rule;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getAliasesText() {
        return aliasesText;
    }

    public String getRule() {
        return rule;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}

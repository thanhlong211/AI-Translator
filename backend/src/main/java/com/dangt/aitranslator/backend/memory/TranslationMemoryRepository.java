package com.dangt.aitranslator.backend.memory;

import com.dangt.aitranslator.backend.translation.TranslationLanguage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface TranslationMemoryRepository
        extends JpaRepository<TranslationMemory, Long> {

    Optional<TranslationMemory>
    findByUserIdAndProfileIdAndSourceLanguageAndTargetLanguageAndSourceHash(
            Long userId,
            Long profileId,
            TranslationLanguage sourceLanguage,
            TranslationLanguage targetLanguage,
            String sourceHash
    );

    Optional<TranslationMemory>
    findByIdAndUserId(
            Long id,
            Long userId
    );

    long countByUserId(
            Long userId
    );

    long countByUserIdAndHitCountGreaterThan(
            Long userId,
            long hitCount
    );

    @Query("""
            select coalesce(sum(memory.hitCount), 0)
            from TranslationMemory memory
            where memory.userId = :userId
            """)
    long sumHitCountByUserId(
            @Param("userId")
            Long userId
    );

    @Query("""
            select memory
            from TranslationMemory memory
            where memory.userId = :userId
              and (
                    :profileId is null
                    or memory.profileId = :profileId
              )
              and (
                    :sourceLanguage is null
                    or memory.sourceLanguage = :sourceLanguage
              )
              and (
                    :targetLanguage is null
                    or memory.targetLanguage = :targetLanguage
              )
              and (
                    :queryText is null
                    or lower(memory.sourceText)
                        like lower(concat('%', :queryText, '%'))
                    or lower(memory.correctedTranslation)
                        like lower(concat('%', :queryText, '%'))
              )
            order by memory.updatedAt desc, memory.id desc
            """)
    Page<TranslationMemory> search(
            @Param("userId")
            Long userId,

            @Param("queryText")
            String queryText,

            @Param("profileId")
            Long profileId,

            @Param("sourceLanguage")
            TranslationLanguage sourceLanguage,

            @Param("targetLanguage")
            TranslationLanguage targetLanguage,

            Pageable pageable
    );
}

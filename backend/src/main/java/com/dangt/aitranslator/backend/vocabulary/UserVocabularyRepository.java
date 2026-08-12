package com.dangt.aitranslator.backend.vocabulary;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UserVocabularyRepository
        extends JpaRepository<UserVocabulary, Long> {

    Optional<UserVocabulary>
    findByIdAndUserId(
            Long id,
            Long userId
    );

    Optional<UserVocabulary>
    findByUserIdAndDictionaryFormAndReading(
            Long userId,
            String dictionaryForm,
            String reading
    );

    long countByUserId(
            Long userId
    );

    long countByUserIdAndStatus(
            Long userId,
            VocabularyStatus status
    );

    long countByUserIdAndFavoriteTrue(
            Long userId
    );

    List<UserVocabulary>
    findTop100ByUserIdAndDueAtLessThanEqualOrderByDueAtAsc(
            Long userId,
            Instant dueAt
    );

    long countByUserIdAndDueAtLessThanEqual(
            Long userId,
            Instant dueAt
    );


    List<UserVocabulary>
    findTop500ByUserIdOrderByLastSeenAtDesc(
            Long userId
    );

    @Query("""
            select vocabulary
            from UserVocabulary vocabulary
            where vocabulary.userId = :userId
              and (
                    :status is null
                    or vocabulary.status = :status
              )
              and (
                    :favorite is null
                    or vocabulary.favorite = :favorite
              )
              and (
                    :queryText is null
                    or lower(vocabulary.surface)
                        like lower(concat('%', :queryText, '%'))
                    or lower(vocabulary.dictionaryForm)
                        like lower(concat('%', :queryText, '%'))
                    or lower(vocabulary.reading)
                        like lower(concat('%', :queryText, '%'))
                    or lower(coalesce(vocabulary.romaji, ''))
                        like lower(concat('%', :queryText, '%'))
                    or lower(coalesce(vocabulary.meaning, ''))
                        like lower(concat('%', :queryText, '%'))
              )
            order by vocabulary.lastSeenAt desc, vocabulary.id desc
            """)
    Page<UserVocabulary> search(
            @Param("userId")
            Long userId,

            @Param("queryText")
            String queryText,

            @Param("status")
            VocabularyStatus status,

            @Param("favorite")
            Boolean favorite,

            Pageable pageable
    );
}

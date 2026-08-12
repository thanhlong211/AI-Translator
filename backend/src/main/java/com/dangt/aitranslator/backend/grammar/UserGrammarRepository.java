package com.dangt.aitranslator.backend.grammar;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UserGrammarRepository
        extends JpaRepository<UserGrammar, Long> {

    Optional<UserGrammar>
    findByIdAndUserId(
            Long id,
            Long userId
    );

    Optional<UserGrammar>
    findByUserIdAndPattern(
            Long userId,
            String pattern
    );

    long countByUserId(
            Long userId
    );

    long countByUserIdAndStatus(
            Long userId,
            GrammarStatus status
    );

    long countByUserIdAndFavoriteTrue(
            Long userId
    );

    List<UserGrammar>
    findTop100ByUserIdAndDueAtLessThanEqualOrderByDueAtAsc(
            Long userId,
            Instant dueAt
    );

    long countByUserIdAndDueAtLessThanEqual(
            Long userId,
            Instant dueAt
    );


    List<UserGrammar>
    findTop500ByUserIdOrderByLastSeenAtDesc(
            Long userId
    );

    @Query("""
            select grammar
            from UserGrammar grammar
            where grammar.userId = :userId
              and (
                    :status is null
                    or grammar.status = :status
              )
              and (
                    :favorite is null
                    or grammar.favorite = :favorite
              )
              and (
                    :queryText is null
                    or lower(grammar.pattern)
                        like lower(concat('%', :queryText, '%'))
                    or lower(coalesce(grammar.meaning, ''))
                        like lower(concat('%', :queryText, '%'))
                    or lower(coalesce(grammar.explanation, ''))
                        like lower(concat('%', :queryText, '%'))
              )
            order by grammar.lastSeenAt desc, grammar.id desc
            """)
    Page<UserGrammar> search(
            @Param("userId")
            Long userId,

            @Param("queryText")
            String queryText,

            @Param("status")
            GrammarStatus status,

            @Param("favorite")
            Boolean favorite,

            Pageable pageable
    );
}

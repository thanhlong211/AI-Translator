package com.dangt.aitranslator.backend.grammar;

import com.dangt.aitranslator.backend.study.StudyGrammarPoint;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class GrammarService {

    private final UserGrammarRepository repository;

    public GrammarService(
            UserGrammarRepository repository
    ) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public GrammarPageResponse search(
            Long userId,
            String query,
            GrammarStatus status,
            Boolean favorite,
            int page,
            int size
    ) {
        int safePage = Math.max(0, page);

        int safeSize =
                Math.max(
                        1,
                        Math.min(
                                100,
                                size
                        )
                );

        Pageable pageable =
                PageRequest.of(
                        safePage,
                        safeSize
                );

        Page<UserGrammar> result =
                repository.search(
                        userId,
                        normalizeQuery(query),
                        status,
                        favorite,
                        pageable
                );

        return GrammarPageResponse.from(
                result
        );
    }

    @Transactional(readOnly = true)
    public GrammarStatsResponse stats(
            Long userId
    ) {
        return new GrammarStatsResponse(
                repository.countByUserId(
                        userId
                ),
                repository.countByUserIdAndStatus(
                        userId,
                        GrammarStatus.NEW
                ),
                repository.countByUserIdAndStatus(
                        userId,
                        GrammarStatus.LEARNING
                ),
                repository.countByUserIdAndStatus(
                        userId,
                        GrammarStatus.KNOWN
                ),
                repository.countByUserIdAndFavoriteTrue(
                        userId
                )
        );
    }

    @Transactional
    public GrammarResponse save(
            Long userId,
            GrammarSaveRequest request
    ) {
        UpsertResult result =
                upsertOne(
                        userId,
                        request.toStudyPoint(),
                        request.recordEncounter()
                );

        return GrammarResponse.from(
                result.grammar()
        );
    }

    @Transactional
    public GrammarResponse update(
            Long userId,
            Long grammarId,
            GrammarUpdateRequest request
    ) {
        UserGrammar grammar =
                requireOwned(
                        userId,
                        grammarId
                );

        grammar.updateLearningState(
                request.status(),
                request.favorite(),
                request.personalNote()
        );

        return GrammarResponse.from(
                repository.saveAndFlush(
                        grammar
                )
        );
    }

    @Transactional
    public void delete(
            Long userId,
            Long grammarId
    ) {
        repository.delete(
                requireOwned(
                        userId,
                        grammarId
                )
        );
    }

    @Transactional
    public GrammarSyncSummary recordStudyGrammar(
            Long userId,
            List<StudyGrammarPoint> items
    ) {
        if (
                items == null ||
                items.isEmpty()
        ) {
            return new GrammarSyncSummary(
                    true,
                    0,
                    0,
                    0
            );
        }

        int inserted = 0;
        int updated = 0;
        int skipped = 0;

        Set<String> seenPatterns =
                new HashSet<>();

        for (
                StudyGrammarPoint item
                : items
        ) {
            if (
                    item == null ||
                    clean(item.pattern()).isBlank()
            ) {
                skipped += 1;
                continue;
            }

            String key =
                    clean(
                            item.pattern()
                    ).toLowerCase();

            if (!seenPatterns.add(key)) {
                skipped += 1;
                continue;
            }

            UpsertResult result =
                    upsertOne(
                            userId,
                            item,
                            true
                    );

            if (result.inserted()) {
                inserted += 1;
            } else {
                updated += 1;
            }
        }

        return new GrammarSyncSummary(
                true,
                inserted,
                updated,
                skipped
        );
    }

    private UpsertResult upsertOne(
            Long userId,
            StudyGrammarPoint item,
            boolean recordEncounter
    ) {
        String pattern =
                clean(
                        item.pattern()
                );

        if (pattern.isBlank()) {
            throw new IllegalArgumentException(
                    "Grammar pattern không được để trống."
            );
        }

        UserGrammar existing =
                repository
                        .findByUserIdAndPattern(
                                userId,
                                pattern
                        )
                        .orElse(null);

        if (existing == null) {
            UserGrammar created =
                    new UserGrammar(
                            userId,
                            normalizedPoint(
                                    item
                            )
                    );

            return new UpsertResult(
                    repository.saveAndFlush(
                            created
                    ),
                    true
            );
        }

        StudyGrammarPoint normalized =
                normalizedPoint(
                        item
                );

        if (recordEncounter) {
            existing.recordEncounter(
                    normalized
            );
        } else {
            existing.mergeStudyData(
                    normalized
            );
        }

        return new UpsertResult(
                repository.saveAndFlush(
                        existing
                ),
                false
        );
    }

    private UserGrammar requireOwned(
            Long userId,
            Long grammarId
    ) {
        if (
                grammarId == null ||
                grammarId <= 0
        ) {
            throw new IllegalArgumentException(
                    "Grammar ID không hợp lệ."
            );
        }

        return repository
                .findByIdAndUserId(
                        grammarId,
                        userId
                )
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Không tìm thấy cấu trúc/ngữ pháp."
                        )
                );
    }

    private StudyGrammarPoint normalizedPoint(
            StudyGrammarPoint item
    ) {
        return new StudyGrammarPoint(
                clean(item.pattern()),
                normalizeJlpt(
                        item.jlptLevel()
                ),
                clean(item.meaning()),
                "",
                clean(item.explanation())
        );
    }

    private String normalizeJlpt(
            String value
    ) {
        String normalized =
                clean(value).toUpperCase();

        return switch (normalized) {
            case "N5", "N4", "N3", "N2", "N1" ->
                    normalized;
            default ->
                    "UNKNOWN";
        };
    }

    private String normalizeQuery(
            String value
    ) {
        String clean =
                clean(value);

        return clean.isBlank()
                ? null
                : clean;
    }

    private String clean(
            String value
    ) {
        return value == null
                ? ""
                : value.trim();
    }

    private record UpsertResult(
            UserGrammar grammar,
            boolean inserted
    ) {
    }
}

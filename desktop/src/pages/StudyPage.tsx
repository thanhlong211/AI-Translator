import {
    useEffect,
    useState
} from "react";

import type {
    AuthStatus,
    BackendStatus,
    StudyGrammarPoint,
    StudyLevel,
    StudyState,
    StudyVocabularyItem,
    TranslationProfile
} from "../app/types";

import { Icon } from "../components/Icon";

interface StudyPageProps {
    backend: BackendStatus;
    auth: AuthStatus;
    profiles: TranslationProfile[];
    activeProfile: TranslationProfile | null;
    profileDirty: boolean;
    study: StudyState;
    studyLevel: StudyLevel;
    autoSaveVocabulary: boolean;
    autoSaveGrammar: boolean;
    shortcutDisplay: string;
    onStudyLevelChange:
        (level: StudyLevel) => void;
    onAutoSaveVocabularyChange:
        (value: boolean) => void;
    onAutoSaveGrammarChange:
        (value: boolean) => void;
    onSelectProfile:
        (profileId: number) => void;
    onScan: () => void;
    onClearResult: () => void;
    onSaveVocabulary:
        (
            item:
                StudyVocabularyItem
        ) => Promise<void>;
    onSaveGrammar:
        (
            item:
                StudyGrammarPoint
        ) => Promise<void>;
}

type StudyTab =
    | "structure"
    | "grammar"
    | "vocabulary";

const studyLevels:
    StudyLevel[] = [
        "AUTO",
        "N5",
        "N4",
        "N3",
        "N2",
        "N1"
    ];

function JlptBadge({
    level
}: {
    level: string;
}) {
    const normalized =
        level || "UNKNOWN";

    return (
        <span
            className={
                normalized === "UNKNOWN"
                    ? "jlpt-badge unknown"
                    : "jlpt-badge"
            }
        >
            {normalized}
        </span>
    );
}

function wordKey(
    word:
        StudyVocabularyItem
) {
    return [
        word.dictionaryForm ||
        word.surface,
        word.reading
    ].join("::");
}

function formatMs(
    value?: number
) {
    if (
        value == null ||
        value <= 0
    ) {
        return "";
    }

    if (value < 1000) {
        return `${Math.round(value)}ms`;
    }

    return `${(
        value / 1000
    ).toFixed(1)}s`;
}

export function StudyPage({
    backend,
    auth,
    profiles,
    activeProfile,
    profileDirty,
    study,
    studyLevel,
    autoSaveVocabulary,
    autoSaveGrammar,
    shortcutDisplay,
    onStudyLevelChange,
    onAutoSaveVocabularyChange,
    onAutoSaveGrammarChange,
    onSelectProfile,
    onScan,
    onClearResult,
    onSaveVocabulary,
    onSaveGrammar
}: StudyPageProps) {
    const [
        activeTab,
        setActiveTab
    ] = useState<StudyTab>(
        "structure"
    );

    const [
        savingWordKey,
        setSavingWordKey
    ] = useState("");

    const [
        savedWordKeys,
        setSavedWordKeys
    ] = useState<
        Set<string>
    >(
        new Set()
    );


    const [
        savingGrammarKey,
        setSavingGrammarKey
    ] = useState("");

    const [
        savedGrammarKeys,
        setSavedGrammarKeys
    ] = useState<
        Set<string>
    >(
        new Set()
    );

    const analysis =
        study.result?.analysis ??
        null;

    const fast =
        study.fastTranslation;

    const sync =
        study.result
            ?.vocabularySync;

    const grammarSync =
        study.result
            ?.grammarSync;

    const performance =
        study.result
            ?.performance;

    const displayOriginal =
        analysis?.original ||
        fast?.original ||
        "";

    const displayTranslation =
        analysis?.translation ||
        fast?.vietnamese ||
        "";

    const hasSentence =
        Boolean(
            analysis ||
            fast
        );

    const canScan =
        backend.connected &&
        auth.authenticated &&
        Boolean(activeProfile) &&
        !profileDirty &&
        !study.isScanning;

    useEffect(() => {
        setSavedWordKeys(
            new Set()
        );

        setSavingWordKey("");

        setSavedGrammarKeys(
            new Set()
        );

        setSavingGrammarKey("");
    }, [
        study.activeScanId
    ]);

    async function saveWord(
        word:
            StudyVocabularyItem
    ) {
        const key =
            wordKey(word);

        try {
            setSavingWordKey(
                key
            );

            await onSaveVocabulary(
                word
            );

            setSavedWordKeys(
                (current) => {
                    const next =
                        new Set(
                            current
                        );

                    next.add(key);

                    return next;
                }
            );
        } finally {
            setSavingWordKey(
                ""
            );
        }
    }


    async function saveGrammarPoint(
        grammar:
            StudyGrammarPoint
    ) {
        const key =
            grammar.pattern;

        try {
            setSavingGrammarKey(
                key
            );

            await onSaveGrammar(
                grammar
            );

            setSavedGrammarKeys(
                (current) => {
                    const next =
                        new Set(
                            current
                        );

                    next.add(key);

                    return next;
                }
            );
        } finally {
            setSavingGrammarKey(
                ""
            );
        }
    }

    return (
        <div className="page-stack study-page">
            <section className="study-hero study-hero-v63">
                <div>
                    <span className="eyebrow violet">
                        STUDY MODE
                    </span>

                    <h2>
                        Bản dịch hiện trước,
                        phân tích học tập hoàn tất sau
                    </h2>

                    <p>
                        Fast Translate chạy song song với Study Analyzer.
                        Bạn có thể đọc bản dịch và quét câu tiếp theo
                        mà không phải chờ toàn bộ grammar/vocabulary.
                    </p>
                </div>

                <button
                    className="study-scan"
                    onClick={onScan}
                    disabled={!canScan}
                >
                    <Icon
                        name="scan"
                    />

                    {study.isScanning
                        ? "Đang chọn vùng..."
                        : study.isAnalyzing
                            ? "Quét câu tiếp"
                            : "Quét câu để học"}

                    <kbd>
                        {shortcutDisplay}
                    </kbd>
                </button>
            </section>

            <section className="study-toolbar-card study-toolbar-v64">
                <label className="control-field">
                    <span>
                        Translation Profile
                    </span>

                    <select
                        value={
                            activeProfile?.id ??
                            ""
                        }
                        onChange={(event) => {
                            onSelectProfile(
                                Number(
                                    event.target.value
                                )
                            );
                        }}
                        disabled={
                            !profiles.length
                        }
                    >
                        {profiles.map(
                            (profile) => (
                                <option
                                    key={profile.id}
                                    value={profile.id}
                                >
                                    {profile.name}
                                    {profile.defaultProfile
                                        ? " · Default"
                                        : ""}
                                </option>
                            )
                        )}
                    </select>
                </label>

                <label className="control-field">
                    <span>
                        Trình độ giải thích
                    </span>

                    <select
                        value={studyLevel}
                        onChange={(event) => {
                            onStudyLevelChange(
                                event.target
                                    .value as StudyLevel
                            );
                        }}
                    >
                        {studyLevels.map(
                            (level) => (
                                <option
                                    key={level}
                                    value={level}
                                >
                                    {level === "AUTO"
                                        ? "AUTO · Tự điều chỉnh"
                                        : level}
                                </option>
                            )
                        )}
                    </select>
                </label>

                <label className="study-autosave-toggle">
                    <input
                        type="checkbox"
                        checked={
                            autoSaveVocabulary
                        }
                        onChange={(event) => {
                            onAutoSaveVocabularyChange(
                                event.target.checked
                            );
                        }}
                    />

                    <span>
                        <strong>
                            Tự động lưu từ mới
                        </strong>

                        <small>
                            Chỉ vocabulary item,
                            không lưu cả câu.
                        </small>
                    </span>
                </label>

                <label className="study-autosave-toggle grammar-save-toggle">
                    <input
                        type="checkbox"
                        checked={
                            autoSaveGrammar
                        }
                        onChange={(event) => {
                            onAutoSaveGrammarChange(
                                event.target.checked
                            );
                        }}
                    />

                    <span>
                        <strong>
                            Tự động lưu ngữ pháp
                        </strong>

                        <small>
                            Chỉ lưu pattern + giải thích,
                            không lưu cả câu truyện.
                        </small>
                    </span>
                </label>

                <div className="study-toolbar-info">
                    <span>
                        Context:
                        {" "}
                        {activeProfile?.contextLines ?? 0}
                    </span>

                    <span>
                        Glossary:
                        {" "}
                        {activeProfile?.glossary.length ?? 0}
                    </span>

                    <span>
                        Characters:
                        {" "}
                        {activeProfile?.characters.length ?? 0}
                    </span>
                </div>
            </section>

            {profileDirty && (
                <div className="notice warning">
                    Profile đang có thay đổi chưa lưu.
                    Hãy lưu trước khi quét.
                </div>
            )}

            {!auth.authenticated && (
                <div className="notice warning">
                    Bạn cần đăng nhập trước khi sử dụng Study Mode.
                </div>
            )}

            {!backend.connected && (
                <div className="notice danger">
                    Java backend hiện không kết nối được.
                </div>
            )}

            {sync?.autoSaved && (
                <div className="notice success-notice">
                    Vocabulary Auto-save:
                    {" "}
                    <strong>
                        {sync.inserted}
                    </strong>
                    {" "}từ mới,
                    {" "}
                    <strong>
                        {sync.updated}
                    </strong>
                    {" "}từ được cập nhật
                    {sync.skipped > 0
                        ? `, bỏ qua ${sync.skipped}`
                        : ""}.
                </div>
            )}


            {grammarSync?.autoSaved && (
                <div className="notice success-notice">
                    Grammar Auto-save:
                    {" "}
                    <strong>
                        {grammarSync.inserted}
                    </strong>
                    {" "}cấu trúc mới,
                    {" "}
                    <strong>
                        {grammarSync.updated}
                    </strong>
                    {" "}cấu trúc được cập nhật
                    {grammarSync.skipped > 0
                        ? `, bỏ qua ${grammarSync.skipped}`
                        : ""}.
                </div>
            )}

            {!hasSentence ? (
                <section className="study-empty-state">
                    <div className="study-empty-mark">
                        学
                    </div>

                    <div>
                        <h3>
                            Chưa có câu đang học
                        </h3>

                        <p>
                            {shortcutDisplay} để Study.
                            Bản dịch nhanh sẽ hiện trước;
                            cấu trúc/ngữ pháp/từ vựng cập nhật sau.
                        </p>
                    </div>

                    <div className="study-empty-preview">
                        <div>
                            <span>1</span>
                            <strong>OCR</strong>
                            <small>
                                nhận diện câu
                            </small>
                        </div>

                        <div className="flow-arrow">
                            →
                        </div>

                        <div>
                            <span>2</span>
                            <strong>Fast Translate</strong>
                            <small>
                                hiện overlay trước
                            </small>
                        </div>

                        <div className="flow-arrow">
                            →
                        </div>

                        <div>
                            <span>3</span>
                            <strong>Study AI</strong>
                            <small>
                                hoàn thiện background
                            </small>
                        </div>
                    </div>
                </section>
            ) : (
                <>
                    <section className="study-sentence-card study-result-card">
                        <div className="card-heading">
                            <div>
                                <span className="eyebrow">
                                    CURRENT SENTENCE
                                </span>

                                <h3>
                                    Câu đang học
                                </h3>
                            </div>

                            <div className="study-result-meta">
                                {(
                                    study.result
                                        ?.profile
                                        .name ||
                                    fast
                                        ?.profileName
                                ) && (
                                    <span className="coming-chip live">
                                        {
                                            study.result
                                                ?.profile
                                                .name ||
                                            fast
                                                ?.profileName
                                        }
                                    </span>
                                )}

                                <span className="coming-chip">
                                    {
                                        study.result
                                            ?.studyLevel ||
                                        studyLevel
                                    }
                                </span>

                                {fast?.visibleMs ? (
                                    <span className="performance-chip fast">
                                        Dịch:
                                        {" "}
                                        {
                                            formatMs(
                                                fast.visibleMs
                                            )
                                        }
                                    </span>
                                ) : null}

                                {performance?.totalMs ? (
                                    <span className="performance-chip">
                                        Study:
                                        {" "}
                                        {
                                            formatMs(
                                                performance.totalMs
                                            )
                                        }
                                    </span>
                                ) : null}

                                <button
                                    className="text-action"
                                    onClick={
                                        onClearResult
                                    }
                                >
                                    Xóa
                                </button>
                            </div>
                        </div>

                        <div className="study-source-block">
                            <div className="study-japanese">
                                {displayOriginal}
                            </div>

                            {analysis?.reading && (
                                <div className="study-reading">
                                    {
                                        analysis.reading
                                    }
                                </div>
                            )}

                            {analysis?.romaji && (
                                <div className="study-romaji">
                                    {
                                        analysis.romaji
                                    }
                                </div>
                            )}
                        </div>

                        <div className="study-translation-block">
                            <span>
                                TIẾNG VIỆT
                            </span>

                            <p>
                                {
                                    displayTranslation
                                }
                            </p>
                        </div>

                        {analysis?.sentenceSummary && (
                            <div className="sentence-summary">
                                <strong>
                                    Ý chính
                                </strong>

                                <span>
                                    {
                                        analysis
                                            .sentenceSummary
                                    }
                                </span>
                            </div>
                        )}
                    </section>

                    {!analysis &&
                        study.isAnalyzing && (
                        <section className="study-background-card">
                            <div className="background-pulse">
                                <span />
                            </div>

                            <div>
                                <strong>
                                    Bản dịch đã sẵn sàng
                                </strong>

                                <p>
                                    AI đang phân tích Hiragana,
                                    cấu trúc, ngữ pháp và từ vựng ở background.
                                    Bạn có thể quét câu tiếp theo ngay.
                                </p>
                            </div>
                        </section>
                    )}

                    {analysis && (
                        <section className="study-analysis-card">
                            <div className="study-tabs">
                                <button
                                    className={
                                        activeTab ===
                                        "structure"
                                            ? "study-tab active"
                                            : "study-tab"
                                    }
                                    onClick={() => {
                                        setActiveTab(
                                            "structure"
                                        );
                                    }}
                                >
                                    Cấu trúc
                                    <span>
                                        {
                                            analysis
                                                .sentenceParts
                                                .length
                                        }
                                    </span>
                                </button>

                                <button
                                    className={
                                        activeTab ===
                                        "grammar"
                                            ? "study-tab active"
                                            : "study-tab"
                                    }
                                    onClick={() => {
                                        setActiveTab(
                                            "grammar"
                                        );
                                    }}
                                >
                                    Ngữ pháp
                                    <span>
                                        {
                                            analysis
                                                .grammar
                                                .length
                                        }
                                    </span>
                                </button>

                                <button
                                    className={
                                        activeTab ===
                                        "vocabulary"
                                            ? "study-tab active"
                                            : "study-tab"
                                    }
                                    onClick={() => {
                                        setActiveTab(
                                            "vocabulary"
                                        );
                                    }}
                                >
                                    Từ vựng
                                    <span>
                                        {
                                            analysis
                                                .vocabulary
                                                .length
                                        }
                                    </span>
                                </button>
                            </div>

                            <div className="study-tab-content">
                                {activeTab ===
                                    "structure" && (
                                    <div className="sentence-parts-list">
                                        {analysis
                                            .sentenceParts
                                            .map(
                                                (
                                                    part,
                                                    index
                                                ) => (
                                                    <article
                                                        className="sentence-part-row"
                                                        key={`${part.text}-${index}`}
                                                    >
                                                        <div className="sentence-part-index">
                                                            {
                                                                index +
                                                                1
                                                            }
                                                        </div>

                                                        <div className="sentence-part-main">
                                                            <div className="sentence-part-title">
                                                                <strong>
                                                                    {
                                                                        part.text
                                                                    }
                                                                </strong>

                                                                <span>
                                                                    {
                                                                        part.reading
                                                                    }
                                                                </span>

                                                                <small>
                                                                    {
                                                                        part.romaji
                                                                    }
                                                                </small>
                                                            </div>

                                                            <div className="sentence-part-tags">
                                                                {part.role && (
                                                                    <span>
                                                                        {
                                                                            part.role
                                                                        }
                                                                    </span>
                                                                )}

                                                                {part.meaning && (
                                                                    <span>
                                                                        {
                                                                            part.meaning
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {part.explanation && (
                                                                <p>
                                                                    {
                                                                        part.explanation
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>
                                                    </article>
                                                )
                                            )}

                                        {!analysis
                                            .sentenceParts
                                            .length && (
                                            <div className="empty-inline">
                                                Không có thêm cấu trúc cần tách.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab ===
                                    "grammar" && (
                                    <div className="grammar-grid">
                                        {analysis.grammar.map(
                                            (
                                                grammar,
                                                index
                                            ) => {
                                                const key =
                                                    grammar.pattern;

                                                const manuallySaved =
                                                    savedGrammarKeys
                                                        .has(
                                                            key
                                                        );

                                                const alreadySaved =
                                                    autoSaveGrammar ||
                                                    manuallySaved;

                                                return (
                                                    <article
                                                        className="grammar-card"
                                                        key={`${grammar.pattern}-${index}`}
                                                    >
                                                        <div className="grammar-card-top">
                                                            <div>
                                                                <strong>
                                                                    {
                                                                        grammar.pattern
                                                                    }
                                                                </strong>

                                                                <span>
                                                                    {
                                                                        grammar.matchedText
                                                                    }
                                                                </span>
                                                            </div>

                                                            <div className="grammar-card-actions">
                                                                <JlptBadge
                                                                    level={
                                                                        grammar.jlptLevel
                                                                    }
                                                                />

                                                                <button
                                                                    className={
                                                                        alreadySaved
                                                                            ? "vocab-save-placeholder saved"
                                                                            : "vocab-save-placeholder"
                                                                    }
                                                                    disabled={
                                                                        alreadySaved ||
                                                                        savingGrammarKey ===
                                                                            key
                                                                    }
                                                                    onClick={() => {
                                                                        void saveGrammarPoint(
                                                                            grammar
                                                                        );
                                                                    }}
                                                                >
                                                                    {savingGrammarKey ===
                                                                    key
                                                                        ? "Đang lưu..."
                                                                        : alreadySaved
                                                                            ? "✓ Đã lưu"
                                                                            : "+ Lưu"}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="grammar-meaning">
                                                            {
                                                                grammar.meaning
                                                            }
                                                        </div>

                                                        <p>
                                                            {
                                                                grammar.explanation
                                                            }
                                                        </p>
                                                    </article>
                                                );
                                            }
                                        )}

                                        {!analysis
                                            .grammar
                                            .length && (
                                            <div className="empty-inline">
                                                Không phát hiện grammar nổi bật.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab ===
                                    "vocabulary" && (
                                    <div className="study-vocab-list">
                                        {analysis.vocabulary.map(
                                            (
                                                word,
                                                index
                                            ) => {
                                                const key =
                                                    wordKey(
                                                        word
                                                    );

                                                const manuallySaved =
                                                    savedWordKeys
                                                        .has(
                                                            key
                                                        );

                                                const alreadySaved =
                                                    autoSaveVocabulary ||
                                                    manuallySaved;

                                                return (
                                                    <article
                                                        className="study-vocab-row"
                                                        key={`${key}-${index}`}
                                                    >
                                                        <div className="vocab-word">
                                                            <strong>
                                                                {
                                                                    word.dictionaryForm ||
                                                                    word.surface
                                                                }
                                                            </strong>

                                                            {word.surface &&
                                                                word.surface !==
                                                                    word.dictionaryForm && (
                                                                <small>
                                                                    Trong câu:
                                                                    {" "}
                                                                    {
                                                                        word.surface
                                                                    }
                                                                </small>
                                                            )}
                                                        </div>

                                                        <div className="vocab-reading-column">
                                                            <span>
                                                                {
                                                                    word.reading
                                                                }
                                                            </span>

                                                            <small>
                                                                {
                                                                    word.romaji
                                                                }
                                                            </small>
                                                        </div>

                                                        <div className="vocab-meaning-column">
                                                            <strong>
                                                                {
                                                                    word.meaning
                                                                }
                                                            </strong>

                                                            <span>
                                                                {
                                                                    word.partOfSpeech
                                                                }
                                                            </span>
                                                        </div>

                                                        <JlptBadge
                                                            level={
                                                                word.jlptLevel
                                                            }
                                                        />

                                                        <button
                                                            className={
                                                                alreadySaved
                                                                    ? "vocab-save-placeholder saved"
                                                                    : "vocab-save-placeholder"
                                                            }
                                                            disabled={
                                                                alreadySaved ||
                                                                savingWordKey ===
                                                                    key
                                                            }
                                                            onClick={() => {
                                                                void saveWord(
                                                                    word
                                                                );
                                                            }}
                                                        >
                                                            {savingWordKey ===
                                                            key
                                                                ? "Đang lưu..."
                                                                : alreadySaved
                                                                    ? "✓ Đã lưu"
                                                                    : "+ Lưu"}
                                                        </button>

                                                        {word.note && (
                                                            <p className="vocab-note">
                                                                {
                                                                    word.note
                                                                }
                                                            </p>
                                                        )}
                                                    </article>
                                                );
                                            }
                                        )}

                                        {!analysis
                                            .vocabulary
                                            .length && (
                                            <div className="empty-inline">
                                                Không có vocabulary cần tách.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {analysis &&
                        analysis.notes.length > 0 && (
                        <section className="study-notes-card">
                            <span className="eyebrow">
                                STUDY NOTES
                            </span>

                            <ul>
                                {analysis.notes.map(
                                    (
                                        note,
                                        index
                                    ) => (
                                        <li
                                            key={`${note}-${index}`}
                                        >
                                            {note}
                                        </li>
                                    )
                                )}
                            </ul>
                        </section>
                    )}
                </>
            )}

            <div className="page-status">
                <span
                    className={
                        study.isAnalyzing
                            ? "status-indicator analyzing"
                            : study.status
                                .startsWith(
                                    "Phân tích hoàn thành"
                                )
                                ? "status-indicator success"
                                : "status-indicator"
                    }
                />

                {study.status}
            </div>
        </div>
    );
}

import { GrammarStudyDetails } from "../components/GrammarStudyDetails";
import {
    useEffect,
    useState
} from "react";

import type {
    AuthStatus,
    BackendStatus,
    StudyGrammarPoint,
    StudyLanguage,
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
    studyLanguage: StudyLanguage;
    studyLevel: StudyLevel;

    autoSaveVocabulary: boolean;
    autoSaveGrammar: boolean;
    shortcutDisplay: string;

    onStudyLanguageChange:
        (language: StudyLanguage) => void;

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
            item: StudyVocabularyItem
        ) => Promise<void>;

    onSaveGrammar:
        (
            item: StudyGrammarPoint
        ) => Promise<void>;
}


type StudyTab =
    | "structure"
    | "grammar"
    | "vocabulary"
    | "collocations"
    | "mistakes";


const JAPANESE_LEVELS:
    StudyLevel[] = [
        "AUTO",
        "N5",
        "N4",
        "N3",
        "N2",
        "N1"
    ];


const ENGLISH_LEVELS:
    StudyLevel[] = [
        "AUTO",
        "A1",
        "A2",
        "B1",
        "B2",
        "C1",
        "C2"
    ];


function LevelBadge({
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
    word: StudyVocabularyItem
) {
    return [
        word.dictionaryForm ||
        word.surface,
        word.reading
    ].join("::");
}


export function StudyPage({
    backend,
    auth,
    profiles,
    activeProfile,
    profileDirty,
    study,
    studyLanguage,
    studyLevel,
    autoSaveVocabulary,
    autoSaveGrammar,
    shortcutDisplay,
    onStudyLanguageChange,
    onStudyLevelChange,
    onAutoSaveVocabularyChange,
    onAutoSaveGrammarChange,
    onSelectProfile,
    onScan,
    onClearResult,
    onSaveVocabulary,
    onSaveGrammar
}: StudyPageProps) {
    const isEnglish =
        studyLanguage === "EN";

    const studyLevels =
        isEnglish
            ? ENGLISH_LEVELS
            : JAPANESE_LEVELS;

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
    ] = useState<Set<string>>(
        new Set()
    );

    const [
        savingGrammarKey,
        setSavingGrammarKey
    ] = useState("");

    const [
        savedGrammarKeys,
        setSavedGrammarKeys
    ] = useState<Set<string>>(
        new Set()
    );

    const analysis =
        study.result?.analysis ??
        null;

    const fast =
        study.fastTranslation;

    const sync =
        study.result?.vocabularySync;

    const grammarSync =
        study.result?.grammarSync;

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

    const grammarCount =
        isEnglish
            ? analysis
                ?.englishGrammar
                ?.length ?? 0
            : analysis
                ?.grammar
                ?.length ?? 0;

    const vocabularyCount =
        isEnglish
            ? analysis
                ?.englishVocabulary
                ?.length ?? 0
            : analysis
                ?.vocabulary
                ?.length ?? 0;

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
        word: StudyVocabularyItem
    ) {
        const key =
            wordKey(word);

        try {
            setSavingWordKey(key);

            await onSaveVocabulary(
                word
            );

            setSavedWordKeys(
                (current) => {
                    const next =
                        new Set(current);

                    next.add(key);

                    return next;
                }
            );
        } finally {
            setSavingWordKey("");
        }
    }


    async function saveGrammarPoint(
        grammar: StudyGrammarPoint
    ) {
        const key =
            grammar.pattern;

        try {
            setSavingGrammarKey(key);

            await onSaveGrammar(
                grammar
            );

            setSavedGrammarKeys(
                (current) => {
                    const next =
                        new Set(current);

                    next.add(key);

                    return next;
                }
            );
        } finally {
            setSavingGrammarKey("");
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
                        {isEnglish
                            ? "English Study · IPA, CEFR và phân tích ngữ pháp"
                            : "Japanese Study · Reading, JLPT và phân tích ngữ pháp"}
                    </h2>

                    <p>
                        {isEnglish
                            ? "Dịch nhanh rồi phân tích IPA, CEFR, từ vựng, collocation và lỗi thường gặp."
                            : "Dịch nhanh rồi phân tích cách đọc, cấu trúc, từ vựng và ngữ pháp."}
                    </p>
                </div>

                <button
                    className="study-scan"
                    onClick={onScan}
                    disabled={!canScan}
                >
                    <Icon name="scan" />

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
                        Ngôn ngữ học
                    </span>

                    <select
                        value={studyLanguage}
                        onChange={(event) => {
                            const next =
                                event.target
                                    .value as
                                    StudyLanguage;

                            if (
                                next !==
                                studyLanguage
                            ) {
                                onClearResult();

                                setActiveTab(
                                    "structure"
                                );

                                onStudyLanguageChange(
                                    next
                                );
                            }
                        }}
                    >
                        <option value="JA">
                            Japanese
                        </option>

                        <option value="EN">
                            English
                        </option>
                    </select>
                </label>


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
                        disabled={!profiles.length}
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
                        {isEnglish
                            ? "CEFR mục tiêu"
                            : "JLPT / mức giải thích"}
                    </span>

                    <select
                        value={studyLevel}
                        onChange={(event) => {
                            onStudyLevelChange(
                                event.target
                                    .value as
                                    StudyLevel
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
                        checked={autoSaveVocabulary}
                        
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
                            {isEnglish
                                ? "English được lưu riêng theo ngôn ngữ."
                                : "Chỉ lưu từ vựng, không lưu cả câu."}
                        </small>
                    </span>
                </label>


                <label className="study-autosave-toggle grammar-save-toggle">
                    <input
                        type="checkbox"
                        checked={autoSaveGrammar}
                        
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
                            {isEnglish
                                ? "English sử dụng CEFR thay cho JLPT."
                                : "Chỉ lưu mẫu ngữ pháp và giải thích."}
                        </small>
                    </span>
                </label>


                <div className="study-toolbar-info">
                    <span>
                        Ngôn ngữ:
                        {" "}
                        <strong>
                            {studyLanguage}
                        </strong>
                    </span>

                    <span>
                        Ngữ cảnh:
                        {" "}
                        {activeProfile?.contextLines ?? 0}
                    </span>

                    <span>
                        Thuật ngữ:
                        {" "}
                        {activeProfile?.glossary.length ?? 0}
                    </span>
                </div>
            </section>


            {profileDirty && (
                <div className="notice warning">
                    Hồ sơ đang có thay đổi chưa lưu.
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
                    Dịch vụ tạm thời không khả dụng.
                </div>
            )}


            {!isEnglish &&
                sync?.autoSaved && (
                <div className="notice success-notice">
                    Từ vựng đã lưu:
                    {" "}
                    <strong>
                        {sync.inserted}
                    </strong>
                    {" "}từ mới,
                    {" "}
                    <strong>
                        {sync.updated}
                    </strong>
                    {" "}từ được cập nhật.
                </div>
            )}


            {!isEnglish &&
                grammarSync?.autoSaved && (
                <div className="notice success-notice">
                    Ngữ pháp đã lưu:
                    {" "}
                    <strong>
                        {grammarSync.inserted}
                    </strong>
                    {" "}cấu trúc mới,
                    {" "}
                    <strong>
                        {grammarSync.updated}
                    </strong>
                    {" "}cấu trúc được cập nhật.
                </div>
            )}


            {!hasSentence ? (
                <section className="study-empty-state">
                    <div className="study-empty-mark">
                        {isEnglish
                            ? "EN"
                            : "学"}
                    </div>

                    <div>
                        <h3>
                            Chưa có câu đang học
                        </h3>

                        <p>
                            {shortcutDisplay}
                            {" "}để Study.
                            Bản dịch nhanh sẽ hiện trước;
                            phân tích chi tiết cập nhật sau.
                        </p>
                    </div>

                    <div className="study-empty-preview">
                        <div>
                            <span>1</span>
                            <strong>1</strong>
                            <small>
                                Nhận diện câu
                            </small>
                        </div>

                        <div className="flow-arrow">
                            →
                        </div>

                        <div>
                            <span>2</span>
                            <strong>2</strong>
                            <small>
                                Hiện bản dịch
                            </small>
                        </div>

                        <div className="flow-arrow">
                            →
                        </div>

                        <div>
                            <span>3</span>
                            <strong>3</strong>
                            <small>
                                Phân tích học tập
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
                                <span className="coming-chip live">
                                    {isEnglish
                                        ? "English"
                                        : "Japanese"}
                                </span>

                                {study.result
                                    ?.profile
                                    ?.name && (
                                    <span className="coming-chip">
                                        {
                                            study.result
                                                .profile
                                                .name
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

                                <button
                                    className="text-action"
                                    onClick={onClearResult}
                                >
                                    Xóa
                                </button>
                            </div>
                        </div>


                        <div className="study-source-block">
                            <div className="study-japanese">
                                {displayOriginal}
                            </div>

                            {!isEnglish &&
                                analysis?.reading && (
                                <div className="study-reading">
                                    {analysis.reading}
                                </div>
                            )}

                            {!isEnglish &&
                                analysis?.romaji && (
                                <div className="study-romaji">
                                    {analysis.romaji}
                                </div>
                            )}

                            {isEnglish &&
                                analysis?.ipa && (
                                <div className="study-reading">
                                    /{analysis.ipa}/
                                </div>
                            )}

                            {isEnglish &&
                                analysis && (
                                <div className="study-romaji">
                                    CEFR:
                                    {" "}
                                    <strong>
                                        {
                                            analysis.cefrLevel ||
                                            "UNKNOWN"
                                        }
                                    </strong>
                                </div>
                            )}
                        </div>


                        <div className="study-translation-block">
                            <span>
                                TIẾNG VIỆT
                            </span>

                            <p>
                                {displayTranslation}
                            </p>
                        </div>


                        {analysis?.sentenceSummary && (
                            <div className="sentence-summary">
                                <strong>
                                    Ý chính
                                </strong>

                                <span>
                                    {
                                        analysis.sentenceSummary
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
                                    {isEnglish
                                        ? "AI đang phân tích IPA, CEFR, cấu trúc, ngữ pháp và từ vựng."
                                        : "AI đang phân tích cách đọc, cấu trúc, ngữ pháp và từ vựng."}
                                    {" "}
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
                                        activeTab === "structure"
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
                                        activeTab === "grammar"
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
                                        {grammarCount}
                                    </span>
                                </button>


                                <button
                                    className={
                                        activeTab === "vocabulary"
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
                                        {vocabularyCount}
                                    </span>
                                </button>


                                {isEnglish && (
                                    <button
                                        className={
                                            activeTab === "collocations"
                                                ? "study-tab active"
                                                : "study-tab"
                                        }
                                        onClick={() => {
                                            setActiveTab(
                                                "collocations"
                                            );
                                        }}
                                    >
                                        Collocations

                                        <span>
                                            {
                                                analysis
                                                    .collocations
                                                    ?.length ??
                                                0
                                            }
                                        </span>
                                    </button>
                                )}


                                {isEnglish && (
                                    <button
                                        className={
                                            activeTab === "mistakes"
                                                ? "study-tab active"
                                                : "study-tab"
                                        }
                                        onClick={() => {
                                            setActiveTab(
                                                "mistakes"
                                            );
                                        }}
                                    >
                                        Lỗi thường gặp

                                        <span>
                                            {
                                                analysis
                                                    .commonMistakes
                                                    ?.length ??
                                                0
                                            }
                                        </span>
                                    </button>
                                )}
                            </div>


                            <div className="study-tab-content">

                                {activeTab === "structure" && (
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
                                                            {index + 1}
                                                        </div>

                                                        <div className="sentence-part-main">
                                                            <div className="sentence-part-title">
                                                                <strong>
                                                                    {part.text}
                                                                </strong>

                                                                {!isEnglish &&
                                                                    part.reading && (
                                                                    <span>
                                                                        {part.reading}
                                                                    </span>
                                                                )}

                                                                {!isEnglish &&
                                                                    part.romaji && (
                                                                    <small>
                                                                        {part.romaji}
                                                                    </small>
                                                                )}
                                                            </div>

                                                            <div className="sentence-part-tags">
                                                                {part.role && (
                                                                    <span>
                                                                        {part.role}
                                                                    </span>
                                                                )}

                                                                {part.meaning && (
                                                                    <span>
                                                                        {part.meaning}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {part.explanation && (
                                                                <p>
                                                                    {part.explanation}
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


                                {activeTab === "grammar" &&
                                    !isEnglish && (
                                    <div className="grammar-grid">
                                        {analysis.grammar.map(
                                            (
                                                grammar,
                                                index
                                            ) => {
                                                const key =
                                                    grammar.pattern;

                                                const alreadySaved =
                                                    autoSaveGrammar ||
                                                    savedGrammarKeys
                                                        .has(key);

                                                return (
                                                    <article
                                                        className="grammar-card"
                                                        key={`${grammar.pattern}-${index}`}
                                                    >
                                                        <div className="grammar-card-top">
                                                            <div>
                                                                <strong>
                                                                    {grammar.pattern}
                                                                </strong>

                                                                {grammar.matchedText && (
                                                                    <span>
                                                                        Dấu hiệu trong câu:
                                                                        {" "}
                                                                        {grammar.matchedText}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="grammar-card-actions">
                                                                <LevelBadge
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
                                                                    {savingGrammarKey === key
                                                                        ? "Đang lưu..."
                                                                        : alreadySaved
                                                                            ? "✓ Đã lưu"
                                                                            : "+ Lưu"}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="grammar-meaning">
                                                            {grammar.meaning}
                                                        </div>

                                                        <GrammarStudyDetails
                                                            explanation={
                                                                grammar.explanation
                                                            }
                                                            example={
                                                                grammar.example
                                                            }
                                                        />

                                                        
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


                                {activeTab === "grammar" &&
                                    isEnglish && (
                                    <div className="grammar-grid">
                                        {(
                                            analysis
                                                .englishGrammar ??
                                            []
                                        ).map(
                                            (
                                                grammar,
                                                index
                                            ) => (
                                                <article
                                                    className="grammar-card"
                                                    key={`${grammar.pattern}-${index}`}
                                                >
                                                    <div className="grammar-card-top">
                                                        <div>
                                                            <strong>
                                                                {grammar.pattern}
                                                            </strong>

                                                            {grammar.matchedText && (
                                                                    <span>
                                                                        Dấu hiệu trong câu:
                                                                        {" "}
                                                                        {grammar.matchedText}
                                                                    </span>
                                                                )}
                                                        </div>

                                                        <LevelBadge
                                                            level={
                                                                grammar.cefrLevel
                                                            }
                                                        />
                                                    </div>

                                                    <div className="grammar-meaning">
                                                        {grammar.meaning}
                                                    </div>

                                                    <GrammarStudyDetails
                                                            explanation={
                                                                grammar.explanation
                                                            }
                                                            example={
                                                                grammar.example
                                                            }
                                                        />
                                                </article>
                                            )
                                        )}

                                        {!(
                                            analysis
                                                .englishGrammar ??
                                            []
                                        ).length && (
                                            <div className="empty-inline">
                                                Không phát hiện grammar nổi bật.
                                            </div>
                                        )}
                                    </div>
                                )}


                                {activeTab === "vocabulary" &&
                                    !isEnglish && (
                                    <div className="study-vocab-list">
                                        {analysis.vocabulary.map(
                                            (
                                                word,
                                                index
                                            ) => {
                                                const key =
                                                    wordKey(word);

                                                const alreadySaved =
                                                    autoSaveVocabulary ||
                                                    savedWordKeys
                                                        .has(key);

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
                                                                    {word.surface}
                                                                </small>
                                                            )}
                                                        </div>

                                                        <div className="vocab-reading-column">
                                                            <span>
                                                                {word.reading}
                                                            </span>

                                                            <small>
                                                                {word.romaji}
                                                            </small>
                                                        </div>

                                                        <div className="vocab-meaning-column">
                                                            <strong>
                                                                {word.meaning}
                                                            </strong>

                                                            <span>
                                                                {word.partOfSpeech}
                                                            </span>
                                                        </div>

                                                        <LevelBadge
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
                                                            {savingWordKey === key
                                                                ? "Đang lưu..."
                                                                : alreadySaved
                                                                    ? "✓ Đã lưu"
                                                                    : "+ Lưu"}
                                                        </button>

                                                        {word.example && (
                                                            <p className="vocab-note">
                                                                <strong>
                                                                    Ví dụ:
                                                                </strong>
                                                                {" "}
                                                                {word.example}
                                                            </p>
                                                        )}

                                                        {word.note && (
                                                            <p className="vocab-note">
                                                                {word.note}
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


                                {activeTab === "vocabulary" &&
                                    isEnglish && (
                                    <div className="study-vocab-list">
                                        {(
                                            analysis
                                                .englishVocabulary ??
                                            []
                                        ).map(
                                            (
                                                word,
                                                index
                                            ) => (
                                                <article
                                                    className="study-vocab-row"
                                                    key={`${word.lemma}-${word.surface}-${index}`}
                                                >
                                                    <div className="vocab-word">
                                                        <strong>
                                                            {
                                                                word.lemma ||
                                                                word.surface
                                                            }
                                                        </strong>

                                                        {word.surface &&
                                                            word.surface !==
                                                            word.lemma && (
                                                            <small>
                                                                Trong câu:
                                                                {" "}
                                                                {word.surface}
                                                            </small>
                                                        )}
                                                    </div>

                                                    <div className="vocab-reading-column">
                                                        <span>
                                                            /{word.ipa}/
                                                        </span>

                                                        <small>
                                                            {word.partOfSpeech}
                                                        </small>
                                                    </div>

                                                    <div className="vocab-meaning-column">
                                                        <strong>
                                                            {word.meaning}
                                                        </strong>

                                                        {word.example && (
                                                            <span>
                                                                {word.example}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <LevelBadge
                                                        level={
                                                            word.cefrLevel
                                                        }
                                                    />

                                                    {word.note && (
                                                        <p className="vocab-note">
                                                            {word.note}
                                                        </p>
                                                    )}
                                                </article>
                                            )
                                        )}

                                        {!(
                                            analysis
                                                .englishVocabulary ??
                                            []
                                        ).length && (
                                            <div className="empty-inline">
                                                Không có vocabulary cần tách.
                                            </div>
                                        )}
                                    </div>
                                )}


                                {activeTab === "collocations" &&
                                    isEnglish && (
                                    <div className="grammar-grid">
                                        {(
                                            analysis
                                                .collocations ??
                                            []
                                        ).map(
                                            (
                                                item,
                                                index
                                            ) => (
                                                <article
                                                    className="grammar-card"
                                                    key={`${item.phrase}-${index}`}
                                                >
                                                    <div className="grammar-card-top">
                                                        <strong>
                                                            {item.phrase}
                                                        </strong>
                                                    </div>

                                                    <div className="grammar-meaning">
                                                        {item.meaning}
                                                    </div>

                                                    {item.example && (
                                                        <p>
                                                            Ví dụ:
                                                            {" "}
                                                            {item.example}
                                                        </p>
                                                    )}
                                                </article>
                                            )
                                        )}

                                        {!(
                                            analysis
                                                .collocations ??
                                            []
                                        ).length && (
                                            <div className="empty-inline">
                                                Không có collocation nổi bật.
                                            </div>
                                        )}
                                    </div>
                                )}


                                {activeTab === "mistakes" &&
                                    isEnglish && (
                                    <div className="grammar-grid">
                                        {(
                                            analysis
                                                .commonMistakes ??
                                            []
                                        ).map(
                                            (
                                                item,
                                                index
                                            ) => (
                                                <article
                                                    className="grammar-card"
                                                    key={`${item.incorrect}-${index}`}
                                                >
                                                    <div className="grammar-meaning">
                                                        ❌
                                                        {" "}
                                                        {item.incorrect}
                                                    </div>

                                                    <p>
                                                        ✅
                                                        {" "}
                                                        <strong>
                                                            {item.correct}
                                                        </strong>
                                                    </p>

                                                    <p>
                                                        {item.explanation}
                                                    </p>
                                                </article>
                                            )
                                        )}

                                        {!(
                                            analysis
                                                .commonMistakes ??
                                            []
                                        ).length && (
                                            <div className="empty-inline">
                                                Không có lỗi phổ biến cần lưu ý.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}


                    {analysis &&
                        analysis.notes.length >
                        0 && (
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

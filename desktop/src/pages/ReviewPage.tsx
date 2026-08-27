import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import type {
    ReviewAnswerResponse,
    ReviewItem,
    ReviewMasteryLevel,
    ReviewQueue,
    ReviewStats,
    StudyLanguage
} from "../app/types";

import {
    LearningLanguageTabs
} from "../components/LearningLanguageTabs";

type ReviewMode =
    | "DUE"
    | "PRACTICE";

type PracticeSource =
    | "FREE"
    | "SESSION";

interface ReviewPageProps {
    language: StudyLanguage;

    onLanguageChange:
        (language: StudyLanguage) => void;

    queue: ReviewQueue;
    stats: ReviewStats;
    loading: boolean;
    message: string;
    onRefresh: () => void;
    onLoadPractice:
        () => Promise<ReviewQueue>;
    onAnswer:
        (
            item: ReviewItem,
            selectedOptionId: string,
            responseTimeMs: number,
            practice: boolean
        ) => Promise<ReviewAnswerResponse>;
    onAdvance: () => Promise<void>;
    onSkip:
        (item: ReviewItem) => void;
}

const masteryLabels:
    Record<ReviewMasteryLevel, string> = {
        NEW: "Mới",
        WEAK: "Yếu",
        LEARNING: "Đang học",
        FAMILIAR: "Khá thuộc",
        MASTERED: "Đã thuộc"
    };

function typeLabel(
    item: ReviewItem
) {
    return item.itemType ===
        "VOCABULARY"
            ? "TỪ VỰNG"
            : "NGỮ PHÁP";
}

function typeName(
    item: ReviewItem
) {
    return item.itemType ===
        "VOCABULARY"
            ? "Từ vựng"
            : "Ngữ pháp";
}

function questionInstruction(
    item: ReviewItem
) {
    switch (
        item.questionType
    ) {
        /*
         * Legacy question type.
         */
        case "MEANING":
            return item.itemType ===
                "GRAMMAR"
                ? "Chọn nghĩa đúng"
                : "Chọn nghĩa đúng";

        case "WORD_TO_MEANING":
            return "Chọn nghĩa đúng";

        case "MEANING_TO_WORD":
            return item.language === "EN"
                ? "Chọn từ tiếng Anh đúng"
                : "Chọn từ tiếng Nhật đúng";

        case "READING_TO_WORD":
            return "Chọn từ / kanji đúng";

        case "IPA_TO_WORD":
            return "Chọn từ tiếng Anh đúng";

        case "PATTERN_TO_MEANING":
            return "Chọn nghĩa của mẫu ngữ pháp";

        case "MEANING_TO_PATTERN":
            return "Chọn mẫu ngữ pháp đúng";

        case "EXAMPLE_TO_PATTERN":
            return "Chọn mẫu ngữ pháp phù hợp";
    }
}


function questionPrompt(
    item: ReviewItem
) {
    const text =
        String(
            item.primaryText ||
            ""
        ).trim();

    if (
        item.questionType ===
        "IPA_TO_WORD"
    ) {
        const clean =
            text
                .replace(
                    /^[/]+/,
                    ""
                )
                .replace(
                    /[/]+$/,
                    ""
                );

        return `/${clean}/`;
    }

    return text;
}


function showVocabularyContext(
    item: ReviewItem
) {
    return (
        item.itemType ===
            "VOCABULARY"
        &&
        (
            item.questionType ===
                "MEANING"
            ||
            item.questionType ===
                "WORD_TO_MEANING"
        )
    );
}


function gradeLabel(
    value:
        ReviewAnswerResponse["automaticGrade"]
) {
    switch (value) {
        case "AGAIN":
            return "Cần ôn lại";
        case "HARD":
            return "Còn yếu";
        case "GOOD":
            return "Đang tiến bộ";
        case "EASY":
            return "Đã khá chắc";
    }
}

function itemKey(
    item: ReviewItem
) {
    return `${item.itemType}:${item.itemId}`;
}


function formatSessionTime(
    valueMs: number
) {
    const totalSeconds =
        Math.max(
            0,
            Math.round(
                valueMs / 1000
            )
        );

    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    }

    const minutes =
        Math.floor(
            totalSeconds / 60
        );

    const seconds =
        totalSeconds % 60;

    return seconds
        ? `${minutes}m ${seconds}s`
        : `${minutes}m`;
}

function shuffled<T>(
    input: T[]
) {
    const result = [
        ...input
    ];

    for (
        let index =
            result.length - 1;
        index > 0;
        index -= 1
    ) {
        const swapIndex =
            Math.floor(
                Math.random() *
                (index + 1)
            );

        [
            result[index],
            result[swapIndex]
        ] = [
            result[swapIndex],
            result[index]
        ];
    }

    return result;
}

function reshuffleItem(
    item: ReviewItem
): ReviewItem {
    return {
        ...item,
        options:
            shuffled(
                item.options || []
            )
    };
}

function reshuffleBatch(
    items: ReviewItem[]
) {
    return shuffled(
        items.map(
            reshuffleItem
        )
    );
}

export function ReviewPage({
    language,
    onLanguageChange,
    queue,
    stats,
    loading,
    message,
    onRefresh,
    onLoadPractice,
    onAnswer,
    onAdvance,
    onSkip
}: ReviewPageProps) {
    const [
        mode,
        setMode
    ] = useState<ReviewMode>(
        "DUE"
    );

    const [
        practiceSource,
        setPracticeSource
    ] = useState<PracticeSource>(
        "FREE"
    );

    const [
        practiceItems,
        setPracticeItems
    ] = useState<ReviewItem[]>(
        []
    );

    const [
        practiceSeed,
        setPracticeSeed
    ] = useState<ReviewItem[]>(
        []
    );

    const [
        dueSessionItems,
        setDueSessionItems
    ] = useState<ReviewItem[]>(
        []
    );

    const [
        dueSessionWrongItems,
        setDueSessionWrongItems
    ] = useState<ReviewItem[]>(
        []
    );

    const [
        dueSessionCorrectCount,
        setDueSessionCorrectCount
    ] = useState(0);

    const [
        dueSessionResponseTimeMs,
        setDueSessionResponseTimeMs
    ] = useState(0);

    const [
        dueSessionInitialTotal,
        setDueSessionInitialTotal
    ] = useState(0);

    const [
        dueSessionSkippedCount,
        setDueSessionSkippedCount
    ] = useState(0);

    /*
     * Guard để cùng một card không bị cộng
     * hai lần vào Session Summary nếu renderer
     * hoặc queue refresh lặp lại.
     */
    const dueSessionKeysRef =
        useRef<Set<string>>(
            new Set()
        );

    const [
        practiceLoading,
        setPracticeLoading
    ] = useState(false);

    const [
        practiceMessage,
        setPracticeMessage
    ] = useState("");

    const current =
        mode === "PRACTICE"
            ? practiceItems[0] ??
              null
            : queue.items[0] ??
              null;

    const [
        selectedOptionId,
        setSelectedOptionId
    ] = useState("");

    const [
        feedback,
        setFeedback
    ] = useState<
        ReviewAnswerResponse |
        null
    >(null);

    const [
        answering,
        setAnswering
    ] = useState(false);

    const startedAtRef =
        useRef(
            Date.now()
        );

    useEffect(() => {
        /*
         * Không giữ Practice/session của language cũ
         * khi chuyển JA <-> EN.
         */
        setMode(
            "DUE"
        );

        setPracticeSource(
            "FREE"
        );

        setPracticeItems([]);
        setPracticeSeed([]);

        setDueSessionItems([]);
        setDueSessionWrongItems([]);
        setDueSessionCorrectCount(0);
        setDueSessionResponseTimeMs(0);
        setDueSessionInitialTotal(0);
        setDueSessionSkippedCount(0);

        dueSessionKeysRef
            .current
            .clear();

        setPracticeMessage("");

        setSelectedOptionId("");
        setFeedback(null);
        setAnswering(false);

        startedAtRef.current =
            Date.now();
    }, [
        language
    ]);

    useEffect(() => {
        /*
         * Chốt tổng số card ở đầu phiên.
         *
         * queue.totalDue sẽ giảm sau mỗi lần
         * backend refresh nên không thể dùng nó
         * trực tiếp làm mẫu số của progress.
         */
        if (
            mode !== "DUE"
            ||
            dueSessionInitialTotal > 0
            ||
            dueSessionItems.length > 0
            ||
            dueSessionSkippedCount > 0
            ||
            queue.totalDue <= 0
        ) {
            return;
        }

        setDueSessionInitialTotal(
            queue.totalDue
        );
    }, [
        mode,
        language,
        queue.totalDue,
        dueSessionInitialTotal,
        dueSessionItems.length,
        dueSessionSkippedCount
    ]);


    const currentOptionSignature =
        current?.options
            ?.map(
                (option) =>
                    option.optionId
            )
            .join("|") || "";

    useEffect(() => {
        setSelectedOptionId("");
        setFeedback(null);
        setAnswering(false);
        startedAtRef.current =
            Date.now();
    }, [
        mode,
        current?.itemType,
        current?.itemId,
        currentOptionSignature
    ]);

    const optionByText =
        useMemo(() => {
            const map =
                new Map<
                    string,
                    string
                >();

            for (
                const option
                of current?.options ?? []
            ) {
                map.set(
                    option.text,
                    option.optionId
                );
            }

            return map;
        }, [
            current?.itemType,
            current?.itemId,
            currentOptionSignature
        ]);

    async function choose(
        optionId: string
    ) {
        if (
            !current ||
            answering ||
            feedback
        ) {
            return;
        }

        try {
            setSelectedOptionId(
                optionId
            );

            setAnswering(
                true
            );

            const isPractice =
                mode === "PRACTICE";

            const responseTimeMs =
                Math.max(
                    0,
                    Date.now() -
                        startedAtRef.current
                );

            const response =
                await onAnswer(
                    current,
                    optionId,
                    responseTimeMs,
                    isPractice
                );

            if (!isPractice) {
                const key =
                    itemKey(
                        current
                    );

                if (
                    !dueSessionKeysRef
                        .current
                        .has(key)
                ) {
                    dueSessionKeysRef
                        .current
                        .add(key);

                    setDueSessionItems(
                        (existing) => [
                            ...existing,
                            current
                        ]
                    );

                    if (response.correct) {
                        setDueSessionCorrectCount(
                            (value) =>
                                value + 1
                        );
                    } else {
                        setDueSessionWrongItems(
                            (existing) => [
                                ...existing,
                                current
                            ]
                        );
                    }

                    setDueSessionResponseTimeMs(
                        (value) =>
                            value +
                            responseTimeMs
                    );
                }
            }

            setFeedback(
                response
            );
        } finally {
            setAnswering(
                false
            );
        }
    }

    async function next() {
        if (
            !feedback ||
            !current
        ) {
            return;
        }

        if (mode === "PRACTICE") {
            const shouldRepeat =
                !feedback.correct;

            setSelectedOptionId("");
            setFeedback(null);
            setAnswering(false);
            startedAtRef.current =
                Date.now();

            setPracticeItems(
                (items) => {
                    const rest =
                        items.slice(1);

                    if (shouldRepeat) {
                        rest.push(
                            reshuffleItem(
                                current
                            )
                        );
                    }

                    return rest;
                }
            );

            return;
        }

        await onAdvance();
    }

    async function startFreePractice() {
        try {
            setPracticeLoading(
                true
            );

            setPracticeMessage("");

            const result =
                await onLoadPractice();

            const items =
                reshuffleBatch(
                    Array.isArray(
                        result?.items
                    )
                        ? result.items
                        : []
                );

            if (!items.length) {
                setPracticeMessage(
                    "Chưa đủ dữ liệu để tạo bộ ôn tự do 4 đáp án. Cần ít nhất 4 nghĩa khác nhau trong Vocabulary hoặc Grammar."
                );
                return;
            }

            setPracticeSource(
                "FREE"
            );

            setPracticeSeed(
                items
            );

            setPracticeItems(
                items
            );

            setMode(
                "PRACTICE"
            );
        } catch (error) {
            setPracticeMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setPracticeLoading(
                false
            );
        }
    }

    function startSessionReplay() {
        if (!dueSessionWrongItems.length) {
            return;
        }

        const items =
            reshuffleBatch(
                dueSessionWrongItems
            );

        setPracticeSource(
            "SESSION"
        );

        setPracticeSeed(
            items
        );

        setPracticeItems(
            items
        );

        setPracticeMessage("");

        setMode(
            "PRACTICE"
        );
    }

    function replayPracticeBatch() {
        if (!practiceSeed.length) {
            return;
        }

        setPracticeItems(
            reshuffleBatch(
                practiceSeed
            )
        );

        setPracticeMessage("");
    }

    function backToDue() {
        setMode(
            "DUE"
        );

        setPracticeItems([]);
        setPracticeSeed([]);
        setPracticeMessage("");

        onRefresh();
    }


    function startNewDueSession() {
        setMode(
            "DUE"
        );

        setPracticeItems([]);
        setPracticeSeed([]);

        setDueSessionItems([]);
        setDueSessionWrongItems([]);
        setDueSessionCorrectCount(0);
        setDueSessionResponseTimeMs(0);

        dueSessionKeysRef
            .current
            .clear();

        setPracticeMessage("");
        setSelectedOptionId("");
        setFeedback(null);
        setAnswering(false);

        startedAtRef.current =
            Date.now();

        onRefresh();
    }

    function skipCurrent() {
        if (!current) {
            return;
        }

        if (mode === "PRACTICE") {
            setPracticeItems(
                (items) =>
                    items.slice(1)
            );
            return;
        }

        setDueSessionSkippedCount(
            (value) =>
                value + 1
        );

        onSkip(current);
    }

    useEffect(() => {
        function onKeyDown(
            event:
                KeyboardEvent
        ) {
            if (!current) {
                return;
            }

            if (
                feedback &&
                (
                    event.code ===
                        "Space"
                    ||
                    event.code ===
                        "Enter"
                )
            ) {
                event.preventDefault();
                void next();
                return;
            }

            if (
                feedback ||
                answering ||
                !current.quizReady
            ) {
                return;
            }

            const optionIndex:
                Record<string, number> = {
                    Digit1: 0,
                    Digit2: 1,
                    Digit3: 2,
                    Digit4: 3
                };

            const index =
                optionIndex[
                    event.code
                ];

            if (
                index == null
                ||
                !current.options[index]
            ) {
                return;
            }

            event.preventDefault();

            void choose(
                current
                    .options[index]
                    .optionId
            );
        }

        window.addEventListener(
            "keydown",
            onKeyDown
        );

        return () => {
            window.removeEventListener(
                "keydown",
                onKeyDown
            );
        };
    }, [
        mode,
        current?.itemType,
        current?.itemId,
        currentOptionSignature,
        feedback,
        answering
    ]);

    function optionClass(
        optionId: string,
        optionText: string
    ) {
        if (!feedback) {
            return optionId ===
                selectedOptionId
                    ? "review-option selected"
                    : "review-option";
        }

        const correctOptionId =
            optionByText.get(
                feedback.correctAnswer
            );

        if (
            optionId ===
            correctOptionId
        ) {
            return "review-option correct";
        }

        if (
            optionId ===
            selectedOptionId
            &&
            !feedback.correct
        ) {
            return "review-option wrong";
        }

        return "review-option muted";
    }

    const displayedMessage =
        practiceMessage ||
        message;

    const remainingCount =
        mode === "PRACTICE"
            ? practiceItems.length
            : queue.totalDue;

    const dueSessionTotal =
        dueSessionItems.length;

    const dueSessionWrongCount =
        dueSessionWrongItems.length;

    const dueSessionAccuracy =
        dueSessionTotal > 0
            ? Math.round(
                (
                    dueSessionCorrectCount /
                    dueSessionTotal
                ) * 100
            )
            : 0;

    const dueSessionVocabularyCount =
        dueSessionItems.filter(
            (item) =>
                item.itemType ===
                "VOCABULARY"
        ).length;

    const dueSessionGrammarCount =
        dueSessionItems.filter(
            (item) =>
                item.itemType ===
                "GRAMMAR"
        ).length;

    const dueSessionProcessedCount =
        dueSessionTotal +
        dueSessionSkippedCount;

    /*
     * initialTotal là mẫu số ổn định.
     * queue.totalDue chỉ dùng làm fallback
     * trước khi effect kịp chốt total.
     */
    const dueSessionDisplayTotal =
        Math.max(
            dueSessionInitialTotal,
            queue.totalDue,
            dueSessionProcessedCount
        );

    const dueSessionProgressPercent =
        dueSessionDisplayTotal > 0
            ? Math.min(
                100,
                Math.round(
                    (
                        dueSessionProcessedCount /
                        dueSessionDisplayTotal
                    ) * 100
                )
            )
            : 0;

    const dueSessionCurrentNumber =
        dueSessionDisplayTotal > 0
            ? Math.min(
                dueSessionDisplayTotal,
                Math.max(
                    1,
                    feedback
                        ? dueSessionProcessedCount
                        : dueSessionProcessedCount + 1
                )
            )
            : 0;

    return (
        <div className="page-stack review-page">
            <LearningLanguageTabs
                value={language}
                disabled={
                    loading ||
                    answering ||
                    practiceLoading
                }
                onChange={
                    onLanguageChange
                }
            />

            <section className="page-intro-row review-intro">
                <div>
                    <span className="eyebrow violet">
                        REVIEW
                    </span>

                    <h2>
                        Ôn tập bằng trắc nghiệm
                    </h2>

                    <p>
                        Ôn các thẻ đến hạn hoặc luyện thêm theo nhu cầu.
                    </p>
                </div>

                <div className="review-mode-actions">
                    <button
                        className={
                            mode === "DUE"
                                ? "review-mode-button active"
                                : "review-mode-button"
                        }
                        onClick={backToDue}
                        disabled={loading}
                    >
                        Đến hạn
                    </button>

                    <button
                        className={
                            mode === "PRACTICE"
                                ? "review-mode-button active practice"
                                : "review-mode-button practice"
                        }
                        onClick={() => {
                            void startFreePractice();
                        }}
                        disabled={
                            loading ||
                            practiceLoading
                        }
                    >
                        {practiceLoading
                            ? "Đang tạo..."
                            : "Ôn tự do"}
                    </button>
                </div>
            </section>

            {mode === "PRACTICE" && (
                <section className="practice-mode-banner">
                    <div>
                        <strong>
                            Chế độ ôn lại
                        </strong>

                        <span>
                            {practiceSource === "SESSION"
                                ? "Đang ôn lại các câu sai của phiên vừa rồi."
                                : "Đang luyện các mục trong thư viện, ưu tiên mục cần ôn thêm."}
                        </span>
                    </div>

                    <div>
                        <span>
                            Không ảnh hưởng lịch ôn
                        </span>
                        <span>
                            Sai → gặp lại cuối phiên
                        </span>
                    </div>
                </section>
            )}

            <section className="review-stats-grid review-stats-v662">
                <div className="review-stat-card primary">
                    <span>Đến hạn</span>
                    <strong>
                        {stats.dueNow}
                    </strong>
                    <small>cần ôn</small>
                </div>

                <div className="review-stat-card">
                    <span>Đúng 24h</span>
                    <strong>
                        {stats.correctLast24h}
                    </strong>
                    <small>
                        {stats.accuracyLast24h}% chính xác
                    </small>
                </div>

                <div className="review-stat-card">
                    <span>Sai 24h</span>
                    <strong>
                        {stats.wrongLast24h}
                    </strong>
                    <small>
                        trong phiên ôn đến hạn
                    </small>
                </div>

                <div className="review-stat-card">
                    <span>Đã ôn</span>
                    <strong>
                        {stats.reviewedLast24h}
                    </strong>
                    <small>24 giờ qua</small>
                </div>
            </section>

            {displayedMessage && (
                <div className="notice info">
                    {displayedMessage}
                </div>
            )}

            {!current ? (
                <section className="review-complete-card">
                    <div className="review-complete-mark">
                        ✓
                    </div>

                    <h3>
                        {mode === "PRACTICE"
                            ? "Đã xong bộ ôn lại"
                            : dueSessionTotal > 0
                                ? "Hoàn thành ôn tập"
                                : "Không còn card đến hạn"}
                    </h3>

                    <p>
                        {mode === "PRACTICE"
                            ? practiceSource === "SESSION"
                                ? "Bạn đã hoàn thành bộ ôn lại các câu sai. Practice không làm thay đổi lịch SRS."
                                : "Bạn có thể làm lại bộ này hoặc quay về lịch ôn."
                            : dueSessionTotal > 0
                                ? dueSessionWrongCount > 0
                                    ? `Bạn còn ${dueSessionWrongCount} câu cần củng cố.`
                                    : "Xuất sắc — không có câu sai trong phiên này."
                                : "Thẻ đã học sẽ quay lại khi đến hạn. Nếu muốn luyện thêm, dùng Ôn tự do."}
                    </p>

                    {mode === "DUE" &&
                    dueSessionTotal > 0 && (
                        <>
                            <div className="review-stats-grid review-stats-v662">
                                <div className="review-stat-card primary">
                                    <span>
                                        Tổng câu
                                    </span>

                                    <strong>
                                        {dueSessionTotal}
                                    </strong>

                                    <small>
                                        đã trả lời
                                    </small>
                                </div>

                                <div className="review-stat-card">
                                    <span>
                                        Đúng
                                    </span>

                                    <strong>
                                        {dueSessionCorrectCount}
                                    </strong>

                                    <small>
                                        câu chính xác
                                    </small>
                                </div>

                                <div className="review-stat-card">
                                    <span>
                                        Sai
                                    </span>

                                    <strong>
                                        {dueSessionWrongCount}
                                    </strong>

                                    <small>
                                        cần ôn lại
                                    </small>
                                </div>

                                <div className="review-stat-card">
                                    <span>
                                        Chính xác
                                    </span>

                                    <strong>
                                        {dueSessionAccuracy}%
                                    </strong>

                                    <small>
                                        trong phiên
                                    </small>
                                </div>
                            </div>

                            <div className="review-behavior-metrics">
                                <span>
                                    Từ vựng:
                                    {" "}
                                    <strong>
                                        {dueSessionVocabularyCount}
                                    </strong>
                                </span>

                                <span>
                                    Ngữ pháp:
                                    {" "}
                                    <strong>
                                        {dueSessionGrammarCount}
                                    </strong>
                                </span>

                                <span>
                                    Thời gian trả lời:
                                    {" "}
                                    <strong>
                                        {formatSessionTime(
                                            dueSessionResponseTimeMs
                                        )}
                                    </strong>
                                </span>

                                {dueSessionSkippedCount > 0 && (
                                    <span>
                                        Bỏ qua:
                                        {" "}
                                        <strong>
                                            {
                                                dueSessionSkippedCount
                                            }
                                        </strong>
                                    </span>
                                )}

                                <span>
                                    Ngôn ngữ:
                                    {" "}
                                    <strong>
                                        {language}
                                    </strong>
                                </span>
                            </div>
                        </>
                    )}

                    <div className="review-complete-actions">
                        {mode === "DUE" &&
                        dueSessionWrongCount > 0 && (
                            <button
                                className="primary-action"
                                onClick={
                                    startSessionReplay
                                }
                            >
                                Ôn lại{" "}
                                {dueSessionWrongCount}
                                {" "}câu sai
                            </button>
                        )}

                        {mode === "PRACTICE" &&
                        practiceSeed.length > 0 && (
                            <button
                                className="primary-action"
                                onClick={
                                    replayPracticeBatch
                                }
                            >
                                Làm lại bộ này
                            </button>
                        )}

                        <button
                            className="secondary-action"
                            onClick={() => {
                                void startFreePractice();
                            }}
                            disabled={
                                practiceLoading
                            }
                        >
                            {mode === "DUE" &&
                            dueSessionTotal > 0
                                ? "Phiên luyện mới"
                                : "Ôn tự do"}
                        </button>

                        <button
                            className="secondary-action"
                            onClick={
                                mode === "DUE" &&
                                dueSessionTotal > 0
                                    ? startNewDueSession
                                    : backToDue
                            }
                            disabled={loading}
                        >
                            {mode === "DUE" &&
                            dueSessionTotal > 0
                                ? "Bắt đầu phiên mới"
                                : "Kiểm tra card đến hạn"}
                        </button>
                    </div>
                </section>
            ) : (
                <section className="review-workspace">
                    <div className="review-progress-row">
                        <div>
                            <span className="review-type-chip">
                                {typeLabel(current)}
                            </span>

                            {language === "EN"
                                ? (
                                    current.cefrLevel &&
                                    current.cefrLevel !==
                                        "UNKNOWN" && (
                                        <span className="jlpt-badge">
                                            {
                                                current.cefrLevel
                                            }
                                        </span>
                                    )
                                )
                                : (
                                    current.jlptLevel &&
                                    current.jlptLevel !==
                                        "UNKNOWN" && (
                                        <span className="jlpt-badge">
                                            {
                                                current.jlptLevel
                                            }
                                        </span>
                                    )
                                )}

                            <span
                                className={`review-mastery mastery-${current.masteryLevel.toLowerCase()}`}
                            >
                                {
                                    masteryLabels[
                                        current.masteryLevel
                                    ]
                                }
                            </span>

                            {mode === "PRACTICE" && (
                                <span className="practice-chip">
                                    PRACTICE
                                </span>
                            )}
                        </div>

                        <span>
                            {remainingCount}
                            {" "}card còn trong phiên
                        </span>
                    </div>

                    {mode === "DUE" &&
                    dueSessionDisplayTotal > 0 && (
                        <div
                            className="review-session-progress-panel"
                            style={{
                                display: "grid",
                                gap: "8px",
                                marginBottom: "12px"
                            }}
                        >
                            <div className="review-behavior-metrics">
                                <span>
                                    Câu:
                                    {" "}
                                    <strong>
                                        {
                                            dueSessionCurrentNumber
                                        }
                                        {" / "}
                                        {
                                            dueSessionDisplayTotal
                                        }
                                    </strong>
                                </span>

                                <span>
                                    Đúng:
                                    {" "}
                                    <strong>
                                        {
                                            dueSessionCorrectCount
                                        }
                                    </strong>
                                </span>

                                <span>
                                    Sai:
                                    {" "}
                                    <strong>
                                        {
                                            dueSessionWrongCount
                                        }
                                    </strong>
                                </span>

                                {dueSessionSkippedCount > 0 && (
                                    <span>
                                        Bỏ qua:
                                        {" "}
                                        <strong>
                                            {
                                                dueSessionSkippedCount
                                            }
                                        </strong>
                                    </span>
                                )}

                                <span>
                                    Tiến độ:
                                    {" "}
                                    <strong>
                                        {
                                            dueSessionProgressPercent
                                        }%
                                    </strong>
                                </span>
                            </div>

                            <progress
                                max={100}
                                value={
                                    dueSessionProgressPercent
                                }
                                style={{
                                    width: "100%",
                                    height: "10px"
                                }}
                                aria-label="Tiến độ phiên ôn tập"
                            />
                        </div>
                    )}

                    <article className="review-card quiz-card">
                        <div className="review-card-front">
                            <span className="eyebrow">
                                {typeName(
                                    current
                                )}
                                {" "}·{" "}
                                {questionInstruction(
                                    current
                                )}
                            </span>

                            <div className="review-prompt">
                                {questionPrompt(
                                    current
                                )}
                            </div>

                            {showVocabularyContext(
                                current
                            ) &&
                            current.secondaryText &&
                            current.secondaryText !==
                                current.primaryText && (
                                <div className="review-surface">
                                    Trong câu:
                                    {" "}
                                    {current.secondaryText}
                                </div>
                            )}

                            <div className="review-behavior-metrics">
                                <span>
                                    Chính xác:
                                    {" "}
                                    <strong>
                                        {current.accuracyPercent}%
                                    </strong>
                                </span>

                                <span>
                                    Đúng:
                                    {" "}
                                    {current.correctCount}
                                </span>

                                <span>
                                    Sai:
                                    {" "}
                                    {current.wrongCount}
                                </span>

                                <span>
                                    Chuỗi đúng:
                                    {" "}
                                    {current.correctStreak}
                                </span>
                            </div>
                        </div>

                        {!current.quizReady ? (
                            <div className="review-quiz-unavailable">
                                <strong>
                                    Chưa đủ dữ liệu tạo 4 đáp án
                                </strong>

                                <p>
                                    Card này chưa bị chấm.
                                </p>

                                <button
                                    className="secondary-action"
                                    onClick={skipCurrent}
                                >
                                    Bỏ qua card này
                                </button>
                            </div>
                        ) : (
                            <div className="review-option-grid">
                                {current.options.map(
                                    (
                                        option,
                                        index
                                    ) => (
                                        <button
                                            key={
                                                option.optionId
                                            }
                                            className={
                                                optionClass(
                                                    option.optionId,
                                                    option.text
                                                )
                                            }
                                            disabled={
                                                answering ||
                                                Boolean(
                                                    feedback
                                                )
                                            }
                                            onClick={() => {
                                                void choose(
                                                    option.optionId
                                                );
                                            }}
                                        >
                                            <span className="review-option-index">
                                                {index + 1}
                                            </span>

                                            <span>
                                                {option.text}
                                            </span>
                                        </button>
                                    )
                                )}
                            </div>
                        )}

                        {feedback && (
                            <div
                                className={
                                    feedback.correct
                                        ? "review-feedback correct"
                                        : "review-feedback wrong"
                                }
                            >
                                <div>
                                    <strong>
                                        {feedback.correct
                                            ? "✓ Chính xác"
                                            : "✕ Chưa đúng"}
                                    </strong>

                                    {!feedback.correct && (
                                        <span>
                                            Đáp án:
                                            {" "}
                                            {feedback.correctAnswer}
                                        </span>
                                    )}
                                </div>

                                {current.itemType ===
                                    "GRAMMAR" && (
                                    <div className="review-grammar-details">
                                        {feedback.item.secondaryText && (
                                            <div className="review-surface">
                                                <strong>
                                                    Dấu hiệu trong câu:
                                                </strong>
                                                {" "}
                                                {
                                                    feedback.item
                                                        .secondaryText
                                                }
                                            </div>
                                        )}

                                        {feedback.item.detail && (
                                            <div className="review-surface">
                                                <strong>
                                                    Cách dùng / Giải thích:
                                                </strong>
                                                {" "}
                                                {feedback.item.detail}
                                            </div>
                                        )}

                                        {feedback.item.example && (
                                            <div className="review-surface">
                                                <strong>
                                                    Ví dụ:
                                                </strong>
                                                {" "}
                                                {feedback.item.example}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="review-feedback-mastery">
                                    {mode === "PRACTICE" ? (
                                        <>
                                            <span>
                                                Luyện thêm
                                            </span>

                                            <span>
                                                Không ảnh hưởng lịch ôn
                                            </span>

                                            {!feedback.correct && (
                                                <span>
                                                    Card sẽ quay lại cuối phiên
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <span>
                                                Đánh giá tự động:
                                                {" "}
                                                <strong>
                                                    {
                                                        masteryLabels[
                                                            feedback.masteryLevel
                                                        ]
                                                    }
                                                </strong>
                                            </span>

                                            <span>
                                                {gradeLabel(
                                                    feedback.automaticGrade
                                                )}
                                            </span>

                                            <span>
                                                Độ chính xác:
                                                {" "}
                                                {feedback.accuracyPercent}%
                                            </span>
                                        </>
                                    )}
                                </div>

                                <button
                                    className="primary-action"
                                    onClick={() => {
                                        void next();
                                    }}
                                    disabled={loading}
                                >
                                    Câu tiếp theo
                                    <small>
                                        Space / Enter
                                    </small>
                                </button>
                            </div>
                        )}
                    </article>

                    <div className="review-queue-note">
                        <span>
                            Phím 1–4 để chọn đáp án
                        </span>

                        <span>
                            {mode === "PRACTICE"
                                ? "Không ảnh hưởng lịch ôn"
                                : "Kết quả sẽ cập nhật tiến độ và lịch ôn."}
                        </span>
                    </div>
                </section>
            )}
        </div>
    );
}

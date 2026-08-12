import {
    useEffect,
    useMemo,
    useState
} from "react";

import type { CSSProperties } from "react";

import type {
    AccountEntitlements,
    AuthStatus,
    BackendStatus,
    TargetTranslationLanguage,
    TranslationLanguage,
    TranslationProfile
} from "../app/types";

import {
    sourceTranslationLanguages,
    targetTranslationLanguages,
    translationLanguageLabels
} from "../app/translationLanguages";

interface NovelReaderPageProps {
    backend: BackendStatus;
    auth: AuthStatus;
    entitlements: AccountEntitlements;
    profiles: TranslationProfile[];
    activeProfile: TranslationProfile | null;
    profileDirty: boolean;
    sourceLanguage: TranslationLanguage;
    targetLanguage: TargetTranslationLanguage;
    onSourceLanguageChange:
        (value: TranslationLanguage) => void;
    onTargetLanguageChange:
        (value: TargetTranslationLanguage) => void;
    onSelectProfile: (profileId: number) => void;
    onUpgrade: () => void;
}

interface NovelFileInfo {
    path: string;
    name: string;
    sizeBytes: number;
    modifiedAt: string;
    encoding: string;
}

interface NovelBlock {
    id: string;
    index: number;
    text: string;
    heading: boolean;
}

interface NovelTranslation {
    translatedText: string;
    source: string;
}

interface SavedNovelProgress {
    modifiedAt: string;
    currentIndex: number;
    updatedAt: number;
    translations: Record<string, NovelTranslation>;
}



type NovelReaderTheme = "light" | "sepia" | "dark";
type NovelReaderMode = "parallel" | "translation" | "source";
type NovelReaderWidth = "compact" | "comfortable" | "wide";

interface NovelReaderPreferences {
    theme: NovelReaderTheme;
    mode: NovelReaderMode;
    fontSize: number;
    lineHeight: number;
    width: NovelReaderWidth;
}

const NOVEL_READER_PREFERENCES_KEY =
    "aiTranslator.novelReader.preferences.v1";

const DEFAULT_READER_PREFERENCES: NovelReaderPreferences = {
    theme: "sepia",
    mode: "parallel",
    fontSize: 17,
    lineHeight: 1.9,
    width: "comfortable"
};

function clampNumber(
    value: number,
    min: number,
    max: number
) {
    return Math.min(max, Math.max(min, value));
}

function loadReaderPreferences(): NovelReaderPreferences {
    try {
        const raw = localStorage.getItem(
            NOVEL_READER_PREFERENCES_KEY
        );

        if (!raw) {
            return DEFAULT_READER_PREFERENCES;
        }

        const saved = JSON.parse(raw) as Partial<NovelReaderPreferences>;
        const theme: NovelReaderTheme =
            saved.theme === "light" ||
            saved.theme === "dark" ||
            saved.theme === "sepia"
                ? saved.theme
                : DEFAULT_READER_PREFERENCES.theme;
        const mode: NovelReaderMode =
            saved.mode === "translation" ||
            saved.mode === "source" ||
            saved.mode === "parallel"
                ? saved.mode
                : DEFAULT_READER_PREFERENCES.mode;
        const width: NovelReaderWidth =
            saved.width === "compact" ||
            saved.width === "wide" ||
            saved.width === "comfortable"
                ? saved.width
                : DEFAULT_READER_PREFERENCES.width;

        return {
            theme,
            mode,
            width,
            fontSize: clampNumber(
                Number(saved.fontSize) ||
                    DEFAULT_READER_PREFERENCES.fontSize,
                14,
                24
            ),
            lineHeight: clampNumber(
                Number(saved.lineHeight) ||
                    DEFAULT_READER_PREFERENCES.lineHeight,
                1.5,
                2.2
            )
        };
    } catch {
        return DEFAULT_READER_PREFERENCES;
    }
}

const NOVEL_PROGRESS_KEY =
    "aiTranslator.novelReader.progress.v1";

const READER_WINDOW_SIZE = 40;
const MAX_SAVED_TRANSLATIONS = 160;

interface NovelSessionCache {
    file: NovelFileInfo | null;
    blocks: NovelBlock[];
    translations: Record<string, NovelTranslation>;
    currentIndex: number;
    windowStart: number;
    status: string;
}

let novelSessionCache: NovelSessionCache = {
    file: null,
    blocks: [],
    translations: {},
    currentIndex: 0,
    windowStart: 0,
    status: "Mở một file TXT để bắt đầu đọc."
};

function isChapterHeading(text: string) {
    const clean = text.trim();

    if (!clean || clean.length > 90) {
        return false;
    }

    return /^(?:第\s*[0-9０-９一二三四五六七八九十百千]+\s*[章話節巻部]|chapter\s+[0-9ivxlcdm]+|chương\s+[0-9ivxlcdm]+|prologue|epilogue|序章|終章|幕間|間章)/iu
        .test(clean);
}

function splitLongText(
    text: string,
    maxChars = 1100
): string[] {
    const clean = text.trim();

    if (!clean) {
        return [];
    }

    if (clean.length <= maxChars) {
        return [clean];
    }

    const sentences =
        clean.match(/[^。！？!?\n]+[。！？!?]?|\n+/gu) ||
        [clean];

    const chunks: string[] = [];
    let current = "";

    function pushCurrent() {
        const value = current.trim();
        if (value) {
            chunks.push(value);
        }
        current = "";
    }

    for (const rawSentence of sentences) {
        let sentence = rawSentence.trim();

        if (!sentence) {
            continue;
        }

        while (sentence.length > maxChars) {
            if (current) {
                pushCurrent();
            }

            let splitAt = sentence.lastIndexOf(
                " ",
                maxChars
            );

            if (splitAt < Math.floor(maxChars * 0.55)) {
                splitAt = maxChars;
            }

            chunks.push(
                sentence.slice(0, splitAt).trim()
            );
            sentence = sentence.slice(splitAt).trim();
        }

        if (!sentence) {
            continue;
        }

        const separator = current ? " " : "";

        if (
            current.length +
                separator.length +
                sentence.length >
            maxChars
        ) {
            pushCurrent();
        }

        current +=
            (current ? " " : "") + sentence;
    }

    pushCurrent();

    return chunks;
}

function parseNovelText(text: string): NovelBlock[] {
    const normalized = String(text || "")
        .replace(/\r\n?/g, "\n")
        .replace(/^\uFEFF/, "")
        .trim();

    if (!normalized) {
        return [];
    }

    const rawLines = normalized.split("\n");
    const rawParagraphs: string[] = [];
    let currentLines: string[] = [];
    let currentLength = 0;

    function flushCurrent() {
        const value = currentLines
            .join("\n")
            .trim();

        if (value) {
            rawParagraphs.push(value);
        }

        currentLines = [];
        currentLength = 0;
    }

    for (const rawLine of rawLines) {
        const line = rawLine.trim();

        if (!line) {
            flushCurrent();
            continue;
        }

        if (isChapterHeading(line)) {
            flushCurrent();
            rawParagraphs.push(line);
            continue;
        }

        if (
            currentLength > 0 &&
            currentLength + line.length + 1 > 1050
        ) {
            flushCurrent();
        }

        currentLines.push(line);
        currentLength += line.length + 1;
    }

    flushCurrent();

    const flattened = rawParagraphs.flatMap(
        (paragraph) =>
            isChapterHeading(paragraph)
                ? [paragraph]
                : splitLongText(paragraph)
    );

    return flattened.map(
        (paragraph, index) => ({
            id: `novel-${index + 1}`,
            index,
            text: paragraph,
            heading: isChapterHeading(paragraph)
        })
    );
}

function formatFileSize(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "0 KB";
    }

    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function loadProgress(
    file: NovelFileInfo
): SavedNovelProgress | null {
    try {
        const raw = localStorage.getItem(
            NOVEL_PROGRESS_KEY
        );

        if (!raw) {
            return null;
        }

        const all = JSON.parse(raw) as Record<
            string,
            SavedNovelProgress
        >;

        const saved = all[file.path];

        if (
            !saved ||
            saved.modifiedAt !== file.modifiedAt
        ) {
            return null;
        }

        return saved;
    } catch {
        return null;
    }
}

function saveProgress(
    file: NovelFileInfo,
    currentIndex: number,
    translations: Record<string, NovelTranslation>
) {
    try {
        const raw = localStorage.getItem(
            NOVEL_PROGRESS_KEY
        );

        const all: Record<
            string,
            SavedNovelProgress
        > = raw ? JSON.parse(raw) : {};

        const compactTranslations =
            Object.fromEntries(
                Object.entries(translations)
                    .sort(
                        ([a], [b]) =>
                            Number(a) - Number(b)
                    )
                    .slice(-MAX_SAVED_TRANSLATIONS)
            );

        all[file.path] = {
            modifiedAt: file.modifiedAt,
            currentIndex,
            updatedAt: Date.now(),
            translations: compactTranslations
        };

        const trimmed = Object.fromEntries(
            Object.entries(all)
                .sort(
                    ([, a], [, b]) =>
                        b.updatedAt - a.updatedAt
                )
                .slice(0, 5)
        );

        localStorage.setItem(
            NOVEL_PROGRESS_KEY,
            JSON.stringify(trimmed)
        );
    } catch {
        // Reading progress is best-effort only.
    }
}

export function NovelReaderPage({
    backend,
    auth,
    entitlements,
    profiles,
    activeProfile,
    profileDirty,
    sourceLanguage,
    targetLanguage,
    onSourceLanguageChange,
    onTargetLanguageChange,
    onSelectProfile,
    onUpgrade
}: NovelReaderPageProps) {
    const api = window.electronAPI as any;

    const [
        file,
        setFile
    ] = useState<NovelFileInfo | null>(
        () => novelSessionCache.file
    );

    const [
        blocks,
        setBlocks
    ] = useState<NovelBlock[]>(
        () => novelSessionCache.blocks
    );

    const [
        translations,
        setTranslations
    ] = useState<Record<string, NovelTranslation>>(
        () => novelSessionCache.translations
    );

    const [
        currentIndex,
        setCurrentIndex
    ] = useState(
        () => novelSessionCache.currentIndex
    );

    const [
        windowStart,
        setWindowStart
    ] = useState(
        () => novelSessionCache.windowStart
    );

    const [
        batchSize,
        setBatchSize
    ] = useState(6);

    const [
        readerPreferences,
        setReaderPreferences
    ] = useState<NovelReaderPreferences>(
        loadReaderPreferences
    );

    const [
        isOpening,
        setIsOpening
    ] = useState(false);

    const [
        isTranslating,
        setIsTranslating
    ] = useState(false);

    const [
        status,
        setStatus
    ] = useState(
        () => novelSessionCache.status
    );

    const novelAvailable =
        Boolean(
            entitlements.features.novelReaderTxt
        );

    const chapters = useMemo(
        () =>
            blocks.filter(
                (block) => block.heading
            ),
        [blocks]
    );

    const translatedCount = useMemo(
        () => Object.keys(translations).length,
        [translations]
    );

    const visibleBlocks = useMemo(
        () =>
            blocks.slice(
                windowStart,
                windowStart + READER_WINDOW_SIZE
            ),
        [blocks, windowStart]
    );

    useEffect(() => {
        novelSessionCache = {
            file,
            blocks,
            translations,
            currentIndex,
            windowStart,
            status
        };
    }, [
        file,
        blocks,
        translations,
        currentIndex,
        windowStart,
        status
    ]);

    useEffect(() => {
        if (!file) {
            return;
        }

        saveProgress(
            file,
            currentIndex,
            translations
        );
    }, [file, currentIndex, translations]);

    useEffect(() => {
        try {
            localStorage.setItem(
                NOVEL_READER_PREFERENCES_KEY,
                JSON.stringify(readerPreferences)
            );
        } catch {
            // Reader preferences are best-effort only.
        }
    }, [readerPreferences]);

    function updateReaderPreference<
        K extends keyof NovelReaderPreferences
    >(
        key: K,
        value: NovelReaderPreferences[K]
    ) {
        setReaderPreferences((current) => ({
            ...current,
            [key]: value
        }));
    }

    function resetReaderPreferences() {
        setReaderPreferences({
            ...DEFAULT_READER_PREFERENCES
        });
    }

    function jumpTo(index: number) {
        if (!blocks.length) {
            return;
        }

        const next = Math.max(
            0,
            Math.min(
                blocks.length - 1,
                index
            )
        );

        setCurrentIndex(next);
        setWindowStart(
            Math.max(0, next - 5)
        );

        window.setTimeout(() => {
            document
                .getElementById(
                    `novel-block-${next}`
                )
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
        }, 0);
    }

    async function openTxt() {
        if (!novelAvailable) {
            onUpgrade();
            return;
        }

        try {
            setIsOpening(true);
            setStatus("Đang mở file TXT...");

            const result = await api.openNovelTxt?.();

            if (result?.canceled) {
                setStatus("Đã hủy chọn file.");
                return;
            }

            if (!result?.success || !result?.file) {
                throw new Error(
                    result?.error ||
                    "Không mở được file TXT."
                );
            }

            const parsed = parseNovelText(
                result.text || ""
            );

            if (!parsed.length) {
                throw new Error(
                    "Không tìm thấy đoạn văn nào trong file."
                );
            }

            const nextFile =
                result.file as NovelFileInfo;
            const saved = loadProgress(nextFile);
            const restoredIndex = Math.max(
                0,
                Math.min(
                    parsed.length - 1,
                    saved?.currentIndex || 0
                )
            );

            setFile(nextFile);
            setBlocks(parsed);
            setTranslations(
                saved?.translations || {}
            );
            setCurrentIndex(restoredIndex);
            setWindowStart(
                Math.max(0, restoredIndex - 5)
            );
            setStatus(
                saved
                    ? `Đã khôi phục vị trí đọc · đoạn ${restoredIndex + 1}/${parsed.length}.`
                    : `Đã mở ${parsed.length} đoạn văn.`
            );
        } catch (error) {
            setStatus(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsOpening(false);
        }
    }

    function buildContext(beforeIndex: number) {
        return blocks
            .slice(0, beforeIndex)
            .filter(
                (block) =>
                    Boolean(
                        translations[
                            String(block.index)
                        ]?.translatedText
                    )
            )
            .slice(-10)
            .map((block) => {
                const translatedText =
                    translations[
                        String(block.index)
                    ].translatedText;

                return {
                    original: block.text,
                    translatedText,
                    vietnamese: translatedText
                };
            });
    }

    async function translateFrom(
        requestedIndex: number,
        requestedCount = batchSize
    ) {
        if (!file || !blocks.length) {
            setStatus("Hãy mở file TXT trước.");
            return;
        }

        if (!backend.connected) {
            setStatus("Java backend hiện không kết nối được.");
            return;
        }

        if (!auth.authenticated) {
            setStatus("Bạn cần đăng nhập trước khi dịch novel.");
            return;
        }

        if (!novelAvailable) {
            onUpgrade();
            return;
        }

        if (!activeProfile) {
            setStatus("Chưa có Translation Profile.");
            return;
        }

        if (profileDirty) {
            setStatus(
                "Profile đang có thay đổi chưa lưu. Hãy lưu Profile trước khi dịch."
            );
            return;
        }

        let start = Math.max(
            0,
            Math.min(
                blocks.length - 1,
                requestedIndex
            )
        );

        if (requestedCount > 1) {
            while (
                start < blocks.length &&
                translations[String(start)]
            ) {
                start++;
            }
        }

        if (start >= blocks.length) {
            setStatus("Đã dịch tới cuối file.");
            return;
        }

        const selected = blocks.slice(
            start,
            Math.min(
                blocks.length,
                start + Math.max(1, requestedCount)
            )
        );

        try {
            setIsTranslating(true);
            setStatus(
                `Đang dịch đoạn ${start + 1}–${selected[selected.length - 1].index + 1}...`
            );

            const result =
                await api.translateNovelBlocks?.({
                    sourceLanguage,
                    targetLanguage,
                    context: buildContext(start),
                    blocks: selected.map(
                        (block) => ({
                            id: block.id,
                            text: block.text
                        })
                    )
                });

            if (
                !result?.success ||
                !Array.isArray(result?.translations)
            ) {
                throw new Error(
                    result?.error ||
                    "Backend không trả về bản dịch novel."
                );
            }

            const byId = new Map<string, any>(
                result.translations.map(
                    (item: any) => [
                        String(item.id),
                        item
                    ]
                )
            );

            setTranslations((current) => {
                const next = { ...current };

                for (const block of selected) {
                    const item = byId.get(block.id);
                    const translatedText = String(
                        item?.translatedText ||
                        item?.vietnamese ||
                        ""
                    ).trim();

                    if (translatedText) {
                        next[String(block.index)] = {
                            translatedText,
                            source: String(
                                item?.source || "AI"
                            )
                        };
                    }
                }

                return next;
            });

            const nextIndex = Math.min(
                blocks.length - 1,
                selected[selected.length - 1].index + 1
            );

            setCurrentIndex(nextIndex);
            setWindowStart(
                Math.max(0, start - 3)
            );

            const summary = result.summary || {};
            setStatus(
                `Đã dịch ${selected.length} đoạn · Memory ${summary.memoryHits || 0} · AI ${summary.aiBlocks || 0}.`
            );

            window.setTimeout(() => {
                document
                    .getElementById(
                        `novel-block-${start}`
                    )
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
            }, 0);
        } catch (error) {
            setStatus(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsTranslating(false);
        }
    }

    if (!novelAvailable) {
        return (
            <div className="page-stack novel-reader-page">
                <section className="novel-locked-card">
                    <span className="eyebrow violet">
                        NOVEL READER TXT
                    </span>

                    <h2>
                        Đọc và dịch novel là tính năng PRO
                    </h2>

                    <p>
                        FREE vẫn dùng Quick Translate. PRO mở Novel TXT,
                        Study Mode và Manga Session; MANGA+ mở thêm Continuous Manga.
                    </p>

                    <button
                        className="primary-action"
                        onClick={onUpgrade}
                    >
                        Xem Plan & License
                    </button>
                </section>
            </div>
        );
    }

    const progressPercent = blocks.length
        ? Math.round(
              ((currentIndex + 1) / blocks.length) * 100
          )
        : 0;

    const readerStyle = {
        "--novel-font-size": `${readerPreferences.fontSize}px`,
        "--novel-line-height": String(readerPreferences.lineHeight)
    } as CSSProperties;

    return (
        <div
            className={[
                "page-stack",
                "novel-reader-page",
                `reader-theme-${readerPreferences.theme}`,
                `reader-mode-${readerPreferences.mode}`,
                `reader-width-${readerPreferences.width}`
            ].join(" ")}
            style={readerStyle}
        >
            <section className="novel-reader-hero">
                <div>
                    <span className="eyebrow violet">
                        NOVEL READER TXT · PRO
                    </span>

                    <h2>
                        Đọc nguyên văn và bản dịch song song
                    </h2>

                    <p>
                        Chỉ gửi những đoạn bạn yêu cầu dịch. File TXT gốc
                        được đọc cục bộ trên Desktop và không upload toàn bộ lên server.
                    </p>
                </div>

                <button
                    className="scan-primary"
                    onClick={() => void openTxt()}
                    disabled={isOpening || isTranslating}
                >
                    {isOpening ? "Đang mở..." : "Mở file TXT"}
                </button>
            </section>

            <section className="novel-reader-toolbar">
                <label className="control-field">
                    <span>Translation Profile</span>
                    <select
                        value={activeProfile?.id ?? ""}
                        disabled={!profiles.length || isTranslating}
                        onChange={(event) => {
                            onSelectProfile(
                                Number(event.target.value)
                            );
                        }}
                    >
                        {profiles.map((profile) => (
                            <option
                                key={profile.id}
                                value={profile.id}
                            >
                                {profile.name}
                                {profile.defaultProfile
                                    ? " · Default"
                                    : ""}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="control-field">
                    <span>Ngôn ngữ nguồn</span>
                    <select
                        value={sourceLanguage}
                        disabled={isTranslating}
                        onChange={(event) => {
                            onSourceLanguageChange(
                                event.target.value as TranslationLanguage
                            );
                        }}
                    >
                        {sourceTranslationLanguages.map(
                            (language) => (
                                <option
                                    key={language}
                                    value={language}
                                >
                                    {translationLanguageLabels[language]}
                                </option>
                            )
                        )}
                    </select>
                </label>

                <label className="control-field">
                    <span>Dịch sang</span>
                    <select
                        value={targetLanguage}
                        disabled={isTranslating}
                        onChange={(event) => {
                            onTargetLanguageChange(
                                event.target.value as TargetTranslationLanguage
                            );
                        }}
                    >
                        {targetTranslationLanguages.map(
                            (language) => (
                                <option
                                    key={language}
                                    value={language}
                                >
                                    {translationLanguageLabels[language]}
                                </option>
                            )
                        )}
                    </select>
                </label>

                <label className="control-field compact-novel-batch">
                    <span>Mỗi lần dịch</span>
                    <select
                        value={batchSize}
                        disabled={isTranslating}
                        onChange={(event) => {
                            setBatchSize(
                                Number(event.target.value)
                            );
                        }}
                    >
                        {[3, 4, 6, 8].map((value) => (
                            <option key={value} value={value}>
                                {value} đoạn
                            </option>
                        ))}
                    </select>
                </label>
            </section>

            <section className="novel-reading-controls">
                <div className="novel-reading-control-group">
                    <span className="novel-control-label">Theme đọc</span>
                    <div className="novel-segmented-control" role="group" aria-label="Theme đọc">
                        {([
                            ["light", "Light"],
                            ["sepia", "Sepia"],
                            ["dark", "Dark"]
                        ] as const).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                className={
                                    readerPreferences.theme === value
                                        ? "active"
                                        : ""
                                }
                                onClick={() => {
                                    updateReaderPreference(
                                        "theme",
                                        value
                                    );
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="novel-reading-control-group novel-reading-mode-control">
                    <span className="novel-control-label">Hiển thị</span>
                    <div className="novel-segmented-control" role="group" aria-label="Chế độ hiển thị">
                        {([
                            ["parallel", "2 cột"],
                            ["translation", "Bản dịch"],
                            ["source", "Nguyên văn"]
                        ] as const).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                className={
                                    readerPreferences.mode === value
                                        ? "active"
                                        : ""
                                }
                                onClick={() => {
                                    updateReaderPreference(
                                        "mode",
                                        value
                                    );
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <label className="novel-reading-range">
                    <span>
                        Cỡ chữ
                        <strong>{readerPreferences.fontSize}px</strong>
                    </span>
                    <input
                        type="range"
                        min="14"
                        max="24"
                        step="1"
                        value={readerPreferences.fontSize}
                        onChange={(event) => {
                            updateReaderPreference(
                                "fontSize",
                                Number(event.target.value)
                            );
                        }}
                    />
                </label>

                <label className="novel-reading-range">
                    <span>
                        Giãn dòng
                        <strong>{readerPreferences.lineHeight.toFixed(1)}</strong>
                    </span>
                    <input
                        type="range"
                        min="1.5"
                        max="2.2"
                        step="0.1"
                        value={readerPreferences.lineHeight}
                        onChange={(event) => {
                            updateReaderPreference(
                                "lineHeight",
                                Number(event.target.value)
                            );
                        }}
                    />
                </label>

                <label className="control-field novel-reading-width">
                    <span>Độ rộng trang</span>
                    <select
                        value={readerPreferences.width}
                        onChange={(event) => {
                            updateReaderPreference(
                                "width",
                                event.target.value as NovelReaderWidth
                            );
                        }}
                    >
                        <option value="compact">Gọn</option>
                        <option value="comfortable">Dễ đọc</option>
                        <option value="wide">Rộng</option>
                    </select>
                </label>

                <button
                    type="button"
                    className="secondary-action novel-reader-reset"
                    onClick={resetReaderPreferences}
                >
                    Reset đọc
                </button>
            </section>

            {file && (
                <section className="novel-file-card">
                    <div className="novel-file-main">
                        <div className="novel-file-icon">TXT</div>
                        <div>
                            <strong>{file.name}</strong>
                            <span>
                                {formatFileSize(file.sizeBytes)} · {file.encoding}
                                {chapters.length
                                    ? ` · ${chapters.length} chapter`
                                    : " · Không có chapter marker"}
                            </span>
                        </div>
                    </div>

                    <div className="novel-progress-summary">
                        <strong>{progressPercent}%</strong>
                        <span>
                            Đoạn {currentIndex + 1}/{blocks.length} · đã dịch {translatedCount}
                        </span>
                    </div>

                    <div className="novel-progress-track">
                        <span
                            style={{
                                width: `${progressPercent}%`
                            }}
                        />
                    </div>
                </section>
            )}

            {file && (
                <section className="novel-reader-actions">
                    <div className="novel-reader-action-group">
                        <button
                            className="secondary-action"
                            onClick={() => {
                                jumpTo(
                                    Math.max(0, currentIndex - 20)
                                );
                            }}
                            disabled={currentIndex <= 0 || isTranslating}
                        >
                            ← 20 đoạn
                        </button>

                        <button
                            className="secondary-action"
                            onClick={() => {
                                jumpTo(
                                    Math.min(
                                        blocks.length - 1,
                                        currentIndex + 20
                                    )
                                );
                            }}
                            disabled={
                                currentIndex >= blocks.length - 1 ||
                                isTranslating
                            }
                        >
                            20 đoạn →
                        </button>
                    </div>

                    {chapters.length > 0 && (
                        <label className="control-field novel-chapter-select">
                            <span>Chapter</span>
                            <select
                                value=""
                                disabled={isTranslating}
                                onChange={(event) => {
                                    if (event.target.value) {
                                        jumpTo(
                                            Number(event.target.value)
                                        );
                                    }
                                }}
                            >
                                <option value="">Nhảy tới...</option>
                                {chapters.map((chapter) => (
                                    <option
                                        key={chapter.id}
                                        value={chapter.index}
                                    >
                                        {chapter.text}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    <button
                        className="primary-action novel-translate-next"
                        onClick={() => {
                            void translateFrom(currentIndex);
                        }}
                        disabled={
                            isTranslating ||
                            !backend.connected ||
                            !auth.authenticated ||
                            !activeProfile ||
                            profileDirty
                        }
                    >
                        {isTranslating
                            ? "Đang dịch..."
                            : `Dịch ${batchSize} đoạn tiếp`}
                    </button>
                </section>
            )}

            <div
                className={
                    status.toLowerCase().includes("lỗi") ||
                    status.toLowerCase().includes("không")
                        ? "notice warning"
                        : "notice info"
                }
            >
                {status}
            </div>

            {file && (
                <section className="novel-reader-list">
                    <div className="novel-reader-column-head">
                        <span>Nguyên văn</span>
                        <span>Bản dịch</span>
                    </div>

                    {visibleBlocks.map((block) => {
                        const translated =
                            translations[String(block.index)];
                        const isCurrent =
                            block.index === currentIndex;

                        return (
                            <article
                                id={`novel-block-${block.index}`}
                                key={block.id}
                                className={[
                                    "novel-reader-row",
                                    block.heading ? "heading" : "",
                                    isCurrent ? "current" : ""
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                                onClick={() => {
                                    setCurrentIndex(block.index);
                                }}
                            >
                                <div className="novel-source-pane">
                                    <div className="novel-row-meta">
                                        <span>#{block.index + 1}</span>
                                        {block.heading && (
                                            <span className="novel-heading-chip">
                                                CHAPTER
                                            </span>
                                        )}
                                    </div>
                                    <p>{block.text}</p>
                                </div>

                                <div className="novel-translation-pane">
                                    {translated ? (
                                        <>
                                            <div className="novel-row-meta">
                                                <span>
                                                    {translated.source ===
                                                    "PERSONAL_MEMORY"
                                                        ? "Memory"
                                                        : "AI"}
                                                </span>
                                            </div>
                                            <p>{translated.translatedText}</p>
                                        </>
                                    ) : (
                                        <div className="novel-empty-translation">
                                            <span>Chưa dịch</span>
                                            <button
                                                className="text-action"
                                                disabled={isTranslating}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setCurrentIndex(block.index);
                                                    void translateFrom(
                                                        block.index,
                                                        1
                                                    );
                                                }}
                                            >
                                                Dịch đoạn này
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </article>
                        );
                    })}

                    <div className="novel-window-footer">
                        <button
                            className="secondary-action"
                            disabled={windowStart <= 0}
                            onClick={() => {
                                const next = Math.max(
                                    0,
                                    windowStart - READER_WINDOW_SIZE
                                );
                                setWindowStart(next);
                                setCurrentIndex(next);
                            }}
                        >
                            ← Trang đọc trước
                        </button>

                        <span>
                            Hiển thị {windowStart + 1}–
                            {Math.min(
                                blocks.length,
                                windowStart + READER_WINDOW_SIZE
                            )}
                            /{blocks.length}
                        </span>

                        <button
                            className="secondary-action"
                            disabled={
                                windowStart + READER_WINDOW_SIZE >=
                                blocks.length
                            }
                            onClick={() => {
                                const next = Math.min(
                                    Math.max(
                                        0,
                                        blocks.length - 1
                                    ),
                                    windowStart + READER_WINDOW_SIZE
                                );
                                setWindowStart(next);
                                setCurrentIndex(next);
                            }}
                        >
                            Trang đọc sau →
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}

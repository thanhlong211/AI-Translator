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

import {
    normalizeDocumentReaderBlocks,
    normalizeDocumentReaderPayload
} from "../app/documentReader";

import type {
    DocumentReaderBlock,
    DocumentReaderFileInfo,
    DocumentReaderFormat,
    DocumentReaderOpenPayload
} from "../app/documentReader";

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

type NovelDocumentFormat = DocumentReaderFormat;
type NovelFileInfo = DocumentReaderFileInfo;
type NovelBlock = DocumentReaderBlock;
type NovelOpenPayload = DocumentReaderOpenPayload;

interface NovelTranslation {
    translatedText: string;
    source: string;
    sourceLanguage?: TranslationLanguage;
    targetLanguage?: TargetTranslationLanguage;
}

interface SavedNovelProgress {
    modifiedAt: string;
    currentIndex: number;
    updatedAt: number;
    translations: Record<string, NovelTranslation>;
}

interface NovelLibraryEntry {
    path: string;
    name: string;
    sizeBytes: number;
    modifiedAt: string;
    encoding: string;
    format: NovelDocumentFormat;
    title: string;
    author: string;
    language: string;
    totalBlocks: number;
    chapterCount: number;
    currentIndex: number;
    currentChapter: string;
    bookmarks: number[];
    lastOpenedAt: number;
    sourceLanguage: TranslationLanguage;
    targetLanguage: TargetTranslationLanguage;
    profileId: number | null;
    readerPreferences: NovelReaderPreferences;
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


type NovelReaderFontPreset =
    | "auto"
    | "serif"
    | "sans"
    | "jp-gothic"
    | "jp-mincho"
    | "system"
    | "custom";

interface NovelReaderFontSettings {
    preset: NovelReaderFontPreset;
    customFamily: string;
}

const NOVEL_READER_FONT_SETTINGS_KEY =
    "aiTranslator.novelReader.fontSettings.v1";

const NOVEL_READER_FONT_SETTINGS_EVENT =
    "ai-translator:novel-font-settings";

const DEFAULT_NOVEL_READER_FONT_SETTINGS: NovelReaderFontSettings = {
    preset: "auto",
    customFamily: ""
};

function loadNovelReaderFontSettings(): NovelReaderFontSettings {
    try {
        const raw = localStorage.getItem(
            NOVEL_READER_FONT_SETTINGS_KEY
        );

        if (!raw) {
            return DEFAULT_NOVEL_READER_FONT_SETTINGS;
        }

        const parsed = JSON.parse(raw) as Partial<NovelReaderFontSettings>;
        const allowed: NovelReaderFontPreset[] = [
            "auto",
            "serif",
            "sans",
            "jp-gothic",
            "jp-mincho",
            "system",
            "custom"
        ];

        return {
            preset: allowed.includes(
                parsed.preset as NovelReaderFontPreset
            )
                ? parsed.preset as NovelReaderFontPreset
                : "auto",
            customFamily:
                typeof parsed.customFamily === "string"
                    ? parsed.customFamily.slice(0, 160)
                    : ""
        };
    } catch {
        return DEFAULT_NOVEL_READER_FONT_SETTINGS;
    }
}

function novelReaderFontStack(
    settings: NovelReaderFontSettings
) {
    switch (settings.preset) {
        case "serif":
            return 'Georgia, "Times New Roman", "Yu Mincho", "Noto Serif JP", serif';
        case "sans":
            return '"Segoe UI", Arial, "Yu Gothic UI", Meiryo, "Noto Sans JP", sans-serif';
        case "jp-gothic":
            return '"Yu Gothic UI", "Yu Gothic", Meiryo, "Noto Sans JP", sans-serif';
        case "jp-mincho":
            return '"Yu Mincho", "MS PMincho", "Noto Serif JP", serif';
        case "system":
            return 'system-ui, -apple-system, "Segoe UI", sans-serif';
        case "custom": {
            const custom = settings.customFamily.trim();
            return custom
                ? `${custom}, "Yu Gothic UI", Meiryo, "Segoe UI", sans-serif`
                : '"Segoe UI", "Yu Gothic UI", Meiryo, sans-serif';
        }
        default:
            return '"Segoe UI", "Yu Gothic UI", "Yu Gothic", Meiryo, "Noto Sans JP", sans-serif';
    }
}

const NOVEL_READER_PREFERENCES_KEY =
    "aiTranslator.novelReader.preferences.v1";

const NOVEL_LIBRARY_KEY =
    "aiTranslator.novelReader.library.v1";

const MAX_LIBRARY_ITEMS = 50;

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

function loadNovelLibrary(): NovelLibraryEntry[] {
    try {
        const raw = localStorage.getItem(
            NOVEL_LIBRARY_KEY
        );

        if (!raw) {
            return [];
        }

        const items = JSON.parse(raw) as NovelLibraryEntry[];

        if (!Array.isArray(items)) {
            return [];
        }

        return items
            .filter(
                (item) =>
                    Boolean(item?.path && item?.name)
            )
            .map((item) => ({
                ...item,
                bookmarks: Array.isArray(item.bookmarks)
                    ? item.bookmarks.filter(Number.isFinite)
                    : [],
                format: (item.format === "EPUB" ? "EPUB" : "TXT") as NovelDocumentFormat,
                title: item.title || item.name.replace(/\.(txt|epub)$/i, ""),
                author: item.author || "",
                language: item.language || "",
                sourceLanguage: item.sourceLanguage || "AUTO",
                targetLanguage: item.targetLanguage || "VI",
                profileId: Number.isFinite(item.profileId)
                    ? item.profileId
                    : null,
                readerPreferences: {
                    ...DEFAULT_READER_PREFERENCES,
                    ...(item.readerPreferences || {})
                }
            }))
            .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
            .slice(0, MAX_LIBRARY_ITEMS);
    } catch {
        return [];
    }
}

function saveNovelLibrary(items: NovelLibraryEntry[]) {
    try {
        localStorage.setItem(
            NOVEL_LIBRARY_KEY,
            JSON.stringify(
                items
                    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
                    .slice(0, MAX_LIBRARY_ITEMS)
            )
        );
    } catch {
        // Local library is best-effort only.
    }
}

function chapterAtIndex(
    blocks: NovelBlock[],
    index: number
) {
    for (
        let cursor = Math.min(index, blocks.length - 1);
        cursor >= 0;
        cursor--
    ) {
        if (blocks[cursor]?.heading) {
            return blocks[cursor].text;
        }
    }

    return "Chưa xác định chapter";
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
    status: "Mở hoặc thêm TXT / EPUB để bắt đầu đọc."
};

function translationMatchesLanguagePair(
    translation: NovelTranslation | undefined,
    sourceLanguage: TranslationLanguage,
    targetLanguage: TargetTranslationLanguage
) {
    if (!translation?.translatedText) {
        return false;
    }

    // Batch 13/13.1 cache entries did not store language metadata.
    // Those historical entries were Vietnamese by default. Treat them as VI
    // so switching to EN/other targets never reuses stale Vietnamese output.
    const savedTarget = translation.targetLanguage || "VI";

    if (savedTarget !== targetLanguage) {
        return false;
    }

    if (
        translation.sourceLanguage &&
        sourceLanguage !== "AUTO" &&
        translation.sourceLanguage !== "AUTO" &&
        translation.sourceLanguage !== sourceLanguage
    ) {
        return false;
    }

    return true;
}

function languageToHtmlLang(
    language: TranslationLanguage | TargetTranslationLanguage,
    text = ""
) {
    switch (language) {
        case "JA": return "ja";
        case "EN": return "en";
        case "VI": return "vi";
        case "KO": return "ko";
        case "ZH": return "zh-Hans";
        case "ZH_TW": return "zh-Hant";
        case "FR": return "fr";
        case "DE": return "de";
        case "ES": return "es";
        case "TH": return "th";
        case "ID": return "id";
        default:
            if (/[ぁ-んァ-ヶー]/u.test(text)) return "ja";
            if (/[가-힣]/u.test(text)) return "ko";
            if (/[\u3400-\u9FFF]/u.test(text)) return "zh";
            return "und";
    }
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
        readerFontSettings,
        setReaderFontSettings
    ] = useState<NovelReaderFontSettings>(
        loadNovelReaderFontSettings
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


    const [
        library,
        setLibrary
    ] = useState<NovelLibraryEntry[]>(
        loadNovelLibrary
    );

    const [
        librarySearch,
        setLibrarySearch
    ] = useState("");

    const [
        novelSearch,
        setNovelSearch
    ] = useState("");

    const [
        searchCursor,
        setSearchCursor
    ] = useState(0);

    const txtAvailable = Boolean(
        entitlements.features.novelReaderTxt
    );

    const epubAvailable = Boolean(
        entitlements.features.novelReaderEpub
    );

    const novelAvailable = txtAvailable || epubAvailable;

    const chapters = useMemo(
        () =>
            blocks.filter(
                (block) => block.heading
            ),
        [blocks]
    );

    const translatedCount = useMemo(
        () => Object.values(translations).filter(
            (translation) =>
                translationMatchesLanguagePair(
                    translation,
                    sourceLanguage,
                    targetLanguage
                )
        ).length,
        [translations, sourceLanguage, targetLanguage]
    );

    const visibleBlocks = useMemo(
        () =>
            blocks.slice(
                windowStart,
                windowStart + READER_WINDOW_SIZE
            ),
        [blocks, windowStart]
    );


    const activeLibraryEntry = useMemo(
        () =>
            file
                ? library.find(
                      (entry) => entry.path === file.path
                  ) || null
                : null,
        [file, library]
    );

    const filteredLibrary = useMemo(() => {
        const query = librarySearch.trim().toLowerCase();

        if (!query) {
            return library;
        }

        return library.filter(
            (entry) =>
                entry.name.toLowerCase().includes(query) ||
                entry.currentChapter.toLowerCase().includes(query)
        );
    }, [library, librarySearch]);

    const novelSearchMatches = useMemo(() => {
        const query = novelSearch.trim().toLowerCase();

        if (!query) {
            return [] as number[];
        }

        return blocks
            .filter((block) =>
                block.text.toLowerCase().includes(query) ||
                String(
                    translations[String(block.index)]?.translatedText || ""
                )
                    .toLowerCase()
                    .includes(query)
            )
            .map((block) => block.index);
    }, [blocks, translations, novelSearch]);

    useEffect(() => {
        const refreshFontSettings = () => {
            setReaderFontSettings(
                loadNovelReaderFontSettings()
            );
        };

        const handleStorage = (event: StorageEvent) => {
            if (
                event.key === NOVEL_READER_FONT_SETTINGS_KEY ||
                event.key === null
            ) {
                refreshFontSettings();
            }
        };

        window.addEventListener(
            NOVEL_READER_FONT_SETTINGS_EVENT,
            refreshFontSettings
        );
        window.addEventListener(
            "storage",
            handleStorage
        );

        return () => {
            window.removeEventListener(
                NOVEL_READER_FONT_SETTINGS_EVENT,
                refreshFontSettings
            );
            window.removeEventListener(
                "storage",
                handleStorage
            );
        };
    }, []);

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


    useEffect(() => {
        saveNovelLibrary([...library]);
    }, [library]);

    useEffect(() => {
        if (!file || !blocks.length) {
            return;
        }

        setLibrary((current) =>
            current.map((entry) =>
                entry.path === file.path
                    ? {
                          ...entry,
                          currentIndex,
                          currentChapter: chapterAtIndex(
                              blocks,
                              currentIndex
                          ),
                          sourceLanguage,
                          targetLanguage,
                          profileId: activeProfile?.id ?? null,
                          readerPreferences
                      }
                    : entry
            )
        );
    }, [
        file,
        blocks,
        currentIndex,
        sourceLanguage,
        targetLanguage,
        activeProfile?.id,
        readerPreferences
    ]);

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

    function upsertLibraryItem(
        nextFile: NovelFileInfo,
        parsed: NovelBlock[],
        options?: Partial<NovelLibraryEntry>
    ) {
        setLibrary((current) => {
            const existing = current.find(
                (entry) => entry.path === nextFile.path
            );
            const now = Date.now();
            const next: NovelLibraryEntry = {
                path: nextFile.path,
                name: nextFile.name,
                sizeBytes: nextFile.sizeBytes,
                modifiedAt: nextFile.modifiedAt,
                encoding: nextFile.encoding,
                format: nextFile.format === "EPUB" ? "EPUB" : "TXT",
                title:
                    nextFile.title ||
                    existing?.title ||
                    nextFile.name.replace(/\.(txt|epub)$/i, ""),
                author: nextFile.author || existing?.author || "",
                language: nextFile.language || existing?.language || "",
                totalBlocks: parsed.length,
                chapterCount: parsed.filter(
                    (block) => block.heading
                ).length,
                currentIndex: options?.currentIndex ?? existing?.currentIndex ?? 0,
                currentChapter:
                    options?.currentChapter ||
                    existing?.currentChapter ||
                    chapterAtIndex(parsed, 0),
                bookmarks:
                    options?.bookmarks ||
                    existing?.bookmarks ||
                    [],
                lastOpenedAt:
                    options?.lastOpenedAt ||
                    existing?.lastOpenedAt ||
                    now,
                sourceLanguage:
                    options?.sourceLanguage ||
                    existing?.sourceLanguage ||
                    sourceLanguage,
                targetLanguage:
                    options?.targetLanguage ||
                    existing?.targetLanguage ||
                    targetLanguage,
                profileId:
                    options?.profileId ??
                    existing?.profileId ??
                    activeProfile?.id ??
                    null,
                readerPreferences:
                    options?.readerPreferences ||
                    existing?.readerPreferences ||
                    readerPreferences
            };

            return [
                next,
                ...current.filter(
                    (entry) => entry.path !== nextFile.path
                )
            ].slice(0, MAX_LIBRARY_ITEMS);
        });
    }

    function applyNovelSettings(entry: NovelLibraryEntry | null) {
        if (!entry) {
            return;
        }

        onSourceLanguageChange(entry.sourceLanguage || "AUTO");
        onTargetLanguageChange(entry.targetLanguage || "VI");

        if (
            entry.profileId &&
            profiles.some((profile) => profile.id === entry.profileId)
        ) {
            onSelectProfile(entry.profileId);
        }

        if (entry.readerPreferences) {
            setReaderPreferences({
                ...DEFAULT_READER_PREFERENCES,
                ...entry.readerPreferences
            });
        }
    }

    function loadNovelPayload(
        payload: NovelOpenPayload,
        knownEntry?: NovelLibraryEntry | null
    ) {
        const normalizedPayload =
            normalizeDocumentReaderPayload(payload);

        if (!normalizedPayload?.success || !normalizedPayload.file) {
            throw new Error(
                "Không mở được tài liệu Novel."
            );
        }
        const parsed = normalizeDocumentReaderBlocks(
            normalizedPayload.blocks
        );

        if (!parsed.length) {
            throw new Error(
                "Không tìm thấy đoạn văn nào trong tài liệu."
            );
        }

        const nextFile = normalizedPayload.file;
        const saved = loadProgress(nextFile);
        const restoredIndex = Math.max(
            0,
            Math.min(
                parsed.length - 1,
                saved?.currentIndex ??
                    knownEntry?.currentIndex ??
                    0
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
        setNovelSearch("");
        setSearchCursor(0);
        applyNovelSettings(knownEntry || null);
        upsertLibraryItem(
            nextFile,
            parsed,
            {
                ...(knownEntry || {}),
                currentIndex: restoredIndex,
                currentChapter: chapterAtIndex(
                    parsed,
                    restoredIndex
                ),
                lastOpenedAt: Date.now()
            }
        );
        setStatus(
            saved || knownEntry
                ? `Tiếp tục đọc · đoạn ${restoredIndex + 1}/${parsed.length}.`
                : `Đã mở ${parsed.length} đoạn văn.`
        );
    }

    async function openTxt() {
        if (!txtAvailable) {
            onUpgrade();
            return;
        }

        try {
            setIsOpening(true);
            setStatus("Đang thêm novel vào thư viện...");

            const result = api.openNovelDocument
                ? await api.openNovelDocument("TXT")
                : await api.openNovelTxt?.();

            if (result?.canceled) {
                setStatus("Đã hủy chọn file.");
                return;
            }

            const items: NovelOpenPayload[] =
                Array.isArray(result?.files) && result.files.length
                    ? result.files
                    : [result];

            let firstPayload: NovelOpenPayload | null = null;

            for (const item of items) {
                if (!item?.success || !item.file) {
                    continue;
                }

                const parsed = normalizeDocumentReaderBlocks(
                    item.blocks
                );
                if (!parsed.length) {
                    continue;
                }

                upsertLibraryItem(item.file, parsed, {
                    lastOpenedAt: Date.now()
                });

                firstPayload ||= item;
            }

            if (!firstPayload) {
                throw new Error(
                    result?.error ||
                    "Không mở được file TXT nào."
                );
            }

            loadNovelPayload(
                firstPayload,
                library.find(
                    (entry) =>
                        entry.path === firstPayload?.file?.path
                ) || null
            );
            setStatus(
                items.length > 1
                    ? `Đã thêm ${items.length} novel vào thư viện và mở ${firstPayload.file?.name}.`
                    : `Đã thêm ${firstPayload.file?.name} vào thư viện.`
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

    async function openEpub() {
        if (!epubAvailable) {
            onUpgrade();
            return;
        }

        try {
            setIsOpening(true);
            setStatus("Đang thêm EPUB vào thư viện...");

            const result = api.openNovelDocument
                ? await api.openNovelDocument("EPUB")
                : await api.openNovelEpub?.();

            if (result?.canceled) {
                setStatus("Đã hủy chọn EPUB.");
                return;
            }

            const items: NovelOpenPayload[] =
                Array.isArray(result?.files) && result.files.length
                    ? result.files
                    : [result];

            let firstPayload: NovelOpenPayload | null = null;
            let addedCount = 0;

            for (const item of items) {
                if (!item?.success || !item.file) {
                    continue;
                }

                const parsed = normalizeDocumentReaderBlocks(
                    item.blocks
                );

                if (!parsed.length) {
                    continue;
                }

                upsertLibraryItem(item.file, parsed, {
                    lastOpenedAt: Date.now()
                });

                addedCount++;
                firstPayload ||= item;
            }

            if (!firstPayload) {
                throw new Error(
                    result?.error ||
                    "Không mở được file EPUB nào."
                );
            }

            loadNovelPayload(
                firstPayload,
                library.find(
                    (entry) =>
                        entry.path === firstPayload?.file?.path
                ) || null
            );
            setStatus(
                addedCount > 1
                    ? `Đã thêm ${addedCount} EPUB vào thư viện và mở ${firstPayload.file?.title || firstPayload.file?.name}.`
                    : `Đã thêm ${firstPayload.file?.title || firstPayload.file?.name} vào thư viện.`
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

    async function openLibraryNovel(entry: NovelLibraryEntry) {
        const canOpen = entry.format === "EPUB"
            ? epubAvailable
            : txtAvailable;

        if (!canOpen) {
            onUpgrade();
            return;
        }

        try {
            setIsOpening(true);
            setStatus(`Đang mở ${entry.name}...`);

            const result = api.readNovelDocument
                ? await api.readNovelDocument(
                      entry.path,
                      entry.format
                  )
                : entry.format === "EPUB"
                    ? await api.readNovelEpub?.(entry.path)
                    : await api.readNovelTxt?.(entry.path);

            loadNovelPayload(result, entry);
        } catch (error) {
            setStatus(
                `Không mở lại được ${entry.name}. File có thể đã bị di chuyển hoặc xóa. ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        } finally {
            setIsOpening(false);
        }
    }

    function removeLibraryNovel(path: string) {
        setLibrary((current) =>
            current.filter((entry) => entry.path !== path)
        );

        if (file?.path === path) {
            setFile(null);
            setBlocks([]);
            setTranslations({});
            setCurrentIndex(0);
            setWindowStart(0);
            setStatus(
                "Đã gỡ novel khỏi thư viện. File gốc trên máy không bị xóa."
            );
        }
    }

    function toggleBookmark(index: number) {
        if (!file) {
            return;
        }

        setLibrary((current) =>
            current.map((entry) => {
                if (entry.path !== file.path) {
                    return entry;
                }

                const exists = entry.bookmarks.includes(index);
                return {
                    ...entry,
                    bookmarks: exists
                        ? entry.bookmarks.filter(
                              (value) => value !== index
                          )
                        : [...entry.bookmarks, index].sort((a, b) => a - b)
                };
            })
        );
    }

    function jumpSearch(direction: 1 | -1) {
        if (!novelSearchMatches.length) {
            return;
        }

        const nextCursor =
            (searchCursor + direction + novelSearchMatches.length) %
            novelSearchMatches.length;
        setSearchCursor(nextCursor);
        jumpTo(novelSearchMatches[nextCursor]);
    }

    function buildContext(beforeIndex: number) {
        return blocks
            .slice(0, beforeIndex)
            .filter(
                (block) =>
                    Boolean(
                        translationMatchesLanguagePair(
                            translations[String(block.index)],
                            sourceLanguage,
                            targetLanguage
                        )
                    )
            )
            .slice(-10)
            .map((block) => {
                const translatedText =
                    translations[String(block.index)]
                        .translatedText;

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
            setStatus("Hãy mở TXT hoặc EPUB trước.");
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
                translationMatchesLanguagePair(
                    translations[String(start)],
                    sourceLanguage,
                    targetLanguage
                )
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
                    format: file.format || "TXT",
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
                            ),
                            sourceLanguage,
                            targetLanguage
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
                        NOVEL READER
                    </span>

                    <h2>
                        Đọc và dịch novel là tính năng PRO
                    </h2>

                    <p>
                        FREE vẫn dùng Quick Translate. PRO mở Novel Reader TXT/EPUB,
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
        "--novel-line-height": String(readerPreferences.lineHeight),
        "--novel-reader-font-family": novelReaderFontStack(
            readerFontSettings
        )
    } as CSSProperties;

    return (
        <div
            className={[
                "page-stack",
                "novel-reader-page",
                `reader-theme-${readerPreferences.theme}`,
                `reader-mode-${readerPreferences.mode}`,
                `reader-width-${readerPreferences.width}`,
                `reader-font-${readerFontSettings.preset}`
            ].join(" ")}
            style={readerStyle}
        >
            <section className="novel-reader-hero">
                <div>
                    <span className="eyebrow violet">
                        NOVEL READER · TXT + EPUB · PRO
                    </span>

                    <h2>
                        Đọc nguyên văn và bản dịch song song
                    </h2>

                    <p>
                        TXT và EPUB được đọc cục bộ trên Desktop. Chỉ những đoạn
                        bạn yêu cầu dịch mới được gửi backend; toàn bộ sách không bị upload.
                    </p>
                </div>

                <div className="novel-reader-import-actions">
                    <button
                        className="secondary-action"
                        onClick={() => void openTxt()}
                        disabled={isOpening || isTranslating || !txtAvailable}
                        title={!txtAvailable ? "TXT yêu cầu gói PRO" : "Thêm TXT"}
                    >
                        + TXT
                    </button>
                    <button
                        className="scan-primary"
                        onClick={() => void openEpub()}
                        disabled={isOpening || isTranslating || !epubAvailable}
                        title={!epubAvailable ? "EPUB yêu cầu gói PRO" : "Thêm EPUB"}
                    >
                        {isOpening ? "Đang thêm..." : "+ EPUB"}
                    </button>
                </div>
            </section>

            <section className="novel-library-card">
                <div className="novel-library-header">
                    <div>
                        <span className="eyebrow">NOVEL LIBRARY</span>
                        <h3>Thư viện của bạn</h3>
                        <p>
                            {library.length} tài liệu · TXT/EPUB lưu cục bộ · không xóa file gốc khi gỡ khỏi Library.
                        </p>
                    </div>

                    <label className="novel-library-search">
                        <span>Tìm novel</span>
                        <input
                            value={librarySearch}
                            placeholder="Tên novel hoặc chapter..."
                            onChange={(event) => {
                                setLibrarySearch(event.target.value);
                            }}
                        />
                    </label>
                </div>

                {filteredLibrary.length ? (
                    <div className="novel-library-grid">
                        {filteredLibrary.map((entry) => {
                            const percent = entry.totalBlocks
                                ? Math.round(
                                      ((entry.currentIndex + 1) /
                                          entry.totalBlocks) *
                                          100
                                  )
                                : 0;
                            const active = file?.path === entry.path;

                            return (
                                <article
                                    className={
                                        active
                                            ? "novel-library-item active"
                                            : "novel-library-item"
                                    }
                                    key={entry.path}
                                >
                                    <div className={`novel-library-cover ${entry.format.toLowerCase()}`}>{entry.format}</div>
                                    <div className="novel-library-item-main">
                                        <strong title={entry.title || entry.name}>
                                            {entry.title || entry.name}
                                        </strong>
                                        {entry.author && (
                                            <span className="novel-library-author">
                                                {entry.author}
                                            </span>
                                        )}
                                        <span>
                                            {percent}% · {entry.currentChapter}
                                        </span>
                                        <small>
                                            {entry.format} · {entry.chapterCount} chapter · {entry.bookmarks.length} bookmark · {translationLanguageLabels[entry.targetLanguage]}
                                        </small>
                                        <div className="novel-library-progress">
                                            <span style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                    <div className="novel-library-actions">
                                        <button
                                            className="primary-action compact"
                                            disabled={isOpening || isTranslating}
                                            onClick={() => {
                                                void openLibraryNovel(entry);
                                            }}
                                        >
                                            {active ? "Đang đọc" : "Tiếp tục"}
                                        </button>
                                        <button
                                            className="text-action danger-text"
                                            disabled={isOpening || isTranslating}
                                            onClick={() => {
                                                removeLibraryNovel(entry.path);
                                            }}
                                        >
                                            Gỡ
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="novel-library-empty">
                        {library.length
                            ? "Không tìm thấy novel phù hợp."
                            : "Chưa có novel. Bấm + Thêm TXT và có thể chọn nhiều file cùng lúc."}
                    </div>
                )}
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
                            const nextLanguage =
                                event.target.value as TranslationLanguage;

                            onSourceLanguageChange(nextLanguage);
                            setStatus(
                                `Đã chuyển ngôn ngữ nguồn sang ${translationLanguageLabels[nextLanguage]}.`
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
                            const nextLanguage =
                                event.target.value as TargetTranslationLanguage;

                            onTargetLanguageChange(nextLanguage);

                            const firstMissing = blocks.findIndex(
                                (block) =>
                                    !translationMatchesLanguagePair(
                                        translations[String(block.index)],
                                        sourceLanguage,
                                        nextLanguage
                                    )
                            );

                            if (firstMissing >= 0) {
                                setCurrentIndex(firstMissing);
                                setWindowStart(
                                    Math.max(0, firstMissing - 3)
                                );
                            }

                            setStatus(
                                `Đã chuyển ngôn ngữ đích sang ${translationLanguageLabels[nextLanguage]}. Reader đã chuyển tới đoạn cần dịch bằng ngôn ngữ mới.`
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
                <section className="novel-reader-navigation-card">
                    <label className="novel-text-search">
                        <span>Tìm trong novel</span>
                        <input
                            value={novelSearch}
                            placeholder="Tìm nguyên văn hoặc bản dịch..."
                            onChange={(event) => {
                                setNovelSearch(event.target.value);
                                setSearchCursor(0);
                            }}
                        />
                    </label>

                    <div className="novel-search-actions">
                        <span>
                            {novelSearch.trim()
                                ? `${novelSearchMatches.length} kết quả`
                                : "Nhập từ khóa để tìm"}
                        </span>
                        <button
                            className="secondary-action compact"
                            disabled={!novelSearchMatches.length}
                            onClick={() => jumpSearch(-1)}
                        >
                            ← Trước
                        </button>
                        <button
                            className="secondary-action compact"
                            disabled={!novelSearchMatches.length}
                            onClick={() => jumpSearch(1)}
                        >
                            Sau →
                        </button>
                    </div>

                    <div className="novel-bookmark-bar">
                        <button
                            className={
                                activeLibraryEntry?.bookmarks.includes(currentIndex)
                                    ? "primary-action compact"
                                    : "secondary-action compact"
                            }
                            onClick={() => toggleBookmark(currentIndex)}
                        >
                            {activeLibraryEntry?.bookmarks.includes(currentIndex)
                                ? "★ Đã bookmark"
                                : "☆ Bookmark đoạn này"}
                        </button>

                        {Boolean(activeLibraryEntry?.bookmarks.length) && (
                            <select
                                className="novel-bookmark-select"
                                value=""
                                onChange={(event) => {
                                    if (event.target.value) {
                                        jumpTo(Number(event.target.value));
                                    }
                                }}
                            >
                                <option value="">Đi tới bookmark...</option>
                                {activeLibraryEntry?.bookmarks.map((index) => (
                                    <option key={index} value={index}>
                                        #{index + 1} · {blocks[index]?.heading
                                            ? blocks[index].text
                                            : blocks[index]?.text.slice(0, 55) || "Đoạn đã lưu"}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </section>
            )}

            {file && (
                <section className="novel-file-card">
                    <div className="novel-file-main">
                        <div className={`novel-file-icon ${(file.format || "TXT").toLowerCase()}`}>{file.format || "TXT"}</div>
                        <div>
                            <strong>{file.title || file.name}</strong>
                            {file.author && (
                                <small className="novel-file-author">{file.author}</small>
                            )}
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
                        const cachedTranslation =
                            translations[String(block.index)];
                        const translated =
                            translationMatchesLanguagePair(
                                cachedTranslation,
                                sourceLanguage,
                                targetLanguage
                            )
                                ? cachedTranslation
                                : undefined;
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
                                        <button
                                            type="button"
                                            className={
                                                activeLibraryEntry?.bookmarks.includes(block.index)
                                                    ? "novel-inline-bookmark active"
                                                    : "novel-inline-bookmark"
                                            }
                                            title="Bookmark đoạn này"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                toggleBookmark(block.index);
                                            }}
                                        >
                                            {activeLibraryEntry?.bookmarks.includes(block.index)
                                                ? "★"
                                                : "☆"}
                                        </button>
                                        {block.heading && (
                                            <span className="novel-heading-chip">
                                                CHAPTER
                                            </span>
                                        )}
                                    </div>
                                    {block.html ? (
                                        <p
                                            lang={languageToHtmlLang(
                                                sourceLanguage,
                                                block.text
                                            )}
                                            dangerouslySetInnerHTML={{
                                                __html: block.html
                                            }}
                                        />
                                    ) : (
                                        <p
                                            lang={languageToHtmlLang(
                                                sourceLanguage,
                                                block.text
                                            )}
                                        >
                                            {block.text}
                                        </p>
                                    )}
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
                                            <p
                                                lang={languageToHtmlLang(
                                                    targetLanguage,
                                                    translated.translatedText
                                                )}
                                            >
                                                {translated.translatedText}
                                            </p>
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

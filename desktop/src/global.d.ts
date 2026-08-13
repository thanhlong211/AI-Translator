type TranslationLanguageCode =
    | "AUTO"
    | "VI"
    | "JA"
    | "EN"
    | "KO"
    | "ZH"
    | "ZH_TW"
    | "FR"
    | "DE"
    | "ES"
    | "TH"
    | "ID";

interface SelectionData {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface OcrResult {
    success: boolean;
    text: string;
    lines?: string[];
    scores?: number[];
    error?: string;
}

interface TranslationResult {
    original: string;
    translatedText?: string;
    vietnamese: string;
    sourceLanguage?: TranslationLanguageCode;
    targetLanguage?: Exclude<
        TranslationLanguageCode,
        "AUTO"
    >;
}

interface ScanResult {
    success: boolean;
    ocr?: OcrResult;
    translation?: TranslationResult;
    error?: string;
}


interface FullScreenTranslationBlock {
    id: string;
    order: number;
    original: string;
    translatedText: string;
    vietnamese: string;
    source: "AI" | "PERSONAL_MEMORY" | string;
    physicalBox: SelectionData;
    logicalBox: SelectionData;
}

interface FullScreenTranslationResult {
    success: boolean;
    mode: "full-screen";
    sourceLanguage: TranslationLanguageCode;
    targetLanguage: Exclude<
        TranslationLanguageCode,
        "AUTO"
    >;
    blocks: FullScreenTranslationBlock[];
    batch?: {
        profile?: {
            id: number;
            name: string;
        } | null;
        ai?: {
            provider?: string;
            model?: string;
        } | null;
        summary?: {
            totalBlocks: number;
            memoryHits: number;
            aiBlocks: number;
        } | null;
        performance?: {
            requestId?: string;
            totalMs?: number;
        } | null;
    };
    performance?: {
        ocrMs: number;
        translateMs: number;
        totalMs: number;
    };
    error?: string;
}

interface MangaPanelSessionState {
    active: boolean;
    id?: string;
    pageNumber: number;
    nextPageNumber: number;
    contextItems: number;
    sourceLanguage?: TranslationLanguageCode;
    targetLanguage?: Exclude<
        TranslationLanguageCode,
        "AUTO"
    >;
    profileId?: number | null;
    selection?: SelectionData;
    nextShortcut?: string;
}

interface Window {
    electronAPI: {
        openSelector: (options?: {
            sourceLanguage?: TranslationLanguageCode;
            targetLanguage?: Exclude<
                TranslationLanguageCode,
                "AUTO"
            >;
        }) => Promise<void>;

        getPricingCatalog?: (
            currency?: string
        ) => Promise<Array<{
            code: string;
            displayName: string;
            description: string;
            rankOrder: number;
            features: Record<string, boolean>;
            limits: Record<string, number>;
            prices: Array<{
                id: number;
                billingPeriod: "MONTHLY" | "YEARLY" | "LIFETIME";
                currency: string;
                amountMinor: number;
                compareAtAmountMinor?: number | null;
                startsAt?: string | null;
                endsAt?: string | null;
            }>;
        }>>;


        translatePanel?: (options?: {
            sourceLanguage?: TranslationLanguageCode;
            targetLanguage?: Exclude<
                TranslationLanguageCode,
                "AUTO"
            >;
        }) => Promise<{
            success: boolean;
            selecting?: boolean;
            error?: string;
        }>;

        translatePanelNextPage?: () => Promise<{
            success: boolean;
            mode?: "panel-next";
            session?: MangaPanelSessionState;
            error?: string;
        }>;

        getMangaPanelSessionState?: () => Promise<
            MangaPanelSessionState
        >;

        endMangaPanelSession?: () => Promise<{
            success: boolean;
            active: boolean;
        }>;

        translateFullScreen?: (options?: {
            sourceLanguage?: TranslationLanguageCode;
            targetLanguage?: Exclude<
                TranslationLanguageCode,
                "AUTO"
            >;
        }) => Promise<FullScreenTranslationResult>;

        submitTranslationFeedback?: (feedback: {
            profileId?: number | null;
            sourceText: string;
            aiTranslation: string;
            correctedTranslation: string;
            sourceLanguage: TranslationLanguageCode;
            targetLanguage: Exclude<
                TranslationLanguageCode,
                "AUTO"
            >;
            provider?: string | null;
            model?: string | null;
            requestId?: string | null;
            allowModelImprovement: boolean;
        }) => Promise<{
            success: boolean;
            feedbackId?: number;
        }>;

        listTranslationMemory?: (filters?: {
            q?: string;
            profileId?: number;
            sourceLanguage?:
                | "ALL"
                | TranslationLanguageCode;
            targetLanguage?:
                | "ALL"
                | Exclude<
                    TranslationLanguageCode,
                    "AUTO"
                >;
            page?: number;
            size?: number;
        }) => Promise<{
            items: Array<{
                id: number;
                profileId: number;
                sourceText: string;
                correctedTranslation: string;
                sourceLanguage: TranslationLanguageCode;
                targetLanguage: Exclude<
                    TranslationLanguageCode,
                    "AUTO"
                >;
                hitCount: number;
                lastUsedAt?: string | null;
                createdAt: string;
                updatedAt: string;
            }>;
            totalItems: number;
            page: number;
            size: number;
            totalPages: number;
        }>;

        getTranslationMemoryStats?: () => Promise<{
            totalItems: number;
            totalHits: number;
            usedItems: number;
        }>;

        updateTranslationMemory?: (
            memoryId: number,
            correctedTranslation: string
        ) => Promise<unknown>;

        deleteTranslationMemory?: (
            memoryId: number,
            memorySnapshot: unknown
        ) => Promise<{ success: boolean }>;

        setTranslationLanguages?: (options: {
            sourceLanguage: TranslationLanguageCode;
            targetLanguage: Exclude<
                TranslationLanguageCode,
                "AUTO"
            >;
        }) => Promise<{
            sourceLanguage: TranslationLanguageCode;
            targetLanguage: Exclude<
                TranslationLanguageCode,
                "AUTO"
            >;
        }>;

        sendSelection: (
            data: SelectionData
        ) => void;

        onScanResult: (
            callback: (
                result: ScanResult
            ) => void
        ) => () => void;
        getApiKeyStatus:
    () => Promise<ApiKeyStatus>;

saveApiKey:
    (
        apiKey: string
    ) => Promise<{
        success: boolean;
    }>;

clearApiKey:
    () => Promise<{
        success: boolean;
    }>;
    };
}
interface ApiKeyStatus {
    configured: boolean;

    source:
        | "saved"
        | "environment"
        | "none";
}
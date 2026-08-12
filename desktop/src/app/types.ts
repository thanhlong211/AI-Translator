export type PageId =
    | "translate"
    | "study"
    | "vocabulary"
    | "grammar"
    | "review"
    | "profiles"
    | "memory"
    | "history"
    | "settings";

export interface BackendStatus {
    connected: boolean;
    status: string;
    baseUrl: string;
    error?: string;
}

export interface UserSummary {
    id: number;
    email: string;
    status: string;
    role: string;
}

export interface AuthStatus {
    authenticated: boolean;
    user: UserSummary | null;
    sessionStored?: boolean;
    deviceId?: string;
    deviceName?: string;
}

export interface DeviceSession {
    sessionId: number;
    deviceId: string;
    deviceName: string;
    current: boolean;
    createdAt: string;
    lastUsedAt?: string;
    expiresAt: string;
}

export interface AccountEntitlements {
    planCode: string;
    planName: string;
    subscriptionStatus: string;
    subscriptionSource: string;
    periodEnd?: string | null;
    features: Record<string, boolean>;
    limits: Record<string, number>;
    usage: Record<string, number>;
    developmentOverride: boolean;
}

export interface TranslationState {
    original: string;
    vietnamese: string;

    /** Bản dịch AI nguyên bản dùng làm baseline cho correction. */
    aiTranslation?: string;
    aiProvider?: string;
    aiModel?: string;
    requestId?: string;
    profileId?: number | null;

    /** Bản correction gần nhất đã gửi, để tránh submit duplicate. */
    lastFeedbackTranslation?: string;

    status: string;
    isScanning: boolean;
}

export type TranslationStyle =
    | "NATURAL"
    | "MANGA"
    | "LITERAL"
    | "POLITE";

export type TranslationLanguage =
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

export type TargetTranslationLanguage =
    Exclude<TranslationLanguage, "AUTO">;

export interface ProfileCharacterRule {
    id?: number;
    name: string;
    aliases: string[];
    rule: string;
}

export interface ProfileGlossaryEntry {
    id?: number;
    sourceLanguage: TranslationLanguage;
    targetLanguage: TargetTranslationLanguage;
    source: string;
    target: string;
    note?: string | null;
}

export interface TranslationMemoryItem {
    id: number;
    profileId: number;
    sourceText: string;
    correctedTranslation: string;
    sourceLanguage: TranslationLanguage;
    targetLanguage: TargetTranslationLanguage;
    hitCount: number;
    lastUsedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface TranslationMemoryStats {
    totalItems: number;
    totalHits: number;
    usedItems: number;
}

export interface TranslationMemoryPageResult {
    items: TranslationMemoryItem[];
    totalItems: number;
    page: number;
    size: number;
    totalPages: number;
}

export interface TranslationProfile {
    id: number;
    name: string;
    style: TranslationStyle;
    contextLines: number;
    keepHonorifics: boolean;
    customInstruction?: string | null;
    defaultProfile: boolean;
    characters: ProfileCharacterRule[];
    glossary: ProfileGlossaryEntry[];
    createdAt: string;
    updatedAt: string;
}

export interface ProfileUpsertPayload {
    name: string;
    style: TranslationStyle;
    contextLines: number;
    keepHonorifics: boolean;
    customInstruction: string | null;
    characters: Array<{
        name: string;
        aliases: string[];
        rule: string;
    }>;
    glossary: Array<{
        sourceLanguage: TranslationLanguage;
        targetLanguage: TargetTranslationLanguage;
        source: string;
        target: string;
        note: string | null;
    }>;
}

export type StudyLevel =
    | "AUTO"
    | "N5"
    | "N4"
    | "N3"
    | "N2"
    | "N1";

export interface StudySentencePart {
    text: string;
    reading: string;
    romaji: string;
    role: string;
    meaning: string;
    explanation: string;
}

export interface StudyGrammarPoint {
    pattern: string;
    jlptLevel: string;
    meaning: string;
    matchedText: string;
    explanation: string;
}

export interface StudyVocabularyItem {
    surface: string;
    dictionaryForm: string;
    reading: string;
    romaji: string;
    meaning: string;
    partOfSpeech: string;
    jlptLevel: string;
    note: string;
}

export interface ApiPerformanceTiming {
    requestId: string;
    profileMs: number;
    promptMs: number;
    openAiMs: number;
    parseMs: number;
    persistenceMs: number;
    totalMs: number;
}

export interface StudyFastTranslation {
    scanId: string;
    original: string;
    vietnamese: string;
    profileName?: string;
    visibleMs?: number;
    backendPerformance?: ApiPerformanceTiming | null;
}

export interface StudyAnalysis {
    original: string;
    reading: string;
    romaji: string;
    translation: string;
    sentenceSummary: string;
    sentenceParts: StudySentencePart[];
    grammar: StudyGrammarPoint[];
    vocabulary: StudyVocabularyItem[];
    notes: string[];
}

export interface StudyAnalyzeResponse {
    success: boolean;
    analysis: StudyAnalysis;
    profile: {
        id: number;
        name: string;
        style: string;
        updatedAt: string;
    };
    studyLevel: StudyLevel;
    vocabularySync?: VocabularySyncSummary;
    grammarSync?: GrammarSyncSummary;
    performance?: ApiPerformanceTiming;
}

export interface StudyState {
    result: StudyAnalyzeResponse | null;
    fastTranslation: StudyFastTranslation | null;
    activeScanId: string | null;
    status: string;
    isScanning: boolean;
    isAnalyzing: boolean;
}


export type VocabularyStatus =
    | "NEW"
    | "LEARNING"
    | "KNOWN";

export interface VocabularyItem {
    id: number;
    surface: string;
    dictionaryForm: string;
    reading: string;
    romaji?: string | null;
    meaning?: string | null;
    partOfSpeech?: string | null;
    jlptLevel: string;
    status: VocabularyStatus;
    favorite: boolean;
    encounterCount: number;
    personalNote?: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    createdAt: string;
    updatedAt: string;
}

export interface VocabularyStats {
    total: number;
    newCount: number;
    learningCount: number;
    knownCount: number;
    favoriteCount: number;
}

export interface VocabularyPageResult {
    items: VocabularyItem[];
    totalItems: number;
    page: number;
    size: number;
    totalPages: number;
}

export interface VocabularySyncSummary {
    autoSaved: boolean;
    inserted: number;
    updated: number;
    skipped: number;
}


export type GrammarStatus =
    | "NEW"
    | "LEARNING"
    | "KNOWN";

export interface GrammarItem {
    id: number;
    pattern: string;
    jlptLevel: string;
    meaning?: string | null;
    explanation?: string | null;
    status: GrammarStatus;
    favorite: boolean;
    encounterCount: number;
    personalNote?: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    createdAt: string;
    updatedAt: string;
}

export interface GrammarStats {
    total: number;
    newCount: number;
    learningCount: number;
    knownCount: number;
    favoriteCount: number;
}

export interface GrammarPageResult {
    items: GrammarItem[];
    totalItems: number;
    page: number;
    size: number;
    totalPages: number;
}

export interface GrammarSyncSummary {
    autoSaved: boolean;
    inserted: number;
    updated: number;
    skipped: number;
}

export interface ShortcutSettings {
    translate: string;
    panel: string;
    panelNext: string;
    study: string;
    translateDisplay: string;
    panelDisplay: string;
    panelNextDisplay: string;
    studyDisplay: string;
}


export interface AppPreferences {
    version: number;
    legacyMigrationNeeded?: boolean;

    shortcuts: ShortcutSettings;

    study: {
        level: StudyLevel;
        autoSaveVocabulary: boolean;
        autoSaveGrammar: boolean;
    };

    overlay: {
        autoHide: boolean;
        opacity: number;
        fontScale: number;
    };

    onboardingCompleted: boolean;
}


export type ReviewItemType =
    | "VOCABULARY"
    | "GRAMMAR";

export type ReviewGrade =
    | "AGAIN"
    | "HARD"
    | "GOOD"
    | "EASY";

export type ReviewMasteryLevel =
    | "NEW"
    | "WEAK"
    | "LEARNING"
    | "FAMILIAR"
    | "MASTERED";

export type ReviewQuestionType =
    | "MEANING";

export interface ReviewOption {
    optionId: string;
    text: string;
}

export interface ReviewItem {
    itemType: ReviewItemType;
    itemId: number;
    primaryText: string;
    secondaryText?: string | null;
    reading?: string | null;
    romaji?: string | null;
    answer?: string | null;
    detail?: string | null;
    jlptLevel: string;
    learningStatus: string;
    favorite: boolean;
    encounterCount: number;
    personalNote?: string | null;
    dueAt: string;
    intervalDays: number;
    easeFactor: number;
    repetitions: number;
    lapseCount: number;
    lastReviewedAt?: string | null;

    quizReady: boolean;
    questionType: ReviewQuestionType;
    options: ReviewOption[];

    masteryLevel: ReviewMasteryLevel;
    accuracyPercent: number;
    correctCount: number;
    wrongCount: number;
    correctStreak: number;
}

export interface ReviewQueue {
    items: ReviewItem[];
    totalDue: number;
    vocabularyDue: number;
    grammarDue: number;
}

export interface ReviewStats {
    dueNow: number;
    vocabularyDue: number;
    grammarDue: number;
    reviewedLast24h: number;
    correctLast24h: number;
    wrongLast24h: number;
    accuracyLast24h: number;
    againLast24h: number;
    hardLast24h: number;
    goodLast24h: number;
    easyLast24h: number;
}

export interface ReviewAnswerResponse {
    success: boolean;
    correct: boolean;
    practice: boolean;
    automaticGrade: ReviewGrade;
    masteryLevel: ReviewMasteryLevel;
    accuracyPercent: number;
    correctAnswer: string;
    item: ReviewItem;
}


export interface LearningDashboardOverview {
    reviewed14Days: number;
    correct14Days: number;
    wrong14Days: number;
    accuracy14Days: number;
    activeDays14Days: number;
    currentStreakDays: number;
    weakItems: number;
    masteredItems: number;
}

export interface LearningDailyActivity {
    date: string;
    reviewed: number;
    correct: number;
    wrong: number;
    accuracyPercent: number;
}

export interface LearningWeakItem {
    itemType: ReviewItemType;
    itemId: number;
    primaryText: string;
    answer: string;
    jlptLevel: string;
    masteryLevel: ReviewMasteryLevel;
    accuracyPercent: number;
    correctCount: number;
    wrongCount: number;
    correctStreak: number;
    priorityScore: number;
}

export interface LearningRecentReview {
    eventId: number;
    itemType: ReviewItemType;
    itemId: number;
    primaryText: string;
    correct: boolean;
    automaticGrade: ReviewGrade;
    responseTimeMs?: number | null;
    reviewedAt: string;
}

export interface LearningDashboard {
    overview: LearningDashboardOverview;
    dailyActivity: LearningDailyActivity[];
    weakItems: LearningWeakItem[];
    recentReviews: LearningRecentReview[];
}

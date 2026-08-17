import {
    useEffect,
    useState
} from "react";

import type {
    FormEvent
} from "react";

import type {
    AccountEntitlements,
    AccountIdentity,
    AppPreferences,
    AuthStatus,
    BackendStatus,
    DeviceSession,
    GrammarItem,
    GrammarStats,
    GrammarStatus,
    LearningDashboard,
    PageId,
    ProfileUpsertPayload,
    ReviewAnswerResponse,
    ReviewItem,
    ReviewMasteryLevel,
    ReviewQueue,
    ReviewStats,
    ShortcutSettings,
    SocialAuthProviderCode,
    SocialAuthProviderStatus,
    StudyGrammarPoint,
    StudyLevel,
    StudyState,
    StudyVocabularyItem,
    TargetTranslationLanguage,
    TranslationLanguage,
    TranslationMemoryItem,
    TranslationMemoryStats,
    TranslationProfile,
    TranslationState,
    VocabularyItem,
    VocabularyStats,
    VocabularyStatus
} from "./app/types";

import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { OnboardingModal } from "./components/OnboardingModal";
import { TranslatePage } from "./pages/TranslatePage";
import { NovelReaderPage } from "./pages/NovelReaderPage";
import { StudyPage } from "./pages/StudyPage";
import { VocabularyPage } from "./pages/VocabularyPage";
import { GrammarPage } from "./pages/GrammarPage";
import { ReviewPage } from "./pages/ReviewPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { TranslationMemoryPage } from "./pages/TranslationMemoryPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useI18n } from "./i18n";
import {
    normalizeSourceLanguage,
    normalizeTargetLanguage
} from "./app/translationLanguages";

function cloneProfile(
    profile:
        TranslationProfile
): TranslationProfile {
    return {
        ...profile,

        characters:
            profile.characters.map(
                (character) => ({
                    ...character,
                    aliases: [
                        ...character.aliases
                    ]
                })
            ),

        glossary:
            profile.glossary.map(
                (entry) => ({
                    ...entry,
                    sourceLanguage:
                        normalizeSourceLanguage(
                            entry.sourceLanguage
                        ),
                    targetLanguage:
                        normalizeTargetLanguage(
                            entry.targetLanguage
                        )
                })
            )
    };
}

function profileToPayload(
    profile:
        TranslationProfile
): ProfileUpsertPayload {
    return {
        name:
            profile.name.trim(),

        style:
            profile.style,

        contextLines:
            profile.contextLines,

        keepHonorifics:
            profile.keepHonorifics,

        customInstruction:
            profile.customInstruction
                ?.trim() ||
            null,

        characters:
            profile.characters
                .filter(
                    (character) =>
                        character.name
                            .trim() ||
                        character.rule
                            .trim()
                )
                .map(
                    (character) => ({
                        name:
                            character.name
                                .trim(),

                        aliases:
                            character.aliases
                                .map(
                                    (value) =>
                                        value.trim()
                                )
                                .filter(Boolean),

                        rule:
                            character.rule
                                .trim()
                    })
                ),

        glossary:
            profile.glossary
                .filter(
                    (entry) =>
                        entry.source
                            .trim() ||
                        entry.target
                            .trim()
                )
                .map(
                    (entry) => ({
                        sourceLanguage:
                            normalizeSourceLanguage(
                                entry.sourceLanguage
                            ),

                        targetLanguage:
                            normalizeTargetLanguage(
                                entry.targetLanguage
                            ),

                        source:
                            entry.source
                                .trim(),

                        target:
                            entry.target
                                .trim(),

                        note:
                            entry.note
                                ?.trim() ||
                            null
                    })
                )
    };
}

function App() {
    const { t } = useI18n();

    const api =
        window.electronAPI as any;

    const [
        activePage,
        setActivePage
    ] = useState<PageId>(
        "translate"
    );

    /*
     * Normal Translation và Study có state riêng.
     * Vì vậy quét ở Study không ghi đè kết quả tab Dịch.
     */
    const [
        translation,
        setTranslation
    ] = useState<TranslationState>({
        original: "",
        vietnamese: "",
        status: "Sẵn sàng",
        isScanning: false
    });

    const [
        sourceLanguage,
        setSourceLanguage
    ] = useState<TranslationLanguage>(() => {
        try {
            return normalizeSourceLanguage(
                localStorage.getItem(
                    "translation.sourceLanguage"
                )
            );
        } catch {
            return "AUTO";
        }
    });

    const [
        targetLanguage,
        setTargetLanguage
    ] = useState<TargetTranslationLanguage>(() => {
        try {
            return normalizeTargetLanguage(
                localStorage.getItem(
                    "translation.targetLanguage"
                )
            );
        } catch {
            return "VI";
        }
    });

    const [
        study,
        setStudy
    ] = useState<StudyState>({
        result: null,
        fastTranslation: null,
        activeScanId: null,
        status: "Sẵn sàng học",
        isScanning: false,
        isAnalyzing: false
    });

    const [
        studyLevel,
        setStudyLevel
    ] = useState<StudyLevel>(
        "AUTO"
    );

    const [
        autoSaveVocabulary,
        setAutoSaveVocabulary
    ] = useState<boolean>(() => {
        try {
            return localStorage
                .getItem(
                    "study.autoSaveVocabulary"
                ) === "true";
        } catch {
            return false;
        }
    });

    const [
        autoSaveGrammar,
        setAutoSaveGrammar
    ] = useState<boolean>(() => {
        try {
            return localStorage
                .getItem(
                    "study.autoSaveGrammar"
                ) === "true";
        } catch {
            return false;
        }
    });

    const [
        translationMemoryItems,
        setTranslationMemoryItems
    ] = useState<TranslationMemoryItem[]>(
        []
    );

    const [
        translationMemoryStats,
        setTranslationMemoryStats
    ] = useState<TranslationMemoryStats>({
        totalItems: 0,
        totalHits: 0,
        usedItems: 0
    });

    const [
        translationMemoryLoading,
        setTranslationMemoryLoading
    ] = useState(false);

    const [
        translationMemoryMessage,
        setTranslationMemoryMessage
    ] = useState("");

    const [
        translationMemoryQuery,
        setTranslationMemoryQuery
    ] = useState("");

    const [
        translationMemoryProfileFilter,
        setTranslationMemoryProfileFilter
    ] = useState<"ALL" | number>(
        "ALL"
    );

    const [
        translationMemorySourceFilter,
        setTranslationMemorySourceFilter
    ] = useState<
        "ALL" | TranslationLanguage
    >("ALL");

    const [
        translationMemoryTargetFilter,
        setTranslationMemoryTargetFilter
    ] = useState<
        "ALL" | TargetTranslationLanguage
    >("ALL");

    const [
        translationMemoryPage,
        setTranslationMemoryPage
    ] = useState(0);

    const [
        translationMemoryTotalPages,
        setTranslationMemoryTotalPages
    ] = useState(0);

    const [
        vocabularyItems,
        setVocabularyItems
    ] = useState<VocabularyItem[]>(
        []
    );

    const [
        vocabularyStats,
        setVocabularyStats
    ] = useState<VocabularyStats>({
        total: 0,
        newCount: 0,
        learningCount: 0,
        knownCount: 0,
        favoriteCount: 0
    });

    const [
        vocabularyLoading,
        setVocabularyLoading
    ] = useState(false);

    const [
        vocabularyMessage,
        setVocabularyMessage
    ] = useState("");

    const [
        vocabularyQuery,
        setVocabularyQuery
    ] = useState("");

    const [
        vocabularyStatusFilter,
        setVocabularyStatusFilter
    ] = useState<
        "ALL" | VocabularyStatus
    >("ALL");

    const [
        vocabularyFavoriteOnly,
        setVocabularyFavoriteOnly
    ] = useState(false);

    const [
        grammarItems,
        setGrammarItems
    ] = useState<GrammarItem[]>(
        []
    );

    const [
        grammarStats,
        setGrammarStats
    ] = useState<GrammarStats>({
        total: 0,
        newCount: 0,
        learningCount: 0,
        knownCount: 0,
        favoriteCount: 0
    });

    const [
        grammarLoading,
        setGrammarLoading
    ] = useState(false);

    const [
        grammarMessage,
        setGrammarMessage
    ] = useState("");

    const [
        grammarQuery,
        setGrammarQuery
    ] = useState("");

    const [
        grammarStatusFilter,
        setGrammarStatusFilter
    ] = useState<
        "ALL" | GrammarStatus
    >("ALL");

    const [
        grammarFavoriteOnly,
        setGrammarFavoriteOnly
    ] = useState(false);

    const [
        reviewQueue,
        setReviewQueue
    ] = useState<ReviewQueue>({
        items: [],
        totalDue: 0,
        vocabularyDue: 0,
        grammarDue: 0
    });

    const [
        reviewStats,
        setReviewStats
    ] = useState<ReviewStats>({
        dueNow: 0,
        vocabularyDue: 0,
        grammarDue: 0,
        reviewedLast24h: 0,
        correctLast24h: 0,
        wrongLast24h: 0,
        accuracyLast24h: 0,
        againLast24h: 0,
        hardLast24h: 0,
        goodLast24h: 0,
        easyLast24h: 0
    });

    const [
        reviewLoading,
        setReviewLoading
    ] = useState(false);

    const [
        reviewMessage,
        setReviewMessage
    ] = useState("");

    const [
        learningDashboard,
        setLearningDashboard
    ] = useState<LearningDashboard>({
        overview: {
            reviewed14Days: 0,
            correct14Days: 0,
            wrong14Days: 0,
            accuracy14Days: 0,
            activeDays14Days: 0,
            currentStreakDays: 0,
            weakItems: 0,
            masteredItems: 0
        },
        dailyActivity: [],
        weakItems: [],
        recentReviews: []
    });

    const [
        learningDashboardLoading,
        setLearningDashboardLoading
    ] = useState(false);

    const [
        learningDashboardMessage,
        setLearningDashboardMessage
    ] = useState("");

    const [
        shortcutSettings,
        setShortcutSettings
    ] = useState<ShortcutSettings>({
        translate:
            "CommandOrControl+Shift+Q",
        panel:
            "CommandOrControl+Shift+W",
        panelNext:
            "CommandOrControl+Shift+Y",
        study:
            "CommandOrControl+Shift+E",
        translateDisplay:
            "Ctrl+Shift+Q",
        panelDisplay:
            "Ctrl+Shift+W",
        panelNextDisplay:
            "Ctrl+Shift+Y",
        studyDisplay:
            "Ctrl+Shift+E"
    });

    const [
        shortcutMessage,
        setShortcutMessage
    ] = useState("");

    const [
        appPreferences,
        setAppPreferences
    ] = useState<AppPreferences>({
        version: 3,
        shortcuts: {
            translate:
                "CommandOrControl+Shift+Q",
            panel:
                "CommandOrControl+Shift+W",
            panelNext:
                "CommandOrControl+Shift+Y",
            study:
                "CommandOrControl+Shift+E",
            translateDisplay:
                "Ctrl+Shift+Q",
            panelDisplay:
                "Ctrl+Shift+W",
            panelNextDisplay:
                "Ctrl+Shift+Y",
            studyDisplay:
                "Ctrl+Shift+E"
        },
        study: {
            level: "AUTO",
            autoSaveVocabulary: false,
            autoSaveGrammar: false
        },
        overlay: {
            autoHide: true,
            opacity: 0.96,
            fontScale: 1
        },
        onboardingCompleted: false
    });

    const [
        preferencesMessage,
        setPreferencesMessage
    ] = useState("");

    const [
        showOnboarding,
        setShowOnboarding
    ] = useState(false);

    const [
        onboardingReplay,
        setOnboardingReplay
    ] = useState(false);

    const [
        backend,
        setBackend
    ] = useState<BackendStatus>({
        connected: false,
        status: "CHECKING",
        baseUrl:
            "http://localhost:8080"
    });

    const [
        auth,
        setAuth
    ] = useState<AuthStatus>({
        authenticated: false,
        user: null
    });

    const [
        socialProviders,
        setSocialProviders
    ] = useState<SocialAuthProviderStatus[]>([]);

    const [
        accountIdentities,
        setAccountIdentities
    ] = useState<AccountIdentity[]>([]);

    const [
        socialAuthLoadingProvider,
        setSocialAuthLoadingProvider
    ] = useState<SocialAuthProviderCode | null>(null);

    const [
        entitlements,
        setEntitlements
    ] = useState<AccountEntitlements>({
        planCode: "FREE",
        planName: "Free",
        subscriptionStatus: "ACTIVE",
        subscriptionSource: "DEFAULT",
        periodEnd: null,
        features: {
            quickTranslate: true,
            studyMode: false,
            mangaPanel: false,
            mangaSession: false,
            translationMemory: true,
            continuousManga: false,
            novelReaderTxt: false,
            novelReaderEpub: false
        },
        limits: {
            monthlyTranslations: 300,
            mangaPagesPerDay: 0,
            continuousMangaPagesPerDay: 0,
            contextItems: 5,
            devices: 1
        },
        usage: {
            monthlyTranslationsUsed: 0
        },
        developmentOverride: false
    });

    const [
        entitlementMessage,
        setEntitlementMessage
    ] = useState("");

    const [
        isEntitlementLoading,
        setIsEntitlementLoading
    ] = useState(false);

    const [
        authMode,
        setAuthMode
    ] = useState<
        "login" | "register"
    >("login");

    const [
        email,
        setEmail
    ] = useState("");

    const [
        password,
        setPassword
    ] = useState("");

    const [
        authMessage,
        setAuthMessage
    ] = useState("");

    const [
        isAuthLoading,
        setIsAuthLoading
    ] = useState(false);

    const [
        emailVerificationRequired,
        setEmailVerificationRequired
    ] = useState(false);

    const [
        emailVerificationEmail,
        setEmailVerificationEmail
    ] = useState("");

    const [
        emailVerificationCode,
        setEmailVerificationCode
    ] = useState("");

    const [
        emailVerificationMessage,
        setEmailVerificationMessage
    ] = useState("");

    const [
        emailVerificationCooldownSeconds,
        setEmailVerificationCooldownSeconds
    ] = useState(0);

    const [
        isEmailVerificationRequestLoading,
        setIsEmailVerificationRequestLoading
    ] = useState(false);

    const [
        isEmailVerificationConfirmLoading,
        setIsEmailVerificationConfirmLoading
    ] = useState(false);

    useEffect(() => {
        if (
            emailVerificationCooldownSeconds <= 0
        ) {
            return;
        }

        const timer =
            window.setTimeout(
                () => {
                    setEmailVerificationCooldownSeconds(
                        (current) =>
                            Math.max(
                                0,
                                current - 1
                            )
                    );
                },
                1000
            );

        return () => {
            window.clearTimeout(timer);
        };
    }, [
        emailVerificationCooldownSeconds
    ]);

    const [
        deviceTransferRequired,
        setDeviceTransferRequired
    ] = useState(false);

    const [
        deviceTransferEmail,
        setDeviceTransferEmail
    ] = useState("");

    const [
        deviceTransferCode,
        setDeviceTransferCode
    ] = useState("");

    const [
        deviceTransferMessage,
        setDeviceTransferMessage
    ] = useState("");

    const [
        isDeviceTransferRequestLoading,
        setIsDeviceTransferRequestLoading
    ] = useState(false);

    const [
        isDeviceTransferConfirmLoading,
        setIsDeviceTransferConfirmLoading
    ] = useState(false);

    const [
        deviceTransferCooldownSeconds,
        setDeviceTransferCooldownSeconds
    ] = useState(0);

    useEffect(() => {
        if (
            deviceTransferCooldownSeconds <= 0
        ) {
            return;
        }

        const timer =
            window.setTimeout(
                () => {
                    setDeviceTransferCooldownSeconds(
                        (current) =>
                            Math.max(
                                0,
                                current - 1
                            )
                    );
                },
                1000
            );

        return () => {
            window.clearTimeout(timer);
        };
    }, [
        deviceTransferCooldownSeconds
    ]);

    const [
        isCheckingBackend,
        setIsCheckingBackend
    ] = useState(false);

    const [
        devices,
        setDevices
    ] = useState<DeviceSession[]>([]);

    const [
        isLoadingDevices,
        setIsLoadingDevices
    ] = useState(false);

    /*
     * profiles = dữ liệu đã lưu ở MySQL.
     * profileDraft = profile đang chỉnh trong UI.
     */
    const [
        profiles,
        setProfiles
    ] = useState<
        TranslationProfile[]
    >([]);

    const [
        profileDraft,
        setProfileDraft
    ] = useState<
        TranslationProfile |
        null
    >(null);

    const [
        profileDirty,
        setProfileDirty
    ] = useState(false);

    const [
        profileMessage,
        setProfileMessage
    ] = useState("");

    const [
        isProfileSaving,
        setIsProfileSaving
    ] = useState(false);

    /*
     * Electron result listeners.
     */
    useEffect(() => {
        if (!api?.onScanResult) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Không kết nối được Electron preload"
                })
            );

            return;
        }

        const removeScanListener =
            api.onScanResult(
                (result: any) => {
                    setTranslation(
                        (current) => {
                            if (!result.success) {
                                return {
                                    ...current,
                                    isScanning:
                                        false,
                                    status:
                                        result.error ||
                                        "Quét hoặc dịch thất bại"
                                };
                            }

                            const translated =
                                result.translation
                                    ?.translatedText ||
                                result.translation
                                    ?.vietnamese ||
                                "";

                            const isPanel =
                                result.mode ===
                                "panel";

                            const panelBlocks =
                                Array.isArray(
                                    result.blocks
                                )
                                    ? result.blocks
                                    : [];

                            const memoryHits =
                                Number(
                                    result.batch
                                        ?.summary
                                        ?.memoryHits ||
                                    0
                                );

                            const aiBlocks =
                                Number(
                                    result.batch
                                        ?.summary
                                        ?.aiBlocks ||
                                    0
                                );

                            return {
                                original:
                                    result.translation
                                        ?.original ||
                                    result.ocr
                                        ?.text ||
                                    "",

                                vietnamese:
                                    translated,

                                /*
                                 * Panel là aggregate nhiều bubble.
                                 * Không biến toàn panel thành một feedback exact-match.
                                 */
                                aiTranslation:
                                    isPanel
                                        ? ""
                                        : translated,

                                aiProvider:
                                    result.translation
                                        ?.ai
                                        ?.provider ||
                                    "",

                                aiModel:
                                    result.translation
                                        ?.ai
                                        ?.model ||
                                    "",

                                requestId:
                                    result.translation
                                        ?.performance
                                        ?.requestId ||
                                    "",

                                profileId:
                                    result.translation
                                        ?.profile
                                        ?.id ??
                                    null,

                                lastFeedbackTranslation:
                                    "",

                                status:
                                    isPanel
                                        ? result.session?.active
                                            ? `Manga Session · Trang ${Number(result.session.pageNumber || 1)} · ${panelBlocks.length} vùng · ${memoryHits} memory · ${aiBlocks} AI`
                                            : `Khung truyện · ${panelBlocks.length} vùng · ${memoryHits} memory · ${aiBlocks} AI`
                                        : result.translation
                                            ?.ai
                                            ?.provider ===
                                          "personal-memory"
                                            ? "Hoàn thành · dùng Translation Memory"
                                            : "Hoàn thành",

                                isScanning:
                                    false
                            };
                        }
                    );
                }
            );

        const removeStudyFastListener =
            api.onStudyFastResult?.(
                (result: any) => {
                    if (!result.success) {
                        setStudy(
                            (current) => ({
                                ...current,
                                isScanning:
                                    false,
                                isAnalyzing:
                                    false,
                                status:
                                    result.error ||
                                    "Fast Translation thất bại"
                            })
                        );

                        return;
                    }

                    const fastTranslation = {
                        scanId:
                            String(
                                result.scanId ||
                                ""
                            ),

                        original:
                            result.translation
                                ?.original ||
                            result.ocr
                                ?.text ||
                            "",

                        vietnamese:
                            result.translation
                                ?.vietnamese ||
                            "",

                        profileName:
                            result.translation
                                ?.profile
                                ?.name ||
                            result.study
                                ?.profile
                                ?.name ||
                            "",

                        visibleMs:
                            Number(
                                result.performance
                                    ?.visibleMs ||
                                0
                            ),

                        backendPerformance:
                            result.performance
                                ?.backendTranslate ||
                            result.translation
                                ?.performance ||
                            null
                    };

                    setStudy({
                        result:
                            result.study ||
                            null,

                        fastTranslation,

                        activeScanId:
                            fastTranslation.scanId,

                        status:
                            result.study
                                ? "Phân tích hoàn thành"
                                : "Đã có bản dịch · đang phân tích cấu trúc...",

                        isScanning:
                            false,

                        isAnalyzing:
                            !result.study
                    });
                }
            );

        const removeStudyListener =
            api.onStudyResult?.(
                (result: any) => {
                    setStudy(
                        (current) => {
                            const resultScanId =
                                String(
                                    result.scanId ||
                                    ""
                                );

                            /*
                             * Background request cũ có thể hoàn tất
                             * sau khi user đã quét câu mới.
                             * Không cho result cũ ghi đè UI mới.
                             */
                            if (
                                resultScanId &&
                                current.activeScanId &&
                                resultScanId !==
                                    current.activeScanId
                            ) {
                                return current;
                            }

                            if (!result.success) {
                                return {
                                    ...current,
                                    isScanning:
                                        false,
                                    isAnalyzing:
                                        false,
                                    status:
                                        current.fastTranslation
                                            ?.vietnamese
                                            ? `Bản dịch đã sẵn sàng · phân tích nâng cao lỗi: ${result.error || "không xác định"}`
                                            : result.error ||
                                              "Phân tích Study thất bại"
                                };
                            }

                            const sync =
                                result.study
                                    ?.vocabularySync;

                            const grammarSync =
                                result.study
                                    ?.grammarSync;

                            const timing =
                                result.study
                                    ?.performance;

                            const timingText =
                                timing?.totalMs
                                    ? ` · ${(timing.totalMs / 1000).toFixed(1)}s`
                                    : "";

                            const savedParts = [
                                sync?.autoSaved
                                    ? `từ ${sync.inserted} mới/${sync.updated} cập nhật`
                                    : "",

                                grammarSync?.autoSaved
                                    ? `ngữ pháp ${grammarSync.inserted} mới/${grammarSync.updated} cập nhật`
                                    : ""
                            ].filter(Boolean);

                            const status =
                                savedParts.length
                                    ? `Phân tích hoàn thành · ${savedParts.join(" · ")}${timingText}`
                                    : `Phân tích hoàn thành${timingText}`;

                            let nextStudy =
                                result.study ||
                                null;

                            /*
                             * Fast /translate là bản dịch user đã nhìn thấy.
                             * Giữ nó làm translation chính để UI không đổi
                             * câu chữ khi Study response về sau.
                             */
                            const fastVietnamese =
                                result.translation
                                    ?.vietnamese ||
                                current.fastTranslation
                                    ?.vietnamese ||
                                "";

                            if (
                                nextStudy?.analysis &&
                                fastVietnamese
                            ) {
                                nextStudy = {
                                    ...nextStudy,
                                    analysis: {
                                        ...nextStudy.analysis,
                                        translation:
                                            fastVietnamese
                                    }
                                };
                            }

                            const nextFast =
                                current.fastTranslation ||
                                {
                                    scanId:
                                        resultScanId,

                                    original:
                                        result.translation
                                            ?.original ||
                                        result.ocr
                                            ?.text ||
                                        "",

                                    vietnamese:
                                        fastVietnamese,

                                    profileName:
                                        result.study
                                            ?.profile
                                            ?.name ||
                                        "",

                                    visibleMs:
                                        0,

                                    backendPerformance:
                                        result.translation
                                            ?.performance ||
                                        null
                                };

                            return {
                                result:
                                    nextStudy,

                                fastTranslation:
                                    nextFast,

                                activeScanId:
                                    resultScanId ||
                                    current.activeScanId,

                                status,

                                isScanning:
                                    false,

                                isAnalyzing:
                                    false
                            };
                        }
                    );
                }
            );

        const removeAuthListener =
            api.onAuthChanged?.(
                (
                    nextAuth:
                        AuthStatus
                ) => {
                    setAuth(
                        nextAuth
                    );
                }
            );

        const removeEntitlementListener =
            api.onAccountEntitlementsChanged?.(
                (
                    nextEntitlements:
                        AccountEntitlements
                ) => {
                    setEntitlements(
                        nextEntitlements
                    );
                    setEntitlementMessage("");
                }
            );

        const removePaidFeatureListener =
            api.onPaidFeatureRequired?.(
                (requirement: any) => {
                    setEntitlementMessage(
                        String(
                            requirement?.message ||
                            "Tính năng này yêu cầu gói trả phí."
                        )
                    );
                    setActivePage(
                        "settings"
                    );

                    window.setTimeout(() => {
                        window.dispatchEvent(
                            new CustomEvent(
                                "ai-translator:open-settings-category",
                                { detail: "plan" }
                            )
                        );

                        window.setTimeout(() => {
                            document
                                .getElementById(
                                    "plan-license"
                                )
                                ?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start"
                                });
                        }, 40);
                    }, 60);
                }
            );

        return () => {
            removeScanListener?.();
            removeStudyFastListener?.();
            removeStudyListener?.();
            removeAuthListener?.();
            removeEntitlementListener?.();
            removePaidFeatureListener?.();
        };
    }, []);

    /*
     * Khởi tạo backend/auth.
     */
    useEffect(() => {
        void refreshBackendStatus();
        void refreshAuthStatus();
        void loadAppPreferences();
    }, []);

    useEffect(() => {
        if (backend.connected) {
            void loadSocialProviders();
        } else {
            setSocialProviders([]);
        }
    }, [backend.connected]);

    /*
     * Workspace mode cho Global Shortcut.
     * Chỉ tab Study dùng Study mode.
     * Các tab khác dùng Translate mode.
     */
    useEffect(() => {
        void api
            .setWorkspaceMode?.(
                activePage === "study"
                    ? "study"
                    : "translate"
            );
    }, [activePage]);

    useEffect(() => {
        try {
            localStorage.setItem(
                "translation.sourceLanguage",
                sourceLanguage
            );
            localStorage.setItem(
                "translation.targetLanguage",
                targetLanguage
            );
        } catch {
            // Local preference is optional.
        }

        void api
            .setTranslationLanguages?.({
                sourceLanguage,
                targetLanguage
            });
    }, [
        sourceLanguage,
        targetLanguage
    ]);

    useEffect(() => {
        setAppPreferences(
            (current) => ({
                ...current,
                study: {
                    ...current.study,
                    level:
                        studyLevel
                }
            })
        );

        void api
            .setStudyLevel?.(
                studyLevel
            );
    }, [studyLevel]);

    useEffect(() => {
        try {
            localStorage.setItem(
                "study.autoSaveVocabulary",
                String(
                    autoSaveVocabulary
                )
            );
        } catch {
            // Local preference is optional.
        }

        setAppPreferences(
            (current) => ({
                ...current,
                study: {
                    ...current.study,
                    autoSaveVocabulary
                }
            })
        );

        void api
            .setStudyAutoSaveVocabulary?.(
                autoSaveVocabulary
            );
    }, [autoSaveVocabulary]);


    useEffect(() => {
        try {
            localStorage.setItem(
                "study.autoSaveGrammar",
                String(
                    autoSaveGrammar
                )
            );
        } catch {
            // Local preference is optional.
        }

        setAppPreferences(
            (current) => ({
                ...current,
                study: {
                    ...current.study,
                    autoSaveGrammar
                }
            })
        );

        void api
            .setStudyAutoSaveGrammar?.(
                autoSaveGrammar
            );
    }, [autoSaveGrammar]);

    useEffect(() => {
        if (
            auth.authenticated &&
            activePage === "memory"
        ) {
            void loadTranslationMemory();
            void loadTranslationMemoryStats();
        }
    }, [
        auth.authenticated,
        activePage,
        translationMemoryProfileFilter,
        translationMemorySourceFilter,
        translationMemoryTargetFilter,
        translationMemoryPage
    ]);


    useEffect(() => {
        if (
            auth.authenticated &&
            activePage === "vocabulary"
        ) {
            void loadVocabulary();
            void loadVocabularyStats();
        }
    }, [
        auth.authenticated,
        activePage,
        vocabularyStatusFilter,
        vocabularyFavoriteOnly
    ]);


    useEffect(() => {
        if (
            auth.authenticated &&
            activePage === "grammar"
        ) {
            void loadGrammar();
            void loadGrammarStats();
        }
    }, [
        auth.authenticated,
        activePage,
        grammarStatusFilter,
        grammarFavoriteOnly
    ]);


    useEffect(() => {
        if (
            auth.authenticated &&
            activePage === "review"
        ) {
            void refreshReview();
        }
    }, [
        auth.authenticated,
        activePage
    ]);


    useEffect(() => {
        if (
            auth.authenticated &&
            activePage === "history"
        ) {
            void loadLearningDashboard();
        }
    }, [
        auth.authenticated,
        activePage
    ]);

    /*
     * Global shortcut chạy trong Electron Main nên
     * cần biết khi Profile chưa sẵn sàng/chưa lưu.
     */
    useEffect(() => {
        let reason = "";

        if (
            auth.authenticated &&
            !profileDraft
        ) {
            reason =
                "Chưa có Translation Profile.";
        } else if (
            profileDirty
        ) {
            reason =
                "Profile có thay đổi chưa lưu. Hãy Lưu Profile trước khi quét.";
        }

        void api
            .setWorkspaceScanGuard?.(
                reason
            );
    }, [
        auth.authenticated,
        profileDraft?.id,
        profileDirty
    ]);

    /*
     * Khi login/logout.
     */
    useEffect(() => {
        if (auth.authenticated) {
            void loadDevices();
            void loadProfiles();
            void refreshEntitlements();
            void loadAccountIdentities();
        } else {
            setEntitlements({
                planCode: "FREE",
                planName: "Free",
                subscriptionStatus: "ACTIVE",
                subscriptionSource: "DEFAULT",
                periodEnd: null,
                features: {
                    quickTranslate: true,
                    studyMode: false,
                    mangaPanel: false,
                    mangaSession: false,
                    translationMemory: true,
                    continuousManga: false,
                    novelReaderTxt: false,
                    novelReaderEpub: false
                },
                limits: {
                    monthlyTranslations: 300,
                    mangaPagesPerDay: 0,
                    continuousMangaPagesPerDay: 0,
                    contextItems: 5,
                    devices: 1
                },
                usage: {
                    monthlyTranslationsUsed: 0
                },
                developmentOverride: false
            });
            setEntitlementMessage("");

            setDevices([]);
            setAccountIdentities([]);
            setProfiles([]);
            setProfileDraft(null);
            setProfileDirty(false);
            setProfileMessage("");

            setVocabularyItems([]);
            setVocabularyStats({
                total: 0,
                newCount: 0,
                learningCount: 0,
                knownCount: 0,
                favoriteCount: 0
            });
            setVocabularyMessage("");

            setGrammarItems([]);
            setGrammarStats({
                total: 0,
                newCount: 0,
                learningCount: 0,
                knownCount: 0,
                favoriteCount: 0
            });
            setGrammarMessage("");

            setReviewQueue({
                items: [],
                totalDue: 0,
                vocabularyDue: 0,
                grammarDue: 0
            });

            setReviewStats({
                dueNow: 0,
                vocabularyDue: 0,
                grammarDue: 0,
                reviewedLast24h: 0,
                correctLast24h: 0,
                wrongLast24h: 0,
                accuracyLast24h: 0,
                againLast24h: 0,
                hardLast24h: 0,
                goodLast24h: 0,
                easyLast24h: 0
            });

            setReviewMessage("");

            setLearningDashboard({
                overview: {
                    reviewed14Days: 0,
                    correct14Days: 0,
                    wrong14Days: 0,
                    accuracy14Days: 0,
                    activeDays14Days: 0,
                    currentStreakDays: 0,
                    weakItems: 0,
                    masteredItems: 0
                },
                dailyActivity: [],
                weakItems: [],
                recentReviews: []
            });
            setLearningDashboardMessage("");

            setStudy({
                result: null,
                fastTranslation: null,
                activeScanId: null,
                status: "Sẵn sàng học",
                isScanning: false,
                isAnalyzing: false
            });

            void api
                .setActiveTranslationProfile?.(
                    null
                );
        }
    }, [auth.authenticated]);

    async function refreshBackendStatus() {
        try {
            setIsCheckingBackend(
                true
            );

            const result:
                BackendStatus =
                await api
                    .getBackendStatus();

            setBackend(result);
        } catch (error) {
            setBackend(
                (current) => ({
                    connected:
                        false,

                    status:
                        "DOWN",

                    baseUrl:
                        current.baseUrl,

                    error:
                        error instanceof Error
                            ? error.message
                            : String(error)
                })
            );
        } finally {
            setIsCheckingBackend(
                false
            );
        }
    }

    async function refreshAuthStatus() {
        try {
            const result:
                AuthStatus =
                await api
                    .getAuthStatus();

            setAuth(result);
        } catch (error) {
            setAuthMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    async function loadSocialProviders() {
        try {
            const result =
                await api
                    .getSocialAuthProviders?.();

            setSocialProviders(
                Array.isArray(result)
                    ? result
                    : []
            );
        } catch (error) {
            console.error(
                "SOCIAL PROVIDERS ERROR:",
                error
            );
            setSocialProviders([]);
        }
    }

    function authErrorCode(
        error: unknown
    ): string {
        if (
            typeof error !== "object" ||
            error === null
        ) {
            return "";
        }

        return String(
            (
                error as {
                    code?: unknown;
                }
            ).code ||
            ""
        );
    }

    function unwrapStructuredAuthResult<T>(
        result: unknown
    ): T {
        if (
            typeof result !== "object" ||
            result === null ||
            !("ok" in result)
        ) {
            return result as T;
        }

        const structured =
            result as {
                ok?: boolean;
                value?: T;
                error?: {
                    message?: unknown;
                    code?: unknown;
                    statusCode?: unknown;
                    requestId?: unknown;
                };
            };

        if (structured.ok) {
            return structured.value as T;
        }

        const info =
            structured.error || {};

        const error =
            new Error(
                String(
                    info.message ||
                    "Không thể hoàn tất yêu cầu đăng nhập."
                )
            ) as Error & {
                code?: string;
                statusCode?: number | null;
                requestId?: string;
            };

        error.code =
            String(
                info.code ||
                ""
            );

        const statusCode =
            Number(
                info.statusCode
            );

        error.statusCode =
            Number.isFinite(statusCode)
                ? statusCode
                : null;

        error.requestId =
            String(
                info.requestId ||
                ""
            );

        throw error;
    }

    function clearEmailVerificationState() {
        setEmailVerificationRequired(false);
        setEmailVerificationEmail("");
        setEmailVerificationCode("");
        setEmailVerificationMessage("");
        setEmailVerificationCooldownSeconds(0);
    }

    function openEmailVerificationFromError(
        error: unknown,
        initialEmail = "",
        codeAlreadySent = false
    ): boolean {
        if (
            authErrorCode(error) !==
            "EMAIL_VERIFICATION_REQUIRED"
        ) {
            return false;
        }

        setEmailVerificationRequired(true);

        setEmailVerificationEmail(
            initialEmail.trim()
        );

        setEmailVerificationCode("");

        setEmailVerificationMessage(
            codeAlreadySent
                ? "Mã xác minh đã được gửi đến email của bạn."
                : "Email chưa được xác minh. Hãy gửi mã xác minh để tiếp tục."
        );

        setEmailVerificationCooldownSeconds(
            codeAlreadySent
                ? 60
                : 0
        );

        clearDeviceTransferState();

        setAuthMessage(
            "Vui lòng xác minh email để tiếp tục đăng nhập."
        );

        return true;
    }

    async function requestEmailVerification() {
        const cleanEmail =
            emailVerificationEmail.trim();

        if (!backend.connected) {
            setEmailVerificationMessage(
                "Không thể kết nối dịch vụ. Vui lòng thử lại."
            );
            return;
        }

        if (!cleanEmail) {
            setEmailVerificationMessage(
                "Không xác định được email cần xác minh."
            );
            return;
        }

        if (
            emailVerificationCooldownSeconds > 0
        ) {
            return;
        }

        try {
            setIsEmailVerificationRequestLoading(
                true
            );

            setEmailVerificationMessage("");

            const result =
                unwrapStructuredAuthResult<{
                    accepted?: boolean;
                    cooldownSeconds?: number;
                    message?: string;
                }>(
                    await api.requestEmailVerification({
                        email: cleanEmail
                    })
                );

            const cooldown =
                Number(
                    result?.cooldownSeconds
                );

            setEmailVerificationCooldownSeconds(
                Number.isFinite(cooldown)
                    ? Math.max(
                        0,
                        cooldown
                    )
                    : 60
            );

            setEmailVerificationMessage(
                result?.message ||
                "Nếu email cần xác minh, mã xác minh đã được gửi."
            );
        } catch (error) {
            setEmailVerificationMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsEmailVerificationRequestLoading(
                false
            );
        }
    }

    async function confirmEmailVerification(
        event: FormEvent
    ) {
        event.preventDefault();

        const cleanEmail =
            emailVerificationEmail.trim();

        if (
            emailVerificationCode.length !== 6
        ) {
            setEmailVerificationMessage(
                "Nhập mã xác minh gồm 6 chữ số."
            );
            return;
        }

        try {
            setIsEmailVerificationConfirmLoading(
                true
            );

            setEmailVerificationMessage("");

            const result: AuthStatus =
                unwrapStructuredAuthResult<AuthStatus>(
                    await api.confirmEmailVerification({
                        email: cleanEmail,
                        code:
                            emailVerificationCode
                    })
                );

            setAuth(result);
            setPassword("");

            clearEmailVerificationState();
            clearDeviceTransferState();

            setAuthMessage(
                "Xác minh email và đăng nhập thành công."
            );
        } catch (error) {
            setEmailVerificationMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsEmailVerificationConfirmLoading(
                false
            );
        }
    }

    function cancelEmailVerification() {
        clearEmailVerificationState();

        setAuthMessage(
            "Đã hủy xác minh email."
        );
    }

    function clearDeviceTransferState() {
        setDeviceTransferRequired(false);
        setDeviceTransferEmail("");
        setDeviceTransferCode("");
        setDeviceTransferMessage("");
        setDeviceTransferCooldownSeconds(0);
    }

    function openDeviceTransferFromError(
        error: unknown,
        initialEmail = ""
    ): boolean {
        if (
            authErrorCode(error) !==
            "DEVICE_BINDING_MISMATCH"
        ) {
            return false;
        }

        setDeviceTransferRequired(true);
        setDeviceTransferEmail(
            initialEmail.trim()
        );
        setDeviceTransferCode("");
        setDeviceTransferMessage("");
        setDeviceTransferCooldownSeconds(0);

        setAuthMessage(
            "Tài khoản này đang liên kết với thiết bị khác. " +
            "Xác minh email để chuyển tài khoản sang máy này."
        );

        return true;
    }

    async function requestDeviceTransfer() {
        const cleanEmail =
            deviceTransferEmail.trim();

        if (!backend.connected) {
            setDeviceTransferMessage(
                "Không thể kết nối dịch vụ. Vui lòng thử lại."
            );
            return;
        }

        if (!cleanEmail) {
            setDeviceTransferMessage(
                "Nhập email của tài khoản cần chuyển."
            );
            return;
        }

        if (
            deviceTransferCooldownSeconds > 0
        ) {
            return;
        }

        const request =
            (
                api as typeof api & {
                    requestDeviceTransfer?: (
                        payload: {
                            email: string;
                        }
                    ) => Promise<{
                        accepted?: boolean;
                        message?: string;
                        cooldownSeconds?: number;
                    }>;
                }
            ).requestDeviceTransfer;

        if (!request) {
            setDeviceTransferMessage(
                "Desktop hiện tại chưa hỗ trợ chuyển thiết bị."
            );
            return;
        }

        try {
            setIsDeviceTransferRequestLoading(
                true
            );
            setDeviceTransferMessage("");

            const result =
                unwrapStructuredAuthResult<{
                    accepted?: boolean;
                    message?: string;
                    cooldownSeconds?: number;
                }>(
                    await request({
                        email: cleanEmail
                    })
                );

            setDeviceTransferEmail(
                cleanEmail
            );

            const cooldown =
                Number(
                    result?.cooldownSeconds
                );

            setDeviceTransferCooldownSeconds(
                Number.isFinite(cooldown) &&
                cooldown > 0
                    ? Math.ceil(cooldown)
                    : 60
            );

            setDeviceTransferMessage(
                result?.message ||
                "Nếu tài khoản đủ điều kiện, mã xác minh đã được gửi tới email."
            );
        } catch (error) {
            setDeviceTransferMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsDeviceTransferRequestLoading(
                false
            );
        }
    }

    async function confirmDeviceTransfer(
        event: FormEvent
    ) {
        event.preventDefault();

        const cleanEmail =
            deviceTransferEmail.trim();

        const cleanCode =
            deviceTransferCode.trim();

        if (!backend.connected) {
            setDeviceTransferMessage(
                "Không thể kết nối dịch vụ. Vui lòng thử lại."
            );
            return;
        }

        if (!cleanEmail) {
            setDeviceTransferMessage(
                "Nhập email của tài khoản."
            );
            return;
        }

        if (
            !/^\d{6}$/.test(
                cleanCode
            )
        ) {
            setDeviceTransferMessage(
                "Mã xác minh phải gồm đúng 6 chữ số."
            );
            return;
        }

        const confirm =
            (
                api as typeof api & {
                    confirmDeviceTransfer?: (
                        payload: {
                            email: string;
                            code: string;
                        }
                    ) => Promise<AuthStatus>;
                }
            ).confirmDeviceTransfer;

        if (!confirm) {
            setDeviceTransferMessage(
                "Desktop hiện tại chưa hỗ trợ xác nhận chuyển thiết bị."
            );
            return;
        }

        try {
            setIsDeviceTransferConfirmLoading(
                true
            );
            setDeviceTransferMessage("");

            const result =
                unwrapStructuredAuthResult<AuthStatus>(
                    await confirm({
                        email: cleanEmail,
                        code: cleanCode
                    })
                );

            setAuth(result);
            setPassword("");

            clearDeviceTransferState();

            setAuthMessage(
                "Đã chuyển tài khoản sang thiết bị này và đăng nhập thành công."
            );
        } catch (error) {
            setDeviceTransferMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsDeviceTransferConfirmLoading(
                false
            );
        }
    }

    function cancelDeviceTransfer() {
        clearDeviceTransferState();

        setAuthMessage(
            "Đã hủy chuyển thiết bị."
        );
    }

    async function socialLogin(
        provider: SocialAuthProviderCode
    ) {
        if (!backend.connected) {
            setAuthMessage(
                "Không thể kết nối dịch vụ. Vui lòng thử lại."
            );
            return;
        }

        try {
            setSocialAuthLoadingProvider(
                provider
            );
            setAuthMessage(
                `Đang mở ${provider === "GOOGLE" ? "Google" : "Facebook"} trong trình duyệt...`
            );

            const result: AuthStatus =
                unwrapStructuredAuthResult<AuthStatus>(
                    await api.socialLogin(
                        provider
                    )
                );

            setAuth(result);
            setPassword("");

            clearDeviceTransferState();

            setAuthMessage(
                `Đăng nhập bằng ${provider === "GOOGLE" ? "Google" : "Facebook"} thành công.`
            );
        } catch (error) {
            if (
                !openDeviceTransferFromError(
                    error,
                    email
                )
            ) {
                setAuthMessage(
                    error instanceof Error
                        ? error.message
                        : String(error)
                );
            }
        } finally {
            setSocialAuthLoadingProvider(
                null
            );
        }
    }

    async function cancelSocialLogin() {
        if (!socialAuthLoadingProvider) {
            return;
        }

        try {
            const result =
                await api.cancelSocialLogin?.();

            setAuthMessage(
                result?.cancelled
                    ? "Đã hủy đăng nhập."
                    : "Không có phiên đăng nhập Social đang chờ."
            );
        } catch (error) {
            setAuthMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setSocialAuthLoadingProvider(
                null
            );
        }
    }

    async function loadAccountIdentities() {
        if (!auth.authenticated) {
            setAccountIdentities([]);
            return;
        }

        try {
            const result =
                await api
                    .getAccountIdentities?.();

            setAccountIdentities(
                Array.isArray(result)
                    ? result
                    : []
            );
        } catch (error) {
            console.error(
                "ACCOUNT IDENTITIES ERROR:",
                error
            );
        }
    }

    async function linkAccountIdentity(
        provider: SocialAuthProviderCode
    ) {
        try {
            setSocialAuthLoadingProvider(
                provider
            );
            setAuthMessage(
                `Đang liên kết ${provider === "GOOGLE" ? "Google" : "Facebook"}...`
            );

            const result =
                await api
                    .linkAccountIdentity(
                        provider
                    );

            setAccountIdentities(
                Array.isArray(
                    result?.identities
                )
                    ? result.identities
                    : []
            );

            setAuthMessage(
                `Đã liên kết ${provider === "GOOGLE" ? "Google" : "Facebook"}.`
            );
        } catch (error) {
            setAuthMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setSocialAuthLoadingProvider(
                null
            );
        }
    }

    async function submitAuth(
        event: FormEvent
    ) {
        event.preventDefault();

        if (!backend.connected) {
            setAuthMessage(
                "Không thể kết nối dịch vụ. Vui lòng thử lại."
            );
            return;
        }

        if (
            !email.trim() ||
            !password
        ) {
            setAuthMessage(
                "Nhập email và mật khẩu."
            );
            return;
        }

        try {
            setIsAuthLoading(true);
            setAuthMessage("");

            const credentials = {
                email:
                    email.trim(),
                password
            };

            const result:
                AuthStatus =
                unwrapStructuredAuthResult<AuthStatus>(
                    authMode === "login"
                        ? await api.login(
                            credentials
                        )
                        : await api.register(
                            credentials
                        )
                );

            setPassword("");
            setAuth(result);

            clearEmailVerificationState();
            clearDeviceTransferState();

            setAuthMessage(
                authMode === "login"
                    ? "Đăng nhập thành công."
                    : "Tạo tài khoản thành công."
            );
        } catch (error) {
            setPassword("");

            if (
                openEmailVerificationFromError(
                    error,
                    email,
                    authMode === "register"
                )
            ) {
                return;
            }

            if (
                authMode === "login" &&
                openDeviceTransferFromError(
                    error,
                    email
                )
            ) {
                return;
            }

            setAuthMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsAuthLoading(false);
        }
    }

    async function logout() {
        try {
            setIsAuthLoading(true);

            await api.logout();

            setAuth({
                authenticated:
                    false,
                user: null
            });

            setEntitlements({
                planCode: "FREE",
                planName: "Free",
                subscriptionStatus: "ACTIVE",
                subscriptionSource: "DEFAULT",
                periodEnd: null,
                features: {
                    quickTranslate: true,
                    studyMode: false,
                    mangaPanel: false,
                    mangaSession: false,
                    translationMemory: true,
                    continuousManga: false,
                    novelReaderTxt: false,
                    novelReaderEpub: false
                },
                limits: {
                    monthlyTranslations: 300,
                    mangaPagesPerDay: 0,
                    continuousMangaPagesPerDay: 0,
                    contextItems: 5,
                    devices: 1
                },
                usage: {
                    monthlyTranslationsUsed: 0
                },
                developmentOverride: false
            });
            setEntitlementMessage("");

            setDevices([]);
            setProfiles([]);
            setProfileDraft(null);

            setVocabularyItems([]);
            setVocabularyStats({
                total: 0,
                newCount: 0,
                learningCount: 0,
                knownCount: 0,
                favoriteCount: 0
            });
            setVocabularyMessage("");

            setGrammarItems([]);
            setGrammarStats({
                total: 0,
                newCount: 0,
                learningCount: 0,
                knownCount: 0,
                favoriteCount: 0
            });
            setGrammarMessage("");

            setTranslation({
                original: "",
                vietnamese: "",
                status: "Đã đăng xuất",
                isScanning: false
            });

            setStudy({
                result: null,
                fastTranslation: null,
                activeScanId: null,
                status: "Đã đăng xuất",
                isScanning: false,
                isAnalyzing: false
            });

            setAuthMessage(
                "Đã đăng xuất."
            );
        } catch (error) {
            setAuthMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsAuthLoading(false);
        }
    }

    async function restoreSession() {
        try {
            setIsAuthLoading(true);
            setAuthMessage("");

            const result =
                await api
                    .refreshSession();

            await refreshAuthStatus();

            if (!result.success) {
                setAuthMessage(
                    "Không thể khôi phục phiên đăng nhập."
                );
            }
        } catch (error) {
            setAuthMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsAuthLoading(false);
        }
    }

    async function refreshEntitlements() {
        if (!auth.authenticated) {
            return;
        }

        try {
            setIsEntitlementLoading(true);

            const result:
                AccountEntitlements =
                await api
                    .getAccountEntitlements();

            setEntitlements(result);
            setEntitlementMessage("");
        } catch (error) {
            setEntitlementMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsEntitlementLoading(false);
        }
    }

    async function activateLicense(
        licenseKey: string
    ) {
        try {
            setIsEntitlementLoading(true);
            setEntitlementMessage("");

            const result:
                AccountEntitlements =
                await api
                    .activateLicense(
                        licenseKey
                    );

            setEntitlements(result);

            setEntitlementMessage(
                `Đã kích hoạt gói ${result.planName}.`
            );
        } catch (error) {
            setEntitlementMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            throw error;
        } finally {
            setIsEntitlementLoading(false);
        }
    }

    async function loadDevices() {
        try {
            setIsLoadingDevices(true);

            const result =
                await api
                    .getDevices();

            setDevices(
                Array.isArray(result)
                    ? result
                    : []
            );
        } catch (error) {
            setAuthMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsLoadingDevices(false);
        }
    }

    async function revokeDevice(
        sessionId: number
    ) {
        try {
            await api
                .revokeDevice(
                    sessionId
                );

            await loadDevices();
        } catch (error) {
            setAuthMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    async function loadTranslationMemory(
        pageOverride = translationMemoryPage
    ) {
        if (!auth.authenticated) {
            return;
        }

        try {
            setTranslationMemoryLoading(true);

            const result =
                await api.listTranslationMemory({
                    q: translationMemoryQuery,
                    profileId:
                        translationMemoryProfileFilter === "ALL"
                            ? undefined
                            : translationMemoryProfileFilter,
                    sourceLanguage:
                        translationMemorySourceFilter,
                    targetLanguage:
                        translationMemoryTargetFilter,
                    page: pageOverride,
                    size: 50
                });

            setTranslationMemoryItems(
                Array.isArray(result?.items)
                    ? result.items
                    : []
            );

            setTranslationMemoryTotalPages(
                Number(result?.totalPages || 0)
            );

            setTranslationMemoryMessage("");
        } catch (error) {
            setTranslationMemoryMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setTranslationMemoryLoading(false);
        }
    }

    async function loadTranslationMemoryStats() {
        if (!auth.authenticated) {
            return;
        }

        try {
            const result =
                await api.getTranslationMemoryStats();

            setTranslationMemoryStats({
                totalItems: Number(result?.totalItems || 0),
                totalHits: Number(result?.totalHits || 0),
                usedItems: Number(result?.usedItems || 0)
            });
        } catch (error) {
            setTranslationMemoryMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    async function refreshTranslationMemory() {
        await Promise.all([
            loadTranslationMemory(translationMemoryPage),
            loadTranslationMemoryStats()
        ]);
    }

    async function searchTranslationMemory() {
        setTranslationMemoryPage(0);
        await loadTranslationMemory(0);
    }

    function changeTranslationMemoryPage(
        nextPage: number
    ) {
        const safePage = Math.max(
            0,
            Math.min(
                Math.max(0, translationMemoryTotalPages - 1),
                nextPage
            )
        );

        setTranslationMemoryPage(safePage);
    }

    async function updateTranslationMemoryItem(
        memoryId: number,
        correctedTranslation: string
    ) {
        try {
            const updated: TranslationMemoryItem =
                await api.updateTranslationMemory(
                    memoryId,
                    correctedTranslation
                );

            setTranslationMemoryItems(
                (current) =>
                    current.map((item) =>
                        item.id === updated.id
                            ? updated
                            : item
                    )
            );

            setTranslationMemoryMessage(
                "Đã cập nhật Translation Memory. Cache/context liên quan đã được làm mới."
            );
        } catch (error) {
            setTranslationMemoryMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            throw error;
        }
    }

    async function deleteTranslationMemoryItem(
        memory: TranslationMemoryItem
    ) {
        try {
            await api.deleteTranslationMemory(
                memory.id,
                memory
            );

            const nextPage =
                translationMemoryItems.length === 1 &&
                translationMemoryPage > 0
                    ? translationMemoryPage - 1
                    : translationMemoryPage;

            if (nextPage !== translationMemoryPage) {
                setTranslationMemoryPage(nextPage);
            }

            await Promise.all([
                loadTranslationMemory(nextPage),
                loadTranslationMemoryStats()
            ]);

            setTranslationMemoryMessage(
                "Đã xóa Translation Memory. Lần sau câu này sẽ dùng cache/AI bình thường."
            );
        } catch (error) {
            setTranslationMemoryMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            throw error;
        }
    }

    async function loadVocabulary() {
        if (!auth.authenticated) {
            return;
        }

        try {
            setVocabularyLoading(
                true
            );

            const result =
                await api
                    .listVocabulary({
                        q:
                            vocabularyQuery,

                        status:
                            vocabularyStatusFilter,

                        favorite:
                            vocabularyFavoriteOnly
                                ? true
                                : undefined,

                        page: 0,
                        size: 100
                    });

            setVocabularyItems(
                Array.isArray(
                    result?.items
                )
                    ? result.items
                    : []
            );

            setVocabularyMessage("");
        } catch (error) {
            setVocabularyMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setVocabularyLoading(
                false
            );
        }
    }

    async function loadVocabularyStats() {
        if (!auth.authenticated) {
            return;
        }

        try {
            const result =
                await api
                    .getVocabularyStats();

            setVocabularyStats({
                total:
                    Number(
                        result?.total ||
                        0
                    ),

                newCount:
                    Number(
                        result?.newCount ||
                        0
                    ),

                learningCount:
                    Number(
                        result
                            ?.learningCount ||
                        0
                    ),

                knownCount:
                    Number(
                        result?.knownCount ||
                        0
                    ),

                favoriteCount:
                    Number(
                        result
                            ?.favoriteCount ||
                        0
                    )
            });
        } catch (error) {
            setVocabularyMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    async function refreshVocabulary() {
        await Promise.all([
            loadVocabulary(),
            loadVocabularyStats()
        ]);
    }

    async function saveStudyVocabulary(
        item:
            StudyVocabularyItem
    ) {
        try {
            await api
                .saveVocabulary({
                    surface:
                        item.surface,

                    dictionaryForm:
                        item.dictionaryForm ||
                        item.surface,

                    reading:
                        item.reading,

                    romaji:
                        item.romaji,

                    meaning:
                        item.meaning,

                    partOfSpeech:
                        item.partOfSpeech,

                    jlptLevel:
                        item.jlptLevel,

                    /*
                     * Click + Lưu không phải là
                     * một lần gặp mới.
                     */
                    recordEncounter:
                        false
                });

            setStudy(
                (current) => ({
                    ...current,
                    status:
                        `Đã lưu ${item.dictionaryForm || item.surface} vào Từ vựng`
                })
            );

            await loadVocabularyStats();
        } catch (error) {
            setStudy(
                (current) => ({
                    ...current,
                    status:
                        error instanceof Error
                            ? error.message
                            : String(error)
                })
            );

            throw error;
        }
    }

    async function updateVocabularyItem(
        vocabularyId: number,
        patch: {
            status?: VocabularyStatus;
            favorite?: boolean;
            personalNote?: string;
        }
    ) {
        try {
            const updated:
                VocabularyItem =
                await api
                    .updateVocabulary(
                        vocabularyId,
                        patch
                    );

            setVocabularyItems(
                (current) =>
                    current.map(
                        (item) =>
                            item.id ===
                            updated.id
                                ? updated
                                : item
                    )
            );

            await loadVocabularyStats();

            /*
             * Nếu đổi status/favorite làm item
             * không còn phù hợp filter hiện tại,
             * reload danh sách.
             */
            if (
                vocabularyStatusFilter !==
                    "ALL"
                ||
                vocabularyFavoriteOnly
            ) {
                await loadVocabulary();
            }
        } catch (error) {
            setVocabularyMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            throw error;
        }
    }

    async function deleteVocabularyItem(
        vocabularyId: number
    ) {
        try {
            await api
                .deleteVocabulary(
                    vocabularyId
                );

            setVocabularyItems(
                (current) =>
                    current.filter(
                        (item) =>
                            item.id !==
                            vocabularyId
                    )
            );

            await loadVocabularyStats();

            setVocabularyMessage(
                "Đã xóa từ khỏi kho cá nhân."
            );
        } catch (error) {
            setVocabularyMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            throw error;
        }
    }

    async function loadGrammar() {
        if (!auth.authenticated) {
            return;
        }

        try {
            setGrammarLoading(
                true
            );

            const result =
                await api
                    .listGrammar({
                        q:
                            grammarQuery,

                        status:
                            grammarStatusFilter,

                        favorite:
                            grammarFavoriteOnly
                                ? true
                                : undefined,

                        page: 0,
                        size: 100
                    });

            setGrammarItems(
                Array.isArray(
                    result?.items
                )
                    ? result.items
                    : []
            );

            setGrammarMessage("");
        } catch (error) {
            setGrammarMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setGrammarLoading(
                false
            );
        }
    }

    async function loadGrammarStats() {
        if (!auth.authenticated) {
            return;
        }

        try {
            const result =
                await api
                    .getGrammarStats();

            setGrammarStats({
                total:
                    Number(
                        result?.total ||
                        0
                    ),

                newCount:
                    Number(
                        result?.newCount ||
                        0
                    ),

                learningCount:
                    Number(
                        result
                            ?.learningCount ||
                        0
                    ),

                knownCount:
                    Number(
                        result?.knownCount ||
                        0
                    ),

                favoriteCount:
                    Number(
                        result
                            ?.favoriteCount ||
                        0
                    )
            });
        } catch (error) {
            setGrammarMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    async function refreshGrammar() {
        await Promise.all([
            loadGrammar(),
            loadGrammarStats()
        ]);
    }

    async function saveStudyGrammar(
        item:
            StudyGrammarPoint
    ) {
        try {
            await api
                .saveGrammar({
                    pattern:
                        item.pattern,

                    jlptLevel:
                        item.jlptLevel,

                    meaning:
                        item.meaning,

                    explanation:
                        item.explanation,

                    /*
                     * Click + Lưu là thao tác chủ động,
                     * không phải một encounter mới.
                     */
                    recordEncounter:
                        false
                });

            setStudy(
                (current) => ({
                    ...current,
                    status:
                        `Đã lưu ${item.pattern} vào Ngữ pháp`
                })
            );

            await loadGrammarStats();
        } catch (error) {
            setStudy(
                (current) => ({
                    ...current,
                    status:
                        error instanceof Error
                            ? error.message
                            : String(error)
                })
            );

            throw error;
        }
    }

    async function updateGrammarItem(
        grammarId: number,
        patch: {
            status?: GrammarStatus;
            favorite?: boolean;
            personalNote?: string;
        }
    ) {
        try {
            const updated:
                GrammarItem =
                await api
                    .updateGrammar(
                        grammarId,
                        patch
                    );

            setGrammarItems(
                (current) =>
                    current.map(
                        (item) =>
                            item.id ===
                            updated.id
                                ? updated
                                : item
                    )
            );

            await loadGrammarStats();

            if (
                grammarStatusFilter !==
                    "ALL"
                ||
                grammarFavoriteOnly
            ) {
                await loadGrammar();
            }
        } catch (error) {
            setGrammarMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            throw error;
        }
    }

    async function deleteGrammarItem(
        grammarId: number
    ) {
        try {
            await api
                .deleteGrammar(
                    grammarId
                );

            setGrammarItems(
                (current) =>
                    current.filter(
                        (item) =>
                            item.id !==
                            grammarId
                    )
            );

            await loadGrammarStats();

            setGrammarMessage(
                "Đã xóa cấu trúc/ngữ pháp."
            );
        } catch (error) {
            setGrammarMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            throw error;
        }
    }

    async function loadReviewQueue() {
        if (!auth.authenticated) {
            return;
        }

        try {
            const result:
                ReviewQueue =
                await api
                    .getReviewQueue(
                        30
                    );

            setReviewQueue({
                items:
                    Array.isArray(
                        result?.items
                    )
                        ? result.items
                        : [],

                totalDue:
                    Number(
                        result?.totalDue ||
                        0
                    ),

                vocabularyDue:
                    Number(
                        result
                            ?.vocabularyDue ||
                        0
                    ),

                grammarDue:
                    Number(
                        result?.grammarDue ||
                        0
                    )
            });
        } catch (error) {
            setReviewMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    async function loadPracticeReviewQueue():
        Promise<ReviewQueue> {
        if (!auth.authenticated) {
            return {
                items: [],
                totalDue: 0,
                vocabularyDue: 0,
                grammarDue: 0
            };
        }

        const result:
            ReviewQueue =
            await api
                .getPracticeReviewQueue(
                    30
                );

        return {
            items:
                Array.isArray(
                    result?.items
                )
                    ? result.items
                    : [],

            totalDue:
                Number(
                    result?.totalDue ||
                    0
                ),

            vocabularyDue:
                Number(
                    result?.vocabularyDue ||
                    0
                ),

            grammarDue:
                Number(
                    result?.grammarDue ||
                    0
                )
        };
    }

    async function loadReviewStats() {
        if (!auth.authenticated) {
            return;
        }

        try {
            const result:
                ReviewStats =
                await api
                    .getReviewStats();

            setReviewStats({
                dueNow:
                    Number(
                        result?.dueNow ||
                        0
                    ),

                vocabularyDue:
                    Number(
                        result
                            ?.vocabularyDue ||
                        0
                    ),

                grammarDue:
                    Number(
                        result?.grammarDue ||
                        0
                    ),

                reviewedLast24h:
                    Number(
                        result
                            ?.reviewedLast24h ||
                        0
                    ),

                correctLast24h:
                    Number(
                        result
                            ?.correctLast24h ||
                        0
                    ),

                wrongLast24h:
                    Number(
                        result
                            ?.wrongLast24h ||
                        0
                    ),

                accuracyLast24h:
                    Number(
                        result
                            ?.accuracyLast24h ||
                        0
                    ),

                againLast24h:
                    Number(
                        result
                            ?.againLast24h ||
                        0
                    ),

                hardLast24h:
                    Number(
                        result
                            ?.hardLast24h ||
                        0
                    ),

                goodLast24h:
                    Number(
                        result
                            ?.goodLast24h ||
                        0
                    ),

                easyLast24h:
                    Number(
                        result
                            ?.easyLast24h ||
                        0
                    )
            });
        } catch (error) {
            setReviewMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    async function refreshReview() {
        if (!auth.authenticated) {
            return;
        }

        try {
            setReviewLoading(
                true
            );

            setReviewMessage("");

            await Promise.all([
                loadReviewQueue(),
                loadReviewStats()
            ]);
        } finally {
            setReviewLoading(
                false
            );
        }
    }

    async function answerReview(
        item:
            ReviewItem,
        selectedOptionId:
            string,
        responseTimeMs:
            number,
        practice:
            boolean
    ) {
        try {
            setReviewLoading(
                true
            );

            const result:
                ReviewAnswerResponse =
                await api
                    .answerReviewItem({
                        itemType:
                            item.itemType,

                        itemId:
                            item.itemId,

                        selectedOptionId,

                        responseTimeMs,

                        practice
                    });

            const masteryLabels:
                Record<
                    ReviewMasteryLevel,
                    string
                > = {
                    NEW:
                        "Mới",
                    WEAK:
                        "Yếu",
                    LEARNING:
                        "Đang học",
                    FAMILIAR:
                        "Khá thuộc",
                    MASTERED:
                        "Đã thuộc"
                };

            if (result.practice) {
                setReviewMessage(
                    result.correct
                        ? `Ôn lại: đúng · ${masteryLabels[result.masteryLevel]} · không thay đổi lịch SRS`
                        : `Ôn lại: sai · đáp án đúng: ${result.correctAnswer} · card sẽ xuất hiện lại trong phiên`
                );
            } else {
                setReviewMessage(
                    result.correct
                        ? `Đúng · ${masteryLabels[result.masteryLevel]} · chính xác ${result.accuracyPercent}%`
                        : `Sai · đáp án đúng: ${result.correctAnswer} · chính xác ${result.accuracyPercent}%`
                );

                await loadReviewStats();
            }

            return result;
        } catch (error) {
            setReviewMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            throw error;
        } finally {
            setReviewLoading(
                false
            );
        }
    }

    async function advanceReview() {
        try {
            setReviewLoading(
                true
            );

            await Promise.all([
                loadReviewQueue(),
                loadReviewStats()
            ]);
        } finally {
            setReviewLoading(
                false
            );
        }
    }

    function skipReviewItem(
        item:
            ReviewItem
    ) {
        setReviewQueue(
            (current) => ({
                ...current,

                items:
                    current.items.filter(
                        (candidate) =>
                            !(
                                candidate.itemType ===
                                    item.itemType
                                &&
                                candidate.itemId ===
                                    item.itemId
                            )
                    )
            })
        );
    }

    async function loadLearningDashboard() {
        if (!auth.authenticated) {
            return;
        }

        try {
            setLearningDashboardLoading(
                true
            );

            const result:
                LearningDashboard =
                await api
                    .getLearningDashboard();

            setLearningDashboard(
                result
            );

            setLearningDashboardMessage("");
        } catch (error) {
            setLearningDashboardMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setLearningDashboardLoading(
                false
            );
        }
    }

    async function loadAppPreferences() {
        try {
            let result:
                AppPreferences =
                await api
                    .getAppPreferences();

            /*
             * V6.9 migration:
             * V6.8 chỉ lưu hotkey trong app-preferences.json,
             * còn auto-save Study nằm ở localStorage.
             * Chỉ migrate một lần khi Main báo legacyMigrationNeeded.
             */
            if (
                result
                    .legacyMigrationNeeded
            ) {
                result =
                    await api
                        .updateAppPreferences({
                            study: {
                                level:
                                    studyLevel,
                                autoSaveVocabulary,
                                autoSaveGrammar
                            }
                        });
            }

            applyAppPreferences(
                result
            );

            setPreferencesMessage("");

            if (
                !result
                    .onboardingCompleted
            ) {
                setOnboardingReplay(
                    false
                );

                setShowOnboarding(
                    true
                );
            }
        } catch (error) {
            setPreferencesMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            /*
             * Fallback để hotkey UI vẫn tải được
             * nếu app-preferences mới gặp lỗi.
             */
            await loadShortcutSettings();
        }
    }

    function applyAppPreferences(
        result:
            AppPreferences
    ) {
        setAppPreferences(
            result
        );

        setShortcutSettings(
            result.shortcuts
        );

        setStudyLevel(
            result.study.level
        );

        setAutoSaveVocabulary(
            result
                .study
                .autoSaveVocabulary
        );

        setAutoSaveGrammar(
            result
                .study
                .autoSaveGrammar
        );
    }

    async function saveAppPreferences(
        next:
            Partial<{
                study:
                    AppPreferences["study"];
                overlay:
                    AppPreferences["overlay"];
            }>
    ) {
        try {
            const result:
                AppPreferences =
                await api
                    .updateAppPreferences(
                        next
                    );

            applyAppPreferences(
                result
            );

            setPreferencesMessage(
                "Đã lưu cài đặt ứng dụng."
            );

            return result;
        } catch (error) {
            setPreferencesMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            throw error;
        }
    }

    async function resetAppPreferences() {
        try {
            const result:
                AppPreferences =
                await api
                    .resetAppPreferences();

            applyAppPreferences(
                result
            );

            setPreferencesMessage(
                "Đã khôi phục cài đặt mặc định. Dữ liệu học và tài khoản không bị xóa."
            );
        } catch (error) {
            setPreferencesMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            throw error;
        }
    }

    async function completeOnboarding() {
        if (
            onboardingReplay
        ) {
            setShowOnboarding(
                false
            );

            setOnboardingReplay(
                false
            );

            return;
        }

        try {
            const result:
                AppPreferences =
                await api
                    .updateAppPreferences({
                        onboardingCompleted:
                            true
                    });

            setAppPreferences(
                result
            );

            setShowOnboarding(
                false
            );
        } catch (error) {
            setPreferencesMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    function replayOnboarding() {
        setOnboardingReplay(
            true
        );

        setShowOnboarding(
            true
        );
    }

    async function loadShortcutSettings() {
        try {
            const result:
                ShortcutSettings =
                await api
                    .getShortcutSettings();

            setShortcutSettings(
                result
            );

            setShortcutMessage("");
        } catch (error) {
            setShortcutMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    async function saveShortcutSettings(
        next: {
            translate: string;
            panel: string;
            panelNext: string;
            study: string;
        }
    ) {
        try {
            const result:
                ShortcutSettings =
                await api
                    .updateShortcutSettings(
                        next
                    );

            setShortcutSettings(
                result
            );

            setAppPreferences(
                (current) => ({
                    ...current,
                    shortcuts:
                        result
                })
            );

            setShortcutMessage(
                "Đã cập nhật Global Hotkeys."
            );
        } catch (error) {
            setShortcutMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            throw error;
        }
    }

    async function loadProfiles(
        preferredProfileId?: number
    ) {
        if (!auth.authenticated) {
            return;
        }

        try {
            const result =
                await api
                    .listProfiles();

            const nextProfiles:
                TranslationProfile[] =
                Array.isArray(result)
                    ? result
                    : [];

            setProfiles(
                nextProfiles
            );

            if (!nextProfiles.length) {
                setProfileDraft(null);

                await api
                    .setActiveTranslationProfile(
                        null
                    );

                return;
            }

            const selected =
                nextProfiles.find(
                    (profile) =>
                        profile.id ===
                        preferredProfileId
                )
                ??
                nextProfiles.find(
                    (profile) =>
                        profile.defaultProfile
                )
                ??
                nextProfiles[0];

            setProfileDraft(
                cloneProfile(
                    selected
                )
            );

            setProfileDirty(
                false
            );

            await api
                .setActiveTranslationProfile(
                    selected
                );
        } catch (error) {
            setProfileMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    async function selectProfile(
        profileId: number
    ) {
        const selected =
            profiles.find(
                (profile) =>
                    profile.id ===
                    profileId
            );

        if (!selected) {
            return;
        }

        if (profileDirty) {
            setProfileMessage(
                "Thay đổi chưa lưu của Profile trước đã được bỏ."
            );
        } else {
            setProfileMessage("");
        }

        setProfileDraft(
            cloneProfile(
                selected
            )
        );

        setProfileDirty(false);

        await api
            .setActiveTranslationProfile(
                selected
            );
    }

    function changeProfileDraft(
        next:
            TranslationProfile
    ) {
        setProfileDraft(next);
        setProfileDirty(true);
        setProfileMessage("");
    }

    async function saveActiveProfile() {
        if (!profileDraft) {
            return;
        }

        if (
            !profileDraft
                .name
                .trim()
        ) {
            setProfileMessage(
                "Tên Profile không được để trống."
            );
            return;
        }

        try {
            setIsProfileSaving(true);
            setProfileMessage("");

            const saved:
                TranslationProfile =
                await api
                    .updateProfile(
                        profileDraft.id,
                        profileToPayload(
                            profileDraft
                        )
                    );

            setProfiles(
                (current) =>
                    current.map(
                        (profile) =>
                            profile.id ===
                            saved.id
                                ? saved
                                : profile
                    )
            );

            setProfileDraft(
                cloneProfile(
                    saved
                )
            );

            setProfileDirty(false);

            await api
                .setActiveTranslationProfile(
                    saved
                );

            setProfileMessage(
                "Profile đã được lưu và Prompt Engine sẽ dùng cấu hình mới."
            );
        } catch (error) {
            setProfileMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsProfileSaving(false);
        }
    }

    async function createProfile() {
        try {
            setIsProfileSaving(true);

            const usedNames =
                new Set(
                    profiles.map(
                        (profile) =>
                            profile.name
                                .toLowerCase()
                    )
                );

            let index = 1;
            let name =
                `Profile ${index}`;

            while (
                usedNames.has(
                    name.toLowerCase()
                )
            ) {
                index += 1;
                name =
                    `Profile ${index}`;
            }

            const created:
                TranslationProfile =
                await api
                    .createProfile({
                        name,
                        style: "MANGA",
                        contextLines: 5,
                        keepHonorifics: true,
                        customInstruction:
                            "Dịch hội thoại tự nhiên, ngắn gọn và phù hợp manga/anime.",
                        characters: [],
                        glossary: []
                    });

            await loadProfiles(
                created.id
            );

            setProfileMessage(
                "Đã tạo Profile mới. Hãy chỉnh rules rồi Lưu."
            );
        } catch (error) {
            setProfileMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsProfileSaving(false);
        }
    }

    async function deleteActiveProfile() {
        if (!profileDraft) {
            return;
        }

        try {
            setIsProfileSaving(true);

            await api
                .deleteProfile(
                    profileDraft.id
                );

            setProfileMessage(
                "Đã xóa Profile."
            );

            await loadProfiles();
        } catch (error) {
            setProfileMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsProfileSaving(false);
        }
    }

    async function setActiveProfileDefault() {
        if (!profileDraft) {
            return;
        }

        try {
            setIsProfileSaving(true);

            await api
                .setDefaultProfile(
                    profileDraft.id
                );

            await loadProfiles(
                profileDraft.id
            );

            setProfileMessage(
                "Đã đặt làm Profile mặc định."
            );
        } catch (error) {
            setProfileMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setIsProfileSaving(false);
        }
    }

    async function clearActiveProfileContext() {
        if (!profileDraft) {
            return;
        }

        try {
            await api
                .clearTranslationContext(
                    profileDraft.id
                );

            setProfileMessage(
                "Đã xóa context memory của Profile trên máy này."
            );
        } catch (error) {
            setProfileMessage(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    /*
     * Normal translate selector.
     */
    async function openTranslateSelector() {
        if (!backend.connected) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Không thể kết nối dịch vụ. Vui lòng thử lại."
                })
            );
            return;
        }

        if (!auth.authenticated) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Hãy đăng nhập trước khi dịch."
                })
            );

            setActivePage(
                "settings"
            );
            return;
        }

        if (!profileDraft) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Chưa có Translation Profile."
                })
            );
            return;
        }

        if (profileDirty) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Profile có thay đổi chưa lưu. Hãy Lưu Profile trước khi quét."
                })
            );
            return;
        }

        try {
            setTranslation(
                (current) => ({
                    ...current,
                    isScanning: true,
                    status:
                        "Đang chọn vùng..."
                })
            );

            await api
                .openSelector({
                    sourceLanguage,
                    targetLanguage
                });
        } catch (error) {
            setTranslation(
                (current) => ({
                    ...current,
                    isScanning: false,
                    status:
                        error instanceof Error
                            ? error.message
                            : String(error)
                })
            );
        }
    }

    /*
     * Manga/Panel translation:
     * user selects one large story frame/page area,
     * OCR returns many bubbles and backend translates them as one batch.
     */
    async function translatePanelRegion() {
        if (!backend.connected) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Không thể kết nối dịch vụ. Vui lòng thử lại."
                })
            );
            return;
        }

        if (!auth.authenticated) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Hãy đăng nhập trước khi dịch."
                })
            );

            setActivePage(
                "settings"
            );
            return;
        }

        if (!entitlements.features.mangaPanel) {
            const message =
                "Manga Translation yêu cầu gói PRO hoặc cao hơn.";

            setTranslation(
                (current) => ({
                    ...current,
                    status: message
                })
            );
            setEntitlementMessage(
                `${message} Kích hoạt license hoặc nâng cấp tại Plan & License.`
            );
            setActivePage(
                "settings"
            );
            window.setTimeout(() => {
                window.dispatchEvent(
                    new CustomEvent(
                        "ai-translator:open-settings-category",
                        { detail: "plan" }
                    )
                );

                window.setTimeout(() => {
                    document
                        .getElementById(
                            "plan-license"
                        )
                        ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                        });
                }, 40);
            }, 60);
            return;
        }

        if (!profileDraft) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Chưa có Translation Profile."
                })
            );
            return;
        }

        if (profileDirty) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Profile có thay đổi chưa lưu. Hãy Lưu Profile trước khi quét khung truyện."
                })
            );
            return;
        }

        if (!api?.translatePanel) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Electron preload chưa hỗ trợ Quét khung truyện."
                })
            );
            return;
        }

        try {
            setTranslation(
                (current) => ({
                    ...current,
                    isScanning: true,
                    status:
                        "Kéo chọn một khung truyện hoặc vùng manga..."
                })
            );

            await api.translatePanel({
                sourceLanguage,
                targetLanguage
            });
        } catch (error) {
            setTranslation(
                (current) => ({
                    ...current,
                    isScanning: false,
                    status:
                        error instanceof Error
                            ? error.message
                            : String(error)
                })
            );
        }
    }

    /*
     * Full-screen translation foundation.
     * Batch 07 returns translated blocks + coordinates to Electron/renderer.
     * Multi-overlay rendering is added in Batch 08.
     */
    async function translateFullScreen() {
        if (!backend.connected) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Không thể kết nối dịch vụ. Vui lòng thử lại."
                })
            );
            return;
        }

        if (!auth.authenticated) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Hãy đăng nhập trước khi dịch."
                })
            );

            setActivePage(
                "settings"
            );
            return;
        }

        if (!profileDraft) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Chưa có Translation Profile."
                })
            );
            return;
        }

        if (profileDirty) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Profile có thay đổi chưa lưu. Hãy Lưu Profile trước khi dịch toàn màn hình."
                })
            );
            return;
        }

        if (!api?.translateFullScreen) {
            setTranslation(
                (current) => ({
                    ...current,
                    status:
                        "Electron preload chưa hỗ trợ Full Screen Translation."
                })
            );
            return;
        }

        try {
            setTranslation(
                (current) => ({
                    ...current,
                    isScanning: true,
                    status:
                        "Đang OCR toàn màn hình..."
                })
            );

            const result =
                await api.translateFullScreen({
                    sourceLanguage,
                    targetLanguage
                });

            if (!result?.success) {
                throw new Error(
                    result?.error ||
                    "Full Screen Translation thất bại."
                );
            }

            const blocks =
                Array.isArray(result.blocks)
                    ? result.blocks
                    : [];

            const original =
                blocks
                    .map(
                        (block: any) =>
                            String(
                                block.original ||
                                block.text ||
                                ""
                            ).trim()
                    )
                    .filter(Boolean)
                    .join("\n\n");

            const translated =
                blocks
                    .map(
                        (block: any) =>
                            String(
                                block.translatedText ||
                                block.vietnamese ||
                                ""
                            ).trim()
                    )
                    .filter(Boolean)
                    .join("\n\n");

            const memoryHits =
                Number(
                    result.batch
                        ?.summary
                        ?.memoryHits ||
                    0
                );

            const aiBlocks =
                Number(
                    result.batch
                        ?.summary
                        ?.aiBlocks ||
                    0
                );

            setTranslation({
                original,
                vietnamese:
                    translated,

                /*
                 * Không dùng whole-screen aggregate làm correction baseline.
                 * Batch 08 sẽ feedback theo từng block/bubble.
                 */
                aiTranslation: "",

                aiProvider:
                    result.batch
                        ?.ai
                        ?.provider ||
                    "",

                aiModel:
                    result.batch
                        ?.ai
                        ?.model ||
                    "",

                requestId:
                    result.batch
                        ?.performance
                        ?.requestId ||
                    "",

                profileId:
                    result.batch
                        ?.profile
                        ?.id ??
                    profileDraft.id,

                lastFeedbackTranslation:
                    "",

                status:
                    `Full Screen · ${blocks.length} vùng · ${memoryHits} memory · ${aiBlocks} AI`,

                isScanning: false
            });
        } catch (error) {
            setTranslation(
                (current) => ({
                    ...current,
                    isScanning: false,
                    status:
                        error instanceof Error
                            ? error.message
                            : String(error)
                })
            );
        }
    }

    /*
     * Study selector.
     */
    async function openStudySelector() {
        if (!backend.connected) {
            setStudy(
                (current) => ({
                    ...current,
                    status:
                        "Không thể kết nối dịch vụ. Vui lòng thử lại."
                })
            );
            return;
        }

        if (!auth.authenticated) {
            setStudy(
                (current) => ({
                    ...current,
                    status:
                        "Hãy đăng nhập trước khi học."
                })
            );

            setActivePage(
                "settings"
            );
            return;
        }

        if (!entitlements.features.studyMode) {
            const message =
                "Study Mode yêu cầu gói PRO hoặc cao hơn.";

            setStudy(
                (current) => ({
                    ...current,
                    status: message
                })
            );
            setEntitlementMessage(
                `${message} Kích hoạt license hoặc nâng cấp tại Plan & License.`
            );
            setActivePage(
                "settings"
            );
            window.setTimeout(() => {
                window.dispatchEvent(
                    new CustomEvent(
                        "ai-translator:open-settings-category",
                        { detail: "plan" }
                    )
                );

                window.setTimeout(() => {
                    document
                        .getElementById(
                            "plan-license"
                        )
                        ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                        });
                }, 40);
            }, 60);
            return;
        }

        if (!profileDraft) {
            setStudy(
                (current) => ({
                    ...current,
                    status:
                        "Chưa có Translation Profile."
                })
            );
            return;
        }

        if (profileDirty) {
            setStudy(
                (current) => ({
                    ...current,
                    status:
                        "Profile có thay đổi chưa lưu. Hãy Lưu Profile trước khi phân tích."
                })
            );
            return;
        }

        try {
            setStudy(
                (current) => ({
                    ...current,

                    /*
                     * Chặn background result của câu trước
                     * ngay từ lúc bắt đầu scan mới.
                     */
                    activeScanId:
                        "__pending__",

                    isScanning:
                        true,

                    status:
                        "Đang chọn vùng..."
                })
            );

            await api
                .openStudySelector({
                    level:
                        studyLevel,

                    autoSaveVocabulary,
                    autoSaveGrammar
                });
        } catch (error) {
            setStudy(
                (current) => ({
                    ...current,
                    isScanning: false,
                    status:
                        error instanceof Error
                            ? error.message
                            : String(error)
                })
            );
        }
    }

    async function submitTranslationCorrection(
        allowModelImprovement: boolean
    ) {
        if (!api?.submitTranslationFeedback) {
            throw new Error(
                "Electron preload chưa hỗ trợ Translation Feedback."
            );
        }

        const sourceText =
            translation.original.trim();
        const aiTranslation =
            (translation.aiTranslation || "")
                .trim();
        const correctedTranslation =
            translation.vietnamese.trim();

        if (
            !sourceText ||
            !aiTranslation ||
            !correctedTranslation
        ) {
            throw new Error(
                "Chưa đủ dữ liệu để lưu bản sửa."
            );
        }

        const result =
            await api.submitTranslationFeedback({
                profileId:
                    translation.profileId ??
                    profileDraft?.id ??
                    null,
                sourceText,
                aiTranslation,
                correctedTranslation,
                sourceLanguage,
                targetLanguage,
                provider:
                    translation.aiProvider ||
                    null,
                model:
                    translation.aiModel ||
                    null,
                requestId:
                    translation.requestId ||
                    null,
                allowModelImprovement
            });

        setTranslation(
            (current) => ({
                ...current,
                lastFeedbackTranslation:
                    correctedTranslation,
                status:
                    result?.memoryUpdated
                        ? allowModelImprovement
                            ? "Đã lưu bản sửa · Translation Memory đã cập nhật · cho phép cải thiện AI"
                            : "Đã lưu bản sửa · Translation Memory đã cập nhật"
                        : allowModelImprovement
                            ? "Đã lưu bản sửa · cho phép cải thiện AI"
                            : "Đã lưu bản sửa"
            })
        );

        return result;
    }

    async function copyTranslationResult() {
        const text = [
            translation.original,
            translation.vietnamese
        ]
            .filter(Boolean)
            .join("\n\n");

        if (!text) {
            return;
        }

        await navigator.clipboard
            .writeText(text);

        setTranslation(
            (current) => ({
                ...current,
                status:
                    "Đã sao chép kết quả"
            })
        );
    }

    function renderPage() {
        switch (activePage) {
            case "translate":
                return (
                    <TranslatePage
                        backend={backend}
                        auth={auth}
                        translation={
                            translation
                        }
                        profiles={
                            profiles
                        }
                        activeProfile={
                            profileDraft
                        }
                        profileDirty={
                            profileDirty
                        }
                        isProfileSaving={
                            isProfileSaving
                        }
                        shortcutDisplay={
                            shortcutSettings.translateDisplay
                        }
                        panelShortcutDisplay={
                            shortcutSettings.panelDisplay
                        }
                        sourceLanguage={
                            sourceLanguage
                        }
                        targetLanguage={
                            targetLanguage
                        }
                        onSourceLanguageChange={
                            setSourceLanguage
                        }
                        onTargetLanguageChange={
                            setTargetLanguage
                        }
                        onSelectProfile={
                            selectProfile
                        }
                        onProfileChange={
                            changeProfileDraft
                        }
                        onSaveProfile={
                            saveActiveProfile
                        }
                        onClearContext={
                            clearActiveProfileContext
                        }
                        onScan={
                            openTranslateSelector
                        }
                        onPanelScan={
                            translatePanelRegion
                        }
                        onFullScreenScan={
                            translateFullScreen
                        }
                        onSubmitFeedback={
                            submitTranslationCorrection
                        }
                        onCopy={
                            copyTranslationResult
                        }
                        onOriginalChange={
                            (value) => {
                                setTranslation(
                                    (current) => ({
                                        ...current,
                                        original:
                                            value,
                                        aiTranslation:
                                            "",
                                        aiProvider:
                                            "",
                                        aiModel:
                                            "",
                                        requestId:
                                            "",
                                        lastFeedbackTranslation:
                                            ""
                                    })
                                );
                            }
                        }
                        onVietnameseChange={
                            (value) => {
                                setTranslation(
                                    (current) => ({
                                        ...current,
                                        vietnamese:
                                            value
                                    })
                                );
                            }
                        }
                    />
                );

            case "novel":
                return (
                    <NovelReaderPage
                        backend={backend}
                        auth={auth}
                        entitlements={entitlements}
                        profiles={profiles}
                        activeProfile={profileDraft}
                        profileDirty={profileDirty}
                        sourceLanguage={sourceLanguage}
                        targetLanguage={targetLanguage}
                        onSourceLanguageChange={setSourceLanguage}
                        onTargetLanguageChange={setTargetLanguage}
                        onSelectProfile={selectProfile}
                        onUpgrade={() => {
                            setEntitlementMessage(
                                "Novel Reader TXT/EPUB yêu cầu gói PRO hoặc cao hơn."
                            );
                            setActivePage("settings");

                            window.setTimeout(() => {
                                window.dispatchEvent(
                                    new CustomEvent(
                                        "ai-translator:open-settings-category",
                                        { detail: "plan" }
                                    )
                                );

                                window.setTimeout(() => {
                                    document
                                        .getElementById(
                                            "plan-license"
                                        )
                                        ?.scrollIntoView({
                                            behavior: "smooth",
                                            block: "start"
                                        });
                                }, 40);
                            }, 60);
                        }}
                    />
                );

            case "study":
                return (
                    <StudyPage
                        backend={backend}
                        auth={auth}
                        profiles={profiles}
                        activeProfile={
                            profileDraft
                        }
                        profileDirty={
                            profileDirty
                        }
                        study={study}
                        studyLevel={
                            studyLevel
                        }
                        autoSaveVocabulary={
                            autoSaveVocabulary
                        }
                        autoSaveGrammar={
                            autoSaveGrammar
                        }
                        shortcutDisplay={
                            shortcutSettings.studyDisplay
                        }
                        onStudyLevelChange={
                            setStudyLevel
                        }
                        onAutoSaveVocabularyChange={
                            setAutoSaveVocabulary
                        }
                        onAutoSaveGrammarChange={
                            setAutoSaveGrammar
                        }
                        onSelectProfile={
                            selectProfile
                        }
                        onScan={
                            openStudySelector
                        }
                        onSaveVocabulary={
                            saveStudyVocabulary
                        }
                        onSaveGrammar={
                            saveStudyGrammar
                        }
                        onClearResult={() => {
                            setStudy({
                                result: null,
                                fastTranslation:
                                    null,
                                activeScanId:
                                    null,
                                status:
                                    "Sẵn sàng học",
                                isScanning:
                                    false,
                                isAnalyzing:
                                    false
                            });
                        }}
                    />
                );

            case "vocabulary":
                return (
                    <VocabularyPage
                        items={
                            vocabularyItems
                        }
                        stats={
                            vocabularyStats
                        }
                        loading={
                            vocabularyLoading
                        }
                        message={
                            vocabularyMessage
                        }
                        query={
                            vocabularyQuery
                        }
                        statusFilter={
                            vocabularyStatusFilter
                        }
                        favoriteOnly={
                            vocabularyFavoriteOnly
                        }
                        onQueryChange={
                            setVocabularyQuery
                        }
                        onStatusFilterChange={
                            setVocabularyStatusFilter
                        }
                        onFavoriteOnlyChange={
                            setVocabularyFavoriteOnly
                        }
                        onSearch={
                            loadVocabulary
                        }
                        onRefresh={
                            refreshVocabulary
                        }
                        onUpdate={
                            updateVocabularyItem
                        }
                        onDelete={
                            deleteVocabularyItem
                        }
                    />
                );

            case "grammar":
                return (
                    <GrammarPage
                        items={
                            grammarItems
                        }
                        stats={
                            grammarStats
                        }
                        loading={
                            grammarLoading
                        }
                        message={
                            grammarMessage
                        }
                        query={
                            grammarQuery
                        }
                        statusFilter={
                            grammarStatusFilter
                        }
                        favoriteOnly={
                            grammarFavoriteOnly
                        }
                        onQueryChange={
                            setGrammarQuery
                        }
                        onStatusFilterChange={
                            setGrammarStatusFilter
                        }
                        onFavoriteOnlyChange={
                            setGrammarFavoriteOnly
                        }
                        onSearch={
                            loadGrammar
                        }
                        onRefresh={
                            refreshGrammar
                        }
                        onUpdate={
                            updateGrammarItem
                        }
                        onDelete={
                            deleteGrammarItem
                        }
                    />
                );

            case "review":
                return (
                    <ReviewPage
                        queue={
                            reviewQueue
                        }
                        stats={
                            reviewStats
                        }
                        loading={
                            reviewLoading
                        }
                        message={
                            reviewMessage
                        }
                        onRefresh={
                            refreshReview
                        }
                        onLoadPractice={
                            loadPracticeReviewQueue
                        }
                        onAnswer={
                            answerReview
                        }
                        onAdvance={
                            advanceReview
                        }
                        onSkip={
                            skipReviewItem
                        }
                    />
                );

            case "profiles":
                return (
                    <ProfilesPage
                        profiles={
                            profiles
                        }
                        activeProfile={
                            profileDraft
                        }
                        profileDirty={
                            profileDirty
                        }
                        profileMessage={
                            profileMessage
                        }
                        isProfileSaving={
                            isProfileSaving
                        }
                        onSelectProfile={
                            selectProfile
                        }
                        onProfileChange={
                            changeProfileDraft
                        }
                        onSaveProfile={
                            saveActiveProfile
                        }
                        onCreateProfile={
                            createProfile
                        }
                        onDeleteProfile={
                            deleteActiveProfile
                        }
                        onSetDefaultProfile={
                            setActiveProfileDefault
                        }
                        onClearContext={
                            clearActiveProfileContext
                        }
                    />
                );

            case "memory":
                return (
                    <TranslationMemoryPage
                        items={
                            translationMemoryItems
                        }
                        stats={
                            translationMemoryStats
                        }
                        profiles={profiles}
                        loading={
                            translationMemoryLoading
                        }
                        message={
                            translationMemoryMessage
                        }
                        query={
                            translationMemoryQuery
                        }
                        profileFilter={
                            translationMemoryProfileFilter
                        }
                        sourceFilter={
                            translationMemorySourceFilter
                        }
                        targetFilter={
                            translationMemoryTargetFilter
                        }
                        page={translationMemoryPage}
                        totalPages={
                            translationMemoryTotalPages
                        }
                        onQueryChange={
                            setTranslationMemoryQuery
                        }
                        onProfileFilterChange={(value) => {
                            setTranslationMemoryProfileFilter(value);
                            setTranslationMemoryPage(0);
                        }}
                        onSourceFilterChange={(value) => {
                            setTranslationMemorySourceFilter(value);
                            setTranslationMemoryPage(0);
                        }}
                        onTargetFilterChange={(value) => {
                            setTranslationMemoryTargetFilter(value);
                            setTranslationMemoryPage(0);
                        }}
                        onSearch={
                            searchTranslationMemory
                        }
                        onRefresh={
                            refreshTranslationMemory
                        }
                        onPageChange={
                            changeTranslationMemoryPage
                        }
                        onUpdate={
                            updateTranslationMemoryItem
                        }
                        onDelete={
                            deleteTranslationMemoryItem
                        }
                    />
                );

            case "history":
                return (
                    <HistoryPage
                        dashboard={
                            learningDashboard
                        }
                        loading={
                            learningDashboardLoading
                        }
                        message={
                            learningDashboardMessage
                        }
                        onRefresh={
                            loadLearningDashboard
                        }
                        onOpenReview={() => {
                            setActivePage(
                                "review"
                            );
                        }}
                    />
                );

            case "settings":
                return (
                    <SettingsPage
                        backend={backend}
                        auth={auth}
                        entitlements={
                            entitlements
                        }
                        entitlementMessage={
                            entitlementMessage
                        }
                        isEntitlementLoading={
                            isEntitlementLoading
                        }
                        authMode={authMode}
                        email={email}
                        password={password}
                        authMessage={
                            authMessage
                        }
                        isAuthLoading={
                            isAuthLoading
                        }
                        emailVerificationRequired={
                            emailVerificationRequired
                        }
                        emailVerificationEmail={
                            emailVerificationEmail
                        }
                        emailVerificationCode={
                            emailVerificationCode
                        }
                        emailVerificationMessage={
                            emailVerificationMessage
                        }
                        emailVerificationCooldownSeconds={
                            emailVerificationCooldownSeconds
                        }
                        isEmailVerificationRequestLoading={
                            isEmailVerificationRequestLoading
                        }
                        isEmailVerificationConfirmLoading={
                            isEmailVerificationConfirmLoading
                        }
                        deviceTransferRequired={
                            deviceTransferRequired
                        }
                        deviceTransferEmail={
                            deviceTransferEmail
                        }
                        deviceTransferCode={
                            deviceTransferCode
                        }
                        deviceTransferMessage={
                            deviceTransferMessage
                        }
                        deviceTransferCooldownSeconds={
                            deviceTransferCooldownSeconds
                        }
                        isDeviceTransferRequestLoading={
                            isDeviceTransferRequestLoading
                        }
                        isDeviceTransferConfirmLoading={
                            isDeviceTransferConfirmLoading
                        }
                        socialProviders={
                            socialProviders
                        }
                        accountIdentities={
                            accountIdentities
                        }
                        socialAuthLoadingProvider={
                            socialAuthLoadingProvider
                        }
                        isCheckingBackend={
                            isCheckingBackend
                        }
                        devices={devices}
                        isLoadingDevices={
                            isLoadingDevices
                        }
                        shortcutSettings={
                            shortcutSettings
                        }
                        shortcutMessage={
                            shortcutMessage
                        }
                        appPreferences={
                            appPreferences
                        }
                        preferencesMessage={
                            preferencesMessage
                        }
                        onSaveShortcuts={
                            saveShortcutSettings
                        }
                        onSaveAppPreferences={
                            saveAppPreferences
                        }
                        onResetAppPreferences={
                            resetAppPreferences
                        }
                        onShowOnboarding={
                            replayOnboarding
                        }
                        onAuthModeChange={
                            (mode) => {
                                setAuthMode(
                                    mode
                                );

                                setAuthMessage(
                                    ""
                                );

                                clearEmailVerificationState();
                                clearDeviceTransferState();
                            }
                        }
                        onEmailChange={
                            setEmail
                        }
                        onPasswordChange={
                            setPassword
                        }
                        onSubmitAuth={
                            submitAuth
                        }
                        onEmailVerificationCodeChange={
                            setEmailVerificationCode
                        }
                        onRequestEmailVerification={
                            requestEmailVerification
                        }
                        onConfirmEmailVerification={
                            confirmEmailVerification
                        }
                        onCancelEmailVerification={
                            cancelEmailVerification
                        }
                        onDeviceTransferEmailChange={
                            setDeviceTransferEmail
                        }
                        onDeviceTransferCodeChange={
                            setDeviceTransferCode
                        }
                        onRequestDeviceTransfer={
                            requestDeviceTransfer
                        }
                        onConfirmDeviceTransfer={
                            confirmDeviceTransfer
                        }
                        onCancelDeviceTransfer={
                            cancelDeviceTransfer
                        }
                        onSocialLogin={
                            socialLogin
                        }
                        onCancelSocialLogin={
                            cancelSocialLogin
                        }
                        onLinkAccountIdentity={
                            linkAccountIdentity
                        }
                        onRefreshAccountIdentities={
                            loadAccountIdentities
                        }
                        onLogout={
                            logout
                        }
                        onRestoreSession={
                            restoreSession
                        }
                        onRefreshBackend={
                            refreshBackendStatus
                        }
                        onLoadDevices={
                            loadDevices
                        }
                        onRevokeDevice={
                            revokeDevice
                        }
                        onRefreshEntitlements={
                            refreshEntitlements
                        }
                        onActivateLicense={
                            activateLicense
                        }
                    />
                );
        }
    }

    return (
        <>
        <div className="app-shell">
            <Sidebar
                activePage={activePage}
                onChange={setActivePage}
            />

            <div className="workspace">
                <Topbar
                    activePage={activePage}
                    backend={backend}
                    auth={auth}
                    onOpenSettings={() => {
                        setActivePage(
                            "settings"
                        );
                    }}
                />

                <main className="page-content">
                    {renderPage()}
                </main>

                <footer className="workspace-footer">
                    <div className="workspace-footer-group">
                        <span className="shortcut-status">
                            <kbd>{shortcutSettings.translateDisplay}</kbd>
                            {t("status.quickTranslate")}
                        </span>

                        <span className="shortcut-status">
                            <kbd>{shortcutSettings.studyDisplay}</kbd>
                            {t("status.study")}
                        </span>
                    </div>

                    <div className="workspace-footer-group workspace-footer-right">
                        <span className="profile-status">
                            {t("status.profile")}:
                            {" "}
                            <strong>
                                {profileDraft
                                    ? profileDraft.name
                                    : t("status.noProfile")}
                            </strong>
                        </span>

                        <span
                            className={
                                backend.connected
                                    ? "service-status online"
                                    : "service-status"
                            }
                        >
                            <span className="status-dot" />
                            {backend.connected
                                ? t("status.ready")
                                : t("status.offline")}
                        </span>
                    </div>
                </footer>
            </div>
        </div>

        <OnboardingModal
            open={
                showOnboarding
            }
            replay={
                onboardingReplay
            }
            shortcuts={
                shortcutSettings
            }
            onComplete={
                completeOnboarding
            }
        />
        </>
    );
}

export default App;

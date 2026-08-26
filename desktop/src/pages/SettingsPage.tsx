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
    ShortcutSettings,
    SocialAuthProviderCode,
    SocialAuthProviderStatus,
    StudyLevel
} from "../app/types";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { Icon } from "../components/Icon";


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

interface PublicCatalogPrice {
    id: number;
    billingPeriod: "MONTHLY" | "YEARLY" | "LIFETIME";
    currency: string;
    amountMinor: number;
    compareAtAmountMinor?: number | null;
    startsAt?: string | null;
    endsAt?: string | null;
}

interface PublicCatalogPlan {
    code: string;
    displayName: string;
    description: string;
    rankOrder: number;
    features: Record<string, boolean>;
    limits: Record<string, number>;
    prices: PublicCatalogPrice[];
}

function billingPeriodLabel(value: PublicCatalogPrice["billingPeriod"]) {
    switch (value) {
        case "MONTHLY":
            return "Hàng tháng";
        case "YEARLY":
            return "Hàng năm";
        case "LIFETIME":
            return "Trọn đời";
        default:
            return value;
    }
}

function formatCatalogMoney(
    amountMinor: number,
    currency: string,
    locale: string
) {
    try {
        const formatter = new Intl.NumberFormat(
            locale,
            {
                style: "currency",
                currency
            }
        );

        const exponent = formatter
            .resolvedOptions()
            .maximumFractionDigits;

        return formatter.format(
            amountMinor / Math.pow(10, exponent)
        );
    } catch {
        return `${amountMinor.toLocaleString(locale)} ${currency}`;
    }
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

function SocialProviderLogo({
    provider
}: {
    provider: SocialAuthProviderCode;
}) {
    if (provider === "GOOGLE") {
        return (
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
            >
                <path
                    fill="#4285F4"
                    d="M21.6 12.23c0-.71-.06-1.24-.19-1.79H12v3.42h5.52a4.72 4.72 0 0 1-2.05 3.09l-.03.11 2.97 2.3.21.02c1.93-1.78 3.04-4.4 3.04-7.15Z"
                />
                <path
                    fill="#34A853"
                    d="M12 22c2.7 0 4.96-.89 6.61-2.42l-3.15-2.43c-.84.57-1.97.97-3.46.97-2.6 0-4.81-1.76-5.6-4.2l-.1.01-3.09 2.39-.03.09A9.99 9.99 0 0 0 12 22Z"
                />
                <path
                    fill="#FBBC05"
                    d="M6.4 13.92A6.05 6.05 0 0 1 6.08 12c0-.67.12-1.31.31-1.92l-.01-.13-3.12-2.42-.1.05A10.02 10.02 0 0 0 2 12c0 1.59.38 3.09 1.17 4.42l3.23-2.5Z"
                />
                <path
                    fill="#EA4335"
                    d="M12 5.88c1.88 0 3.15.81 3.88 1.49l2.8-2.73C16.96 3.05 14.7 2 12 2a9.99 9.99 0 0 0-8.83 5.58l3.22 2.5c.8-2.44 3.01-4.2 5.61-4.2Z"
                />
            </svg>
        );
    }

    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
        >
            <circle cx="12" cy="12" r="10" fill="#1877F2" />
            <path
                fill="#fff"
                d="M13.3 20v-7h2.35l.35-2.73h-2.7V8.53c0-.79.22-1.33 1.36-1.33h1.45V4.76c-.25-.03-1.11-.1-2.11-.1-2.09 0-3.52 1.27-3.52 3.62v1.99H8.42V13h2.36v7h2.52Z"
            />
        </svg>
    );
}

interface PasswordResetRequestResult {
    accepted?: boolean;
    message?: string;
}

interface PasswordActionResult {
    success?: boolean;
    sessionsRevoked?: boolean;
    reauthenticated?: boolean;
    message?: string;
}

interface PasswordDesktopApi {
    forgotPassword?: (payload: { email: string }) => Promise<PasswordResetRequestResult>;
    resetPassword?: (payload: { token: string; newPassword: string }) => Promise<PasswordActionResult>;
    changePassword?: (payload: { currentPassword: string; newPassword: string }) => Promise<PasswordActionResult>;
}

type OcrWorkerState =
    | "stopped"
    | "starting"
    | "ready"
    | "busy"
    | "degraded";

interface OcrWorkerHealth {
    status: OcrWorkerState;
    ready: boolean;
    busy: boolean;
    queued: number;
    pid?: number | null;
    restartCount: number;
    lastReadyAt?: string | null;
    lastSuccessAt?: string | null;
    lastError?: string | null;
    runtime: {
        pythonConfigured: boolean;
        workerConfigured: boolean;
        pythonVersion?: string | null;
        paddleOcrVersion?: string | null;
        paddlePaddleVersion?: string | null;
        startupMs?: number | null;
    };
}

interface PasswordFieldProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    autoComplete?: string;
    disabled?: boolean;
}

function PasswordField({
    value,
    onChange,
    placeholder,
    autoComplete,
    disabled = false
}: PasswordFieldProps) {
    const [visible, setVisible] =
        useState(false);

    const label =
        visible
            ? "Ẩn mật khẩu"
            : "Hiện mật khẩu";

    return (
        <div className="password-input-shell">
            <input
                type={
                    visible
                        ? "text"
                        : "password"
                }
                value={value}
                onChange={(event) => {
                    onChange(
                        event.target.value
                    );
                }}
                placeholder={placeholder}
                autoComplete={autoComplete}
                disabled={disabled}
            />

            <button
                type="button"
                className="password-visibility-toggle"
                onClick={() => {
                    setVisible(
                        (current) =>
                            !current
                    );
                }}
                aria-label={label}
                aria-pressed={visible}
                title={label}
                disabled={disabled}
            >
                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                    <circle
                        cx="12"
                        cy="12"
                        r="2.75"
                    />

                    {visible && (
                        <path d="M4 4l16 16" />
                    )}
                </svg>
            </button>
        </div>
    );
}


interface OcrDesktopApi {
    getOcrWorkerHealth?: () => Promise<OcrWorkerHealth>;
    restartOcrWorker?: () => Promise<OcrWorkerHealth>;
}

function ocrDesktopApi(): OcrDesktopApi {
    return window.electronAPI as unknown as OcrDesktopApi;
}

interface SettingsPageProps {
    backend: BackendStatus;
    auth: AuthStatus;
    entitlements: AccountEntitlements;
    entitlementMessage: string;
    isEntitlementLoading: boolean;
    authMode: "login" | "register";
    email: string;
    password: string;
    authMessage: string;
    isAuthLoading: boolean;
    emailVerificationRequired: boolean;
    emailVerificationEmail: string;
    emailVerificationCode: string;
    emailVerificationMessage: string;
    emailVerificationCooldownSeconds: number;
    isEmailVerificationRequestLoading: boolean;
    isEmailVerificationConfirmLoading: boolean;
    deviceTransferRequired: boolean;
    deviceTransferEmail: string;
    deviceTransferCode: string;
    deviceTransferMessage: string;
    deviceTransferCooldownSeconds: number;
    isDeviceTransferRequestLoading: boolean;
    isDeviceTransferConfirmLoading: boolean;
    socialProviders: SocialAuthProviderStatus[];
    accountIdentities: AccountIdentity[];
    socialAuthLoadingProvider: SocialAuthProviderCode | null;
    isCheckingBackend: boolean;
    devices: DeviceSession[];
    isLoadingDevices: boolean;
    shortcutSettings: ShortcutSettings;
    shortcutMessage: string;
    appPreferences: AppPreferences;
    preferencesMessage: string;

    onSaveShortcuts:
        (next: {
            translate: string;
            panel: string;
            panelNext: string;
            study: string;
        }) => Promise<void>;

    onSaveAppPreferences:
        (next: {
            study: AppPreferences["study"];
            overlay: AppPreferences["overlay"];
        }) => Promise<unknown>;

    onResetAppPreferences:
        () => Promise<void>;

    onShowOnboarding:
        () => void;

    onAuthModeChange:
        (mode: "login" | "register") => void;

    onEmailChange:
        (value: string) => void;

    onPasswordChange:
        (value: string) => void;

    onSubmitAuth:
        (event: FormEvent) => void;

    onEmailVerificationCodeChange:
        (value: string) => void;

    onRequestEmailVerification:
        () => void;

    onConfirmEmailVerification:
        (event: FormEvent) => void;

    onCancelEmailVerification:
        () => void;

    onDeviceTransferEmailChange:
        (value: string) => void;

    onDeviceTransferCodeChange:
        (value: string) => void;

    onRequestDeviceTransfer:
        () => void;

    onConfirmDeviceTransfer:
        (event: FormEvent) => void;

    onCancelDeviceTransfer:
        () => void;

    onSocialLogin:
        (provider: SocialAuthProviderCode) => void;

    onCancelSocialLogin:
        () => void;

    onLinkAccountIdentity:
        (provider: SocialAuthProviderCode) => void;

    onRefreshAccountIdentities:
        () => void;

    onLogout:
        () => void;

    onRestoreSession:
        () => void;

    onRefreshBackend:
        () => void;

    onLoadDevices:
        () => void;

    onRevokeDevice:
        (sessionId: number) => void;

    onRefreshEntitlements:
        () => void;

    onActivateLicense:
        (licenseKey: string) => Promise<void>;
}

type SettingsCategory =
    | "general"
    | "account"
    | "plan"
    | "reading"
    | "advanced";

const SETTINGS_CATEGORY_EVENT =
    "ai-translator:open-settings-category";

const SETTINGS_CATEGORIES: SettingsCategory[] = [
    "general",
    "account",
    "plan",
    "reading",
    "advanced"
];

function isSettingsCategory(
    value: unknown
): value is SettingsCategory {
    return SETTINGS_CATEGORIES.includes(
        value as SettingsCategory
    );
}

export function SettingsPage({
    backend,
    auth,
    entitlements,
    entitlementMessage,
    isEntitlementLoading,
    authMode,
    email,
    password,
    authMessage,
    isAuthLoading,
    emailVerificationRequired,
    emailVerificationEmail,
    emailVerificationCode,
    emailVerificationMessage,
    emailVerificationCooldownSeconds,
    isEmailVerificationRequestLoading,
    isEmailVerificationConfirmLoading,
    deviceTransferRequired,
    deviceTransferEmail,
    deviceTransferCode,
    deviceTransferMessage,
    deviceTransferCooldownSeconds,
    isDeviceTransferRequestLoading,
    isDeviceTransferConfirmLoading,
    socialProviders,
    accountIdentities,
    socialAuthLoadingProvider,
    isCheckingBackend,
    devices,
    isLoadingDevices,
    shortcutSettings,
    shortcutMessage,
    appPreferences,
    preferencesMessage,
    onSaveShortcuts,
    onSaveAppPreferences,
    onResetAppPreferences,
    onShowOnboarding,
    onAuthModeChange,
    onEmailChange,
    onPasswordChange,
    onSubmitAuth,
    onEmailVerificationCodeChange,
    onRequestEmailVerification,
    onConfirmEmailVerification,
    onCancelEmailVerification,
    onDeviceTransferEmailChange,
    onDeviceTransferCodeChange,
    onRequestDeviceTransfer,
    onConfirmDeviceTransfer,
    onCancelDeviceTransfer,
    onSocialLogin,
    onCancelSocialLogin,
    onLinkAccountIdentity,
    onRefreshAccountIdentities,
    onLogout,
    onRestoreSession,
    onRefreshBackend,
    onLoadDevices,
    onRevokeDevice,
    onRefreshEntitlements,
    onActivateLicense
}: SettingsPageProps) {
    const {
        locale,
        intlLocale,
        availableLocales,
        setLocale,
        t
    } = useI18n();

    const {
        theme,
        resolvedTheme,
        setTheme
    } = useTheme();

    const [
        activeSettingsCategory,
        setActiveSettingsCategory
    ] = useState<SettingsCategory>(() => {
        if (typeof window !== "undefined") {
            const hash = window.location.hash;
            if (
                hash === "#plan-license" ||
                hash === "#pricing-catalog"
            ) {
                return "plan";
            }
        }

        return "general";
    });

    const [
        translateShortcut,
        setTranslateShortcut
    ] = useState(
        shortcutSettings.translateDisplay
    );

    const [
        panelShortcut,
        setPanelShortcut
    ] = useState(
        shortcutSettings.panelDisplay
    );

    const [
        panelNextShortcut,
        setPanelNextShortcut
    ] = useState(
        shortcutSettings.panelNextDisplay
    );

    const [
        studyShortcut,
        setStudyShortcut
    ] = useState(
        shortcutSettings.studyDisplay
    );

    const [
        studyLevel,
        setStudyLevel
    ] = useState<StudyLevel>(
        appPreferences.study.level
    );

    const [
        autoSaveVocabulary,
        setAutoSaveVocabulary
    ] = useState(
        appPreferences
            .study
            .autoSaveVocabulary
    );

    const [
        autoSaveGrammar,
        setAutoSaveGrammar
    ] = useState(
        appPreferences
            .study
            .autoSaveGrammar
    );

    const [
        overlayAutoHide,
        setOverlayAutoHide
    ] = useState(
        appPreferences
            .overlay
            .autoHide
    );

    const [
        overlayOpacity,
        setOverlayOpacity
    ] = useState(
        appPreferences
            .overlay
            .opacity
    );

    const [
        overlayFontScale,
        setOverlayFontScale
    ] = useState(
        appPreferences
            .overlay
            .fontScale
    );

    const [
        isSavingShortcuts,
        setIsSavingShortcuts
    ] = useState(false);

    const [
        isSavingPreferences,
        setIsSavingPreferences
    ] = useState(false);

    const [
        isResetting,
        setIsResetting
    ] = useState(false);

    const [deviceTransferOpen, setDeviceTransferOpen] = useState(false);
    const [passwordRecoveryOpen, setPasswordRecoveryOpen] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState(email);
    const [recoveryToken, setRecoveryToken] = useState("");
    const [recoveryNewPassword, setRecoveryNewPassword] = useState("");
    const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState("");
    const [recoveryMessage, setRecoveryMessage] = useState("");
    const [recoveryLoading, setRecoveryLoading] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [nextPassword, setNextPassword] = useState("");
    const [confirmNextPassword, setConfirmNextPassword] = useState("");
    const [passwordSecurityMessage, setPasswordSecurityMessage] = useState("");
    const [passwordSecurityLoading, setPasswordSecurityLoading] = useState(false);

    const [
        licenseKey,
        setLicenseKey
    ] = useState("");

    const [
        isActivatingLicense,
        setIsActivatingLicense
    ] = useState(false);

    const [
        pricingCatalog,
        setPricingCatalog
    ] = useState<PublicCatalogPlan[]>([]);

    const [
        isPricingCatalogLoading,
        setIsPricingCatalogLoading
    ] = useState(false);

    const [
        pricingCatalogMessage,
        setPricingCatalogMessage
    ] = useState("");


    const [
        ocrHealth,
        setOcrHealth
    ] = useState<OcrWorkerHealth | null>(null);

    const [
        isCheckingOcr,
        setIsCheckingOcr
    ] = useState(false);

    const [
        isRestartingOcr,
        setIsRestartingOcr
    ] = useState(false);

    useEffect(() => {
        if (!deviceTransferRequired) {
            setDeviceTransferOpen(false);
        }
    }, [
        deviceTransferRequired
    ]);

    useEffect(() => {
        const handleOpenSettingsCategory = (event: Event) => {
            const next = (
                event as CustomEvent<SettingsCategory>
            ).detail;

            if (isSettingsCategory(next)) {
                setActiveSettingsCategory(next);
            }
        };

        window.addEventListener(
            SETTINGS_CATEGORY_EVENT,
            handleOpenSettingsCategory
        );

        return () => {
            window.removeEventListener(
                SETTINGS_CATEGORY_EVENT,
                handleOpenSettingsCategory
            );
        };
    }, []);

    const initialNovelFontSettings =
        loadNovelReaderFontSettings();

    const [
        novelFontPreset,
        setNovelFontPreset
    ] = useState<NovelReaderFontPreset>(
        initialNovelFontSettings.preset
    );

    const [
        novelCustomFont,
        setNovelCustomFont
    ] = useState(
        initialNovelFontSettings.customFamily
    );

    const [
        novelFontMessage,
        setNovelFontMessage
    ] = useState("");

    async function submitLicense(
        event: FormEvent
    ) {
        event.preventDefault();

        const cleanKey =
            licenseKey.trim();

        if (!cleanKey) {
            return;
        }

        try {
            setIsActivatingLicense(
                true
            );

            await onActivateLicense(
                cleanKey
            );

            setLicenseKey("");
        } catch {
            // Parent owns the user-visible error message.
        } finally {
            setIsActivatingLicense(
                false
            );
        }
    }

    async function refreshOcrHealth(quiet = false) {
        const api = ocrDesktopApi().getOcrWorkerHealth;

        if (!api) {
            setOcrHealth(null);
            return;
        }

        try {
            if (!quiet) {
                setIsCheckingOcr(true);
            }

            const health = await api();
            setOcrHealth(health);
        } catch {
            setOcrHealth({
                status: "degraded",
                ready: false,
                busy: false,
                queued: 0,
                restartCount: 0,
                runtime: {
                    pythonConfigured: false,
                    workerConfigured: false
                }
            });
        } finally {
            if (!quiet) {
                setIsCheckingOcr(false);
            }
        }
    }

    async function restartOcrEngine() {
        const api = ocrDesktopApi().restartOcrWorker;

        if (!api || isRestartingOcr) {
            return;
        }

        try {
            setIsRestartingOcr(true);
            const health = await api();
            setOcrHealth(health);
        } catch {
            await refreshOcrHealth(true);
        } finally {
            setIsRestartingOcr(false);
        }
    }

    function ocrStatusLabel() {
        switch (ocrHealth?.status) {
            case "ready":
                return t("settings.ocr.ready");
            case "busy":
                return t("settings.ocr.busy");
            case "starting":
                return t("settings.ocr.starting");
            case "degraded":
                return t("settings.ocr.degraded");
            case "stopped":
                return t("settings.ocr.stopped");
            default:
                return t("settings.ocr.unavailable");
        }
    }

    async function loadPricingCatalog() {
        const api = window.electronAPI
            .getPricingCatalog;

        if (!api) {
            setPricingCatalogMessage(
                "Desktop hiện tại chưa hỗ trợ public pricing catalog."
            );
            return;
        }

        try {
            setIsPricingCatalogLoading(true);
            setPricingCatalogMessage("");

            const plans = await api();
            setPricingCatalog(
                Array.isArray(plans)
                    ? plans
                    : []
            );
        } catch (error) {
            setPricingCatalogMessage(
                error instanceof Error
                    ? error.message
                    : "Không thể tải bảng giá lúc này."
            );
        } finally {
            setIsPricingCatalogLoading(false);
        }
    }

    useEffect(() => {
        if (backend.connected) {
            void loadPricingCatalog();
        }
    }, [backend.connected]);

    useEffect(() => {
        if (activeSettingsCategory !== "advanced") {
            return;
        }

        void refreshOcrHealth();

        const interval = window.setInterval(() => {
            void refreshOcrHealth(true);
        }, 5000);

        return () => {
            window.clearInterval(interval);
        };
    }, [activeSettingsCategory]);

    useEffect(() => {
        setTranslateShortcut(
            shortcutSettings
                .translateDisplay
        );

        setPanelShortcut(
            shortcutSettings
                .panelDisplay
        );

        setPanelNextShortcut(
            shortcutSettings
                .panelNextDisplay
        );

        setStudyShortcut(
            shortcutSettings
                .studyDisplay
        );
    }, [
        shortcutSettings.translateDisplay,
        shortcutSettings.panelDisplay,
        shortcutSettings.panelNextDisplay,
        shortcutSettings.studyDisplay
    ]);

    useEffect(() => {
        setStudyLevel(
            appPreferences.study.level
        );

        setAutoSaveVocabulary(
            appPreferences
                .study
                .autoSaveVocabulary
        );

        setAutoSaveGrammar(
            appPreferences
                .study
                .autoSaveGrammar
        );

        setOverlayAutoHide(
            appPreferences
                .overlay
                .autoHide
        );

        setOverlayOpacity(
            appPreferences
                .overlay
                .opacity
        );

        setOverlayFontScale(
            appPreferences
                .overlay
                .fontScale
        );
    }, [
        appPreferences
    ]);

    function saveNovelFontSettings() {
        const next: NovelReaderFontSettings = {
            preset: novelFontPreset,
            customFamily: novelCustomFont.trim().slice(0, 160)
        };

        try {
            localStorage.setItem(
                NOVEL_READER_FONT_SETTINGS_KEY,
                JSON.stringify(next)
            );

            window.dispatchEvent(
                new CustomEvent(
                    NOVEL_READER_FONT_SETTINGS_EVENT,
                    { detail: next }
                )
            );

            setNovelFontMessage(
                "Đã lưu font mặc định cho Novel Reader."
            );
        } catch {
            setNovelFontMessage(
                "Không thể lưu font Novel Reader trên máy này."
            );
        }
    }

    function resetNovelFontSettings() {
        setNovelFontPreset("auto");
        setNovelCustomFont("");

        try {
            localStorage.removeItem(
                NOVEL_READER_FONT_SETTINGS_KEY
            );

            window.dispatchEvent(
                new CustomEvent(
                    NOVEL_READER_FONT_SETTINGS_EVENT,
                    {
                        detail: DEFAULT_NOVEL_READER_FONT_SETTINGS
                    }
                )
            );
        } catch {
            // Best effort only.
        }

        setNovelFontMessage(
            "Đã dùng lại font tự động theo ngôn ngữ."
        );
    }

    function passwordApi() {
        return window.electronAPI as typeof window.electronAPI & PasswordDesktopApi;
    }

    async function requestPasswordReset(event: FormEvent) {
        event.preventDefault();
        const cleanEmail = recoveryEmail.trim();
        if (!cleanEmail) {
            setRecoveryMessage("Nhập email của tài khoản.");
            return;
        }
        const request = passwordApi().forgotPassword;
        if (!request) {
            setRecoveryMessage("Desktop chưa hỗ trợ quên mật khẩu.");
            return;
        }
        try {
            setRecoveryLoading(true);
            setRecoveryMessage("");
            const result = await request({ email: cleanEmail });
            setRecoveryMessage(
                result.message ||
                "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi."
            );
        } catch (error) {
            setRecoveryMessage(error instanceof Error ? error.message : String(error));
        } finally {
            setRecoveryLoading(false);
        }
    }

    async function submitPasswordReset(event: FormEvent) {
        event.preventDefault();
        if (!recoveryToken.trim()) {
            setRecoveryMessage("Nhập mã đặt lại mật khẩu.");
            return;
        }
        if (recoveryNewPassword.length < 8 || recoveryNewPassword.length > 100) {
            setRecoveryMessage("Mật khẩu mới phải dài từ 8 đến 100 ký tự.");
            return;
        }
        if (recoveryNewPassword !== recoveryConfirmPassword) {
            setRecoveryMessage("Xác nhận mật khẩu chưa khớp.");
            return;
        }
        const reset = passwordApi().resetPassword;
        if (!reset) {
            setRecoveryMessage("Desktop chưa hỗ trợ đặt lại mật khẩu.");
            return;
        }
        try {
            setRecoveryLoading(true);
            const result = await reset({
                token: recoveryToken.trim(),
                newPassword: recoveryNewPassword
            });
            setRecoveryToken("");
            setRecoveryNewPassword("");
            setRecoveryConfirmPassword("");
            setRecoveryMessage(result.message || "Đã đặt lại mật khẩu. Bạn có thể đăng nhập.");
        } catch (error) {
            setRecoveryMessage(error instanceof Error ? error.message : String(error));
        } finally {
            setRecoveryLoading(false);
        }
    }

    async function submitPasswordChange(event: FormEvent) {
        event.preventDefault();
        if (nextPassword.length < 8 || nextPassword.length > 100) {
            setPasswordSecurityMessage("Mật khẩu mới phải dài từ 8 đến 100 ký tự.");
            return;
        }
        if (nextPassword !== confirmNextPassword) {
            setPasswordSecurityMessage("Xác nhận mật khẩu chưa khớp.");
            return;
        }
        const change = passwordApi().changePassword;
        if (!change) {
            setPasswordSecurityMessage("Desktop chưa hỗ trợ đổi mật khẩu.");
            return;
        }
        try {
            setPasswordSecurityLoading(true);
            setPasswordSecurityMessage("");
            const result = await change({ currentPassword, newPassword: nextPassword });
            setCurrentPassword("");
            setNextPassword("");
            setConfirmNextPassword("");
            setPasswordSecurityMessage(
                result.reauthenticated === false
                    ? `${result.message || "Đã đổi mật khẩu."} Hãy đăng nhập lại.`
                    : result.message || "Đã đổi mật khẩu và làm mới phiên đăng nhập."
            );
        } catch (error) {
            setPasswordSecurityMessage(error instanceof Error ? error.message : String(error));
        } finally {
            setPasswordSecurityLoading(false);
        }
    }

    async function saveShortcuts() {
        try {
            setIsSavingShortcuts(
                true
            );

            await onSaveShortcuts({
                translate:
                    translateShortcut,
                panel:
                    panelShortcut,
                panelNext:
                    panelNextShortcut,
                study:
                    studyShortcut
            });
        } finally {
            setIsSavingShortcuts(
                false
            );
        }
    }

    async function savePreferences() {
        try {
            setIsSavingPreferences(
                true
            );

            await onSaveAppPreferences({
                study: {
                    level:
                        studyLevel,

                    autoSaveVocabulary,
                    autoSaveGrammar
                },

                overlay: {
                    autoHide:
                        overlayAutoHide,

                    opacity:
                        overlayOpacity,

                    fontScale:
                        overlayFontScale
                }
            });
        } finally {
            setIsSavingPreferences(
                false
            );
        }
    }

    async function resetPreferences() {
        try {
            setIsResetting(
                true
            );

            await onResetAppPreferences();
        } finally {
            setIsResetting(
                false
            );
        }
    }

    const settingsNavigation: Array<{
        id: SettingsCategory;
        icon: "settings" | "user" | "card" | "novel" | "sliders";
        title: string;
        description: string;
        eyebrow: string;
        summary: string;
    }> = [
        {
            id: "general",
            icon: "settings" as const,
            title: t("settings.nav.general"),
            description: t("settings.nav.generalDescription"),
            eyebrow: t("settings.group.generalEyebrow"),
            summary: t("settings.group.generalSummary")
        },
        {
            id: "account",
            icon: "user" as const,
            title: t("settings.nav.account"),
            description: t("settings.nav.accountDescription"),
            eyebrow: t("settings.group.accountEyebrow"),
            summary: t("settings.group.accountSummary")
        },
        {
            id: "plan",
            icon: "card" as const,
            title: t("settings.nav.plan"),
            description: t("settings.nav.planDescription"),
            eyebrow: t("settings.group.planEyebrow"),
            summary: t("settings.group.planSummary")
        },
        {
            id: "reading",
            icon: "novel" as const,
            title: t("settings.nav.reading"),
            description: t("settings.nav.readingDescription"),
            eyebrow: t("settings.group.readingEyebrow"),
            summary: t("settings.group.readingSummary")
        },
        {
            id: "advanced",
            icon: "sliders" as const,
            title: t("settings.nav.advanced"),
            description: t("settings.nav.advancedDescription"),
            eyebrow: t("settings.group.advancedEyebrow"),
            summary: t("settings.group.advancedSummary")
        }
    ];

    const activeSettingsNavigation =
        settingsNavigation.find(
            (item) =>
                item.id === activeSettingsCategory
        ) ?? settingsNavigation[0];

    return (
        <div
            className="page-stack settings-page"
            data-settings-category={activeSettingsCategory}
        >
            <div className="settings-category-shell">
                <nav
                    className="settings-category-nav"
                    aria-label={t("settings.nav.aria")}
                >
                    {settingsNavigation.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={
                                item.id === activeSettingsCategory
                                    ? "settings-category-tab active"
                                    : "settings-category-tab"
                            }
                            aria-pressed={
                                item.id === activeSettingsCategory
                            }
                            onClick={() => {
                                setActiveSettingsCategory(item.id);
                            }}
                        >
                            <span className="settings-category-icon" aria-hidden="true">
                                <Icon name={item.icon} size={17} />
                            </span>

                            <span className="settings-category-copy">
                                <strong>{item.title}</strong>
                                <small>{item.description}</small>
                            </span>
                        </button>
                    ))}
                </nav>

                <div className="settings-category-overview">
                    <div>
                        <span className="eyebrow">
                            {activeSettingsNavigation.eyebrow}
                        </span>
                        <h2>{activeSettingsNavigation.title}</h2>
                        <p>{activeSettingsNavigation.summary}</p>
                    </div>

                    <span className="settings-category-count">
                        {t("settings.group.sectionLabel")}
                    </span>
                </div>
            </div>
            <section data-settings-group="general" className="settings-section theme-settings-section">
                <div className="settings-section-header">
                    <div>
                        <span className="eyebrow">
                            {t("theme.eyebrow")}
                        </span>

                        <h2>
                            {t("theme.title")}
                        </h2>

                        <p>
                            {t("theme.description")}
                        </p>
                    </div>
                </div>

                <div className="theme-choice-grid" role="radiogroup" aria-label={t("theme.title")}>
                    {([
                        ["system", "theme.system", "theme.systemDescription"],
                        ["light", "theme.light", "theme.lightDescription"],
                        ["dark", "theme.dark", "theme.darkDescription"]
                    ] as const).map(([value, labelKey, descriptionKey]) => (
                        <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={theme === value}
                            className={
                                theme === value
                                    ? "theme-choice active"
                                    : "theme-choice"
                            }
                            onClick={() => setTheme(value)}
                        >
                            <span className={`theme-preview ${value}`}>
                                <i />
                                <i />
                                <i />
                            </span>

                            <span className="theme-choice-copy">
                                <strong>{t(labelKey)}</strong>
                                <small>{t(descriptionKey)}</small>
                            </span>

                            {theme === value && (
                                <span className="theme-active-chip">
                                    {t("theme.current")}
                                    {value === "system"
                                        ? ` · ${resolvedTheme === "dark" ? t("theme.dark") : t("theme.light")}`
                                        : ""}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </section>

            <section data-settings-group="general" className="settings-section language-settings-section">
                <div className="settings-section-header">
                    <div>
                        <span className="eyebrow">
                            {t("language.eyebrow")}
                        </span>

                        <h2>
                            {t("language.title")}
                        </h2>

                        <p>
                            {t("language.description")}
                        </p>
                    </div>
                </div>

                <div className="language-settings-grid">
                    <label className="control-field">
                        <span>{t("language.field")}</span>

                        <select
                            value={locale}
                            onChange={(event) => {
                                const next = event.target.value;
                                if (next === "vi" || next === "en") {
                                    setLocale(next);
                                }
                            }}
                        >
                            {availableLocales.map((option) => (
                                <option
                                    key={option.code}
                                    value={option.code}
                                >
                                    {option.nativeLabel}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </section>

            <section
                data-settings-group="account"
                className="settings-section account-settings-section"
            >
                <div className="settings-section-header account-settings-header">
                    <div>
                        <span className="eyebrow">
                            {t("settings.auth.accountEyebrow")}
                        </span>

                        <h2>
                            {t("settings.auth.accountTitle")}
                        </h2>

                        <p>
                            {t("settings.auth.accountDescription")}
                        </p>
                    </div>

                    {auth.authenticated && (
                        <button
                            type="button"
                            className="danger-outline"
                            onClick={onLogout}
                            disabled={isAuthLoading}
                        >
                            {t("settings.auth.logout")}
                        </button>
                    )}
                </div>

                {!auth.authenticated ? (
                    <div className="auth-experience">
                        <aside className="auth-welcome-panel">
                            <div className="auth-welcome-brand" aria-hidden="true">
                                <span>A</span>
                            </div>

                            <div className="auth-welcome-copy">
                                <span className="eyebrow auth-welcome-eyebrow">
                                    {t("settings.auth.welcomeEyebrow")}
                                </span>

                                <h3>{t("settings.auth.welcomeTitle")}</h3>
                                <p>{t("settings.auth.welcomeDescription")}</p>
                            </div>

                            <div className="auth-benefit-list">
                                {[
                                    t("settings.auth.benefitProfiles"),
                                    t("settings.auth.benefitLearning"),
                                    t("settings.auth.benefitSignIn")
                                ].map((benefit) => (
                                    <div className="auth-benefit" key={benefit}>
                                        <span className="auth-benefit-icon" aria-hidden="true">
                                            <Icon name="check" size={14} />
                                        </span>
                                        <span>{benefit}</span>
                                    </div>
                                ))}
                            </div>
                        </aside>

                        <div className="auth-card">
                            <div className="auth-card-toolbar">
                                <div className="auth-tabs" role="tablist" aria-label={t("settings.auth.accountTitle")}>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={authMode === "login"}
                                        className={
                                            authMode === "login"
                                                ? "segment active"
                                                : "segment"
                                        }
                                        onClick={() => {
                                            onAuthModeChange("login");
                                        }}
                                    >
                                        {t("settings.auth.signInTab")}
                                    </button>

                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={authMode === "register"}
                                        className={
                                            authMode === "register"
                                                ? "segment active"
                                                : "segment"
                                        }
                                        onClick={() => {
                                            onAuthModeChange("register");
                                        }}
                                    >
                                        {t("settings.auth.registerTab")}
                                    </button>
                                </div>

                                <span
                                    className={
                                        backend.connected
                                            ? "auth-service-status online"
                                            : "auth-service-status"
                                    }
                                >
                                    <span className="status-dot" />
                                    {backend.connected
                                        ? t("settings.auth.serviceReady")
                                        : t("settings.auth.serviceOffline")}
                                </span>
                            </div>

                            <div className="auth-card-heading">
                                <h3>
                                    {authMode === "login"
                                        ? t("settings.auth.signInTitle")
                                        : t("settings.auth.registerTitle")}
                                </h3>
                                <p>
                                    {authMode === "login"
                                        ? t("settings.auth.signInDescription")
                                        : t("settings.auth.registerDescription")}
                                </p>
                            </div>

                            <div className="social-auth-grid">
                                {socialProviders.map((provider) => {
                                    const loading =
                                        socialAuthLoadingProvider === provider.provider;

                                    return (
                                        <div
                                            className="social-auth-provider"
                                            key={provider.provider}
                                        >
                                            <button
                                                type="button"
                                                className={`social-auth-button ${provider.provider.toLowerCase()}`}
                                                disabled={
                                                    !backend.connected ||
                                                    !provider.available ||
                                                    isAuthLoading ||
                                                    socialAuthLoadingProvider !== null
                                                }
                                                onClick={() => {
                                                    onSocialLogin(provider.provider);
                                                }}
                                            >
                                                <span className="social-auth-logo">
                                                    {loading ? (
                                                        <span className="auth-inline-spinner" />
                                                    ) : (
                                                        <SocialProviderLogo provider={provider.provider} />
                                                    )}
                                                </span>

                                                <span className="social-auth-button-copy">
                                                    {loading
                                                        ? `${t("settings.auth.waitingFor")} ${provider.displayName}...`
                                                        : `${t("settings.auth.continueWith")} ${provider.displayName}`}
                                                </span>
                                            </button>

                                            {!provider.available && (
                                                <small>
                                                    {t("settings.auth.providerUnavailable")}
                                                </small>
                                            )}
                                        </div>
                                    );
                                })}

                                {!socialProviders.length && (
                                    <div className="social-auth-unavailable">
                                        {t("settings.auth.providersUnavailable")}
                                    </div>
                                )}
                            </div>

                            {socialAuthLoadingProvider !== null && (
                                <div className="social-auth-cancel-row">
                                    <button
                                        type="button"
                                        className="text-action"
                                        onClick={onCancelSocialLogin}
                                    >
                                        Hủy đăng nhập
                                    </button>
                                </div>
                            )}

                            <div className="social-auth-divider">
                                <span>{t("settings.auth.orEmail")}</span>
                            </div>

                            <form
                                className="auth-form auth-form-stacked"
                                onSubmit={onSubmitAuth}
                            >
                                <label className="control-field">
                                    <span>{t("settings.auth.email")}</span>

                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(event) => {
                                            onEmailChange(event.target.value);
                                        }}
                                        placeholder={t("settings.auth.emailPlaceholder")}
                                        autoComplete="email"
                                    />
                                </label>

                                <label className="control-field">
                                    <span>{t("settings.auth.password")}</span>

                                    <PasswordField
                                        value={password}
                                        onChange={onPasswordChange}
                                        placeholder={
                                            authMode === "login"
                                                ? t("settings.auth.passwordPlaceholder")
                                                : t("settings.auth.newPasswordPlaceholder")
                                        }
                                        autoComplete={
                                            authMode === "login"
                                                ? "current-password"
                                                : "new-password"
                                        }
                                    />
                                </label>

                                <button
                                    className="primary-action auth-submit-button"
                                    type="submit"
                                    disabled={
                                        isAuthLoading ||
                                        !backend.connected
                                    }
                                >
                                    {isAuthLoading
                                        ? t("settings.auth.processing")
                                        : authMode === "login"
                                            ? t("settings.auth.signIn")
                                            : t("settings.auth.createAccount")}
                                </button>
                            </form>

                            {emailVerificationRequired && (
                                <div className="password-recovery-panel">
                                    <form
                                        className="auth-form compact-password-form"
                                        onSubmit={onConfirmEmailVerification}
                                    >
                                        <div className="notice info compact-notice">
                                            Xác minh email để hoàn tất đăng nhập.
                                            Mã xác minh gồm 6 số và có hiệu lực trong 10 phút.
                                        </div>

                                        <label className="control-field">
                                            <span>Email tài khoản</span>

                                            <input
                                                type="email"
                                                value={emailVerificationEmail}
                                                readOnly
                                                autoComplete="email"
                                            />
                                        </label>

                                        <button
                                            type="button"
                                            className="secondary-action"
                                            disabled={
                                                !backend.connected ||
                                                isEmailVerificationRequestLoading ||
                                                isEmailVerificationConfirmLoading ||
                                                emailVerificationCooldownSeconds > 0
                                            }
                                            onClick={onRequestEmailVerification}
                                        >
                                            {isEmailVerificationRequestLoading
                                                ? "Đang gửi mã..."
                                                : emailVerificationCooldownSeconds > 0
                                                    ? `Gửi lại sau ${emailVerificationCooldownSeconds}s`
                                                    : "Gửi mã xác minh"}
                                        </button>

                                        <label className="control-field">
                                            <span>Mã xác minh 6 số</span>

                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={6}
                                                value={emailVerificationCode}
                                                onChange={(event) => {
                                                    onEmailVerificationCodeChange(
                                                        event.target.value
                                                            .replace(/\D/g, "")
                                                            .slice(0, 6)
                                                    );
                                                }}
                                                placeholder="000000"
                                                autoComplete="one-time-code"
                                                autoFocus
                                            />
                                        </label>

                                        <button
                                            type="submit"
                                            className="primary-action"
                                            disabled={
                                                !backend.connected ||
                                                isEmailVerificationRequestLoading ||
                                                isEmailVerificationConfirmLoading ||
                                                emailVerificationCode.length !== 6
                                            }
                                        >
                                            {isEmailVerificationConfirmLoading
                                                ? "Đang xác minh..."
                                                : "Xác minh và đăng nhập"}
                                        </button>

                                        <button
                                            type="button"
                                            className="text-action"
                                            disabled={
                                                isEmailVerificationRequestLoading ||
                                                isEmailVerificationConfirmLoading
                                            }
                                            onClick={onCancelEmailVerification}
                                        >
                                            Hủy xác minh
                                        </button>

                                        {emailVerificationMessage && (
                                            <div className="notice info compact-notice">
                                                {emailVerificationMessage}
                                            </div>
                                        )}
                                    </form>
                                </div>
                            )}

                            {authMode === "login" && deviceTransferRequired && (
                                <div className="password-recovery-panel">
                                    <div className="notice info compact-notice">
                                        Tài khoản này đang liên kết với thiết bị khác.
                                    </div>

                                    {!deviceTransferOpen ? (
                                        <button
                                            type="button"
                                            className="secondary-action"
                                            onClick={() => {
                                                setPasswordRecoveryOpen(false);
                                                setDeviceTransferOpen(true);
                                            }}
                                        >
                                            Chuyển tài khoản sang máy này
                                        </button>
                                    ) : (
                                        <form
                                            className="auth-form compact-password-form"
                                            onSubmit={onConfirmDeviceTransfer}
                                        >
                                            <div className="notice info compact-notice">
                                                Xác minh email để chuyển tài khoản sang máy này.
                                                Sau khi chuyển thành công, các phiên đăng nhập cũ
                                                của tài khoản sẽ bị thu hồi.
                                            </div>

                                            <label className="control-field">
                                                <span>Email tài khoản</span>

                                                <input
                                                    type="email"
                                                    value={deviceTransferEmail}
                                                    onChange={(event) => {
                                                        onDeviceTransferEmailChange(
                                                            event.target.value
                                                        );
                                                    }}
                                                    placeholder="name@example.com"
                                                    autoComplete="email"
                                                />
                                            </label>

                                            <button
                                                type="button"
                                                className="secondary-action"
                                                disabled={
                                                    !backend.connected ||
                                                    isDeviceTransferRequestLoading ||
                                                    isDeviceTransferConfirmLoading ||
                                                    deviceTransferCooldownSeconds > 0
                                                }
                                                onClick={onRequestDeviceTransfer}
                                            >
                                                {isDeviceTransferRequestLoading
                                                    ? "Đang gửi mã..."
                                                    : deviceTransferCooldownSeconds > 0
                                                        ? `Gửi lại sau ${deviceTransferCooldownSeconds}s`
                                                        : "Gửi mã xác minh"}
                                            </button>

                                            <label className="control-field">
                                                <span>Mã xác minh 6 số</span>

                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    maxLength={6}
                                                    value={deviceTransferCode}
                                                    onChange={(event) => {
                                                        onDeviceTransferCodeChange(
                                                            event.target.value
                                                                .replace(/\D/g, "")
                                                                .slice(0, 6)
                                                        );
                                                    }}
                                                    placeholder="000000"
                                                    autoComplete="one-time-code"
                                                />
                                            </label>

                                            <button
                                                type="submit"
                                                className="primary-action"
                                                disabled={
                                                    !backend.connected ||
                                                    isDeviceTransferRequestLoading ||
                                                    isDeviceTransferConfirmLoading ||
                                                    deviceTransferCode.length !== 6
                                                }
                                            >
                                                {isDeviceTransferConfirmLoading
                                                    ? "Đang xác nhận..."
                                                    : "Xác nhận chuyển thiết bị"}
                                            </button>

                                            <button
                                                type="button"
                                                className="text-action"
                                                disabled={
                                                    isDeviceTransferRequestLoading ||
                                                    isDeviceTransferConfirmLoading
                                                }
                                                onClick={() => {
                                                    setDeviceTransferOpen(false);
                                                    onCancelDeviceTransfer();
                                                }}
                                            >
                                                Hủy chuyển thiết bị
                                            </button>

                                            {deviceTransferMessage && (
                                                <div className="notice info compact-notice">
                                                    {deviceTransferMessage}
                                                </div>
                                            )}
                                        </form>
                                    )}
                                </div>
                            )}

                            {authMode === "login" && (
                                <div className="password-recovery-entry">
                                    <button
                                        type="button"
                                        className="text-action"
                                        onClick={() => {
                                            setDeviceTransferOpen(false);
                                            setPasswordRecoveryOpen((value) => !value);
                                            setRecoveryEmail(email);
                                            setRecoveryMessage("");
                                        }}
                                    >
                                        {t("settings.auth.forgotPassword")}
                                    </button>
                                </div>
                            )}

                            {authMode === "login" && passwordRecoveryOpen && (
                                <div className="password-recovery-panel">
                                    <form
                                        className="auth-form compact-password-form"
                                        onSubmit={requestPasswordReset}
                                    >
                                        <label className="control-field">
                                            <span>Email</span>
                                            <input
                                                type="email"
                                                value={recoveryEmail}
                                                onChange={(event) => setRecoveryEmail(event.target.value)}
                                                autoComplete="email"
                                            />
                                        </label>
                                        <button
                                            type="submit"
                                            className="secondary-action"
                                            disabled={recoveryLoading || !backend.connected}
                                        >
                                            {recoveryLoading ? "Đang xử lý..." : "Gửi yêu cầu đặt lại"}
                                        </button>
                                    </form>

                                    <form
                                        className="auth-form compact-password-form reset-password-form"
                                        onSubmit={submitPasswordReset}
                                    >
                                        <label className="control-field">
                                            <span>Mã đặt lại mật khẩu</span>
                                            <input
                                                type="text"
                                                value={recoveryToken}
                                                onChange={(event) => setRecoveryToken(event.target.value)}
                                                autoComplete="one-time-code"
                                            />
                                        </label>
                                        <div className="password-two-column">
                                            <label className="control-field">
                                                <span>Mật khẩu mới</span>
                                                <PasswordField
                                                    value={recoveryNewPassword}
                                                    onChange={setRecoveryNewPassword}
                                                    autoComplete="new-password"
                                                />
                                            </label>
                                            <label className="control-field">
                                                <span>Xác nhận mật khẩu</span>
                                                <PasswordField
                                                    value={recoveryConfirmPassword}
                                                    onChange={setRecoveryConfirmPassword}
                                                    autoComplete="new-password"
                                                />
                                            </label>
                                        </div>
                                        <button
                                            type="submit"
                                            className="primary-action"
                                            disabled={recoveryLoading || !backend.connected}
                                        >
                                            Đặt mật khẩu mới
                                        </button>
                                    </form>
                                    {recoveryMessage && (
                                        <div className="notice info compact-notice">
                                            {recoveryMessage}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="auth-card-footer">
                                <span className="auth-secure-note">
                                    <Icon name="lock" size={13} />
                                    {t("settings.auth.secureNote")}
                                </span>

                                {auth.sessionStored && (
                                    <button
                                        type="button"
                                        className="text-action auth-restore-action"
                                        onClick={onRestoreSession}
                                    >
                                        {t("settings.auth.restoreSession")}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="account-summary account-summary-premium">
                            <div className="large-avatar">
                                {auth.user?.email
                                    ?.slice(0, 1)
                                    .toUpperCase()}
                            </div>

                            <div className="account-summary-copy">
                                <span className="account-kicker">
                                    {t("settings.auth.accountActive")}
                                </span>
                                <strong>{auth.user?.email}</strong>
                            </div>

                            <div className="verified-badge">
                                <Icon name="check" size={13} />
                                {t("settings.auth.verified")}
                            </div>
                        </div>

                        <div className="identity-management">
                            <div className="identity-management-header">
                                <div>
                                    <strong>{t("settings.auth.linkedAccounts")}</strong>
                                    <span>
                                        {t("settings.auth.linkedAccountsDescription")}
                                    </span>
                                </div>

                                <button
                                    className="text-action"
                                    type="button"
                                    onClick={onRefreshAccountIdentities}
                                >
                                    {t("settings.auth.refresh")}
                                </button>
                            </div>

                            <div className="identity-provider-grid">
                                {socialProviders.map((provider) => {
                                    const identity =
                                        accountIdentities.find(
                                            (item) =>
                                                item.provider === provider.provider
                                        );
                                    const loading =
                                        socialAuthLoadingProvider === provider.provider;

                                    return (
                                        <article
                                            className={`identity-provider-card ${identity ? "linked" : ""}`}
                                            key={provider.provider}
                                        >
                                            <div className="identity-provider-mark">
                                                <SocialProviderLogo provider={provider.provider} />
                                            </div>

                                            <div className="identity-provider-main">
                                                <strong>{provider.displayName}</strong>

                                                {identity ? (
                                                    <>
                                                        <span>
                                                            {identity.email ||
                                                                identity.displayName ||
                                                                t("settings.auth.linked")}
                                                        </span>
                                                        <small>
                                                            {t("settings.auth.linked")}
                                                        </small>
                                                    </>
                                                ) : (
                                                    <span>
                                                        {t("settings.auth.notLinked")}
                                                    </span>
                                                )}
                                            </div>

                                            {!identity && (
                                                <button
                                                    className="secondary-action compact"
                                                    type="button"
                                                    disabled={
                                                        !provider.available ||
                                                        socialAuthLoadingProvider !== null
                                                    }
                                                    onClick={() => {
                                                        onLinkAccountIdentity(provider.provider);
                                                    }}
                                                >
                                                    {loading
                                                        ? t("settings.auth.waiting")
                                                        : t("settings.auth.link")}
                                                </button>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {authMessage && (
                    <div className="notice info account-auth-message">
                        {authMessage}
                    </div>
                )}
            </section>

            {auth.authenticated && (
                <section data-settings-group="account" className="settings-section password-security-section">
                    <div className="settings-section-header">
                        <div>
                            <span className="eyebrow">SECURITY</span>
                            <h2>Mật khẩu</h2>
                        </div>
                    </div>
                    <form className="password-security-form" onSubmit={submitPasswordChange}>
                        <label className="control-field">
                            <span>Mật khẩu hiện tại</span>
                            <PasswordField
                                value={currentPassword}
                                onChange={setCurrentPassword}
                                autoComplete="current-password"
                            />
                        </label>
                        <label className="control-field">
                            <span>Mật khẩu mới</span>
                            <PasswordField
                                value={nextPassword}
                                onChange={setNextPassword}
                                autoComplete="new-password"
                            />
                        </label>
                        <label className="control-field">
                            <span>Xác nhận mật khẩu mới</span>
                            <PasswordField
                                value={confirmNextPassword}
                                onChange={setConfirmNextPassword}
                                autoComplete="new-password"
                            />
                        </label>
                        <button
                            type="submit"
                            className="primary-action"
                            disabled={passwordSecurityLoading || !backend.connected}
                        >
                            {passwordSecurityLoading ? "Đang đổi..." : "Đổi mật khẩu"}
                        </button>
                    </form>
                    {passwordSecurityMessage && (
                        <div className="notice info compact-notice">{passwordSecurityMessage}</div>
                    )}
                </section>
            )}

            <section data-settings-group="plan"
                className="settings-section"
                id="pricing-catalog"
            >
                <div className="settings-section-header">
                    <div>
                        <span className="eyebrow">
                            BẢNG GIÁ ĐANG BÁN
                        </span>

                        <h2>
                            Gói & giá
                        </h2>

                        <p>
                            Các gói hiện có và mức giá tương ứng.
                        </p>
                    </div>

                    <button
                        className="secondary-action"
                        type="button"
                        onClick={() => {
                            void loadPricingCatalog();
                        }}
                        disabled={
                            isPricingCatalogLoading ||
                            !backend.connected
                        }
                    >
                        {isPricingCatalogLoading
                            ? "Đang tải..."
                            : "Làm mới bảng giá"}
                    </button>
                </div>

                {!backend.connected && (
                    <div className="notice info">
                        Không thể tải bảng giá lúc này.
                    </div>
                )}

                {pricingCatalogMessage && (
                    <div className="notice info">
                        {pricingCatalogMessage}
                    </div>
                )}

                <div className="device-table">
                    {pricingCatalog.map((plan) => {
                        const enabledFeatures = Object.values(
                            plan.features
                        ).filter(Boolean).length;
                        const current = auth.authenticated &&
                                plan.code === entitlements.planCode;

                        return (
                            <div
                                className="device-row"
                                key={plan.code}
                            >
                                <div>
                                    <strong>
                                        {plan.displayName}
                                        {current ? " · Đang dùng" : ""}
                                    </strong>

                                    <span>
                                        {plan.description || `${enabledFeatures} tính năng`}
                                    </span>
                                </div>

                                <div>
                                    {plan.prices.length > 0
                                        ? plan.prices.map((price) => (
                                            <div key={price.id}>
                                                <strong>
                                                    {billingPeriodLabel(
                                                        price.billingPeriod
                                                    )}
                                                    {": "}
                                                    {formatCatalogMoney(
                                                        price.amountMinor,
                                                        price.currency,
                                                        intlLocale
                                                    )}
                                                </strong>

                                                {price.compareAtAmountMinor != null &&
                                                    price.compareAtAmountMinor > price.amountMinor && (
                                                    <span>
                                                        {" · Niêm yết "}
                                                        {formatCatalogMoney(
                                                            price.compareAtAmountMinor,
                                                            price.currency,
                                                            intlLocale
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        ))
                                        : (
                                            <span>
                                                {plan.code === "FREE"
                                                    ? "Miễn phí"
                                                    : "Chưa mở bán"}
                                            </span>
                                        )}
                                </div>
                            </div>
                        );
                    })}

                    {backend.connected &&
                        !isPricingCatalogLoading &&
                        pricingCatalog.length === 0 &&
                        !pricingCatalogMessage && (
                        <div className="device-row">
                            <div>
                                <strong>
                                    Chưa có gói đang mở bán.
                                </strong>
                            </div>
                        </div>
                    )}
                </div>

            </section>

            {auth.authenticated && (
                <section data-settings-group="plan"
                    className="settings-section"
                    id="plan-license"
                >
                    <div className="settings-section-header">
                        <div>
                            <span className="eyebrow violet">
                                PLAN & LICENSE
                            </span>

                            <h2>
                                Gói sử dụng
                            </h2>

                            <p>
                                Tính năng có trong gói hiện tại của bạn.
                            </p>
                        </div>

                        <button
                            className="secondary-action"
                            onClick={
                                onRefreshEntitlements
                            }
                            disabled={
                                isEntitlementLoading
                            }
                        >
                            {isEntitlementLoading
                                ? "Đang tải..."
                                : "Làm mới"}
                        </button>
                    </div>

                    <div className="account-summary">
                        <div className="large-avatar">
                            {entitlements
                                .planName
                                .slice(0, 1)}
                        </div>

                        <div>
                            <strong>
                                {entitlements.planName}
                            </strong>

                            {entitlements.periodEnd && (
                                <span>
                                    Hết hạn:
                                    {" "}
                                    {new Date(
                                        entitlements.periodEnd
                                    ).toLocaleDateString(
                                        intlLocale
                                    )}
                                </span>
                            )}
                        </div>

                        <div className="verified-badge">
                            ✓ {Object.values(entitlements.features).filter(Boolean).length} tính năng
                        </div>
                    </div>

                    <div className="device-table">
                        {[
                            [
                                "Quick Translate",
                                "quickTranslate"
                            ],
                            [
                                "Study Mode",
                                "studyMode"
                            ],
                            [
                                "Manga Panel",
                                "mangaPanel"
                            ],
                            [
                                "Phiên Manga",
                                "mangaSession"
                            ],
                            [
                                "Translation Memory",
                                "translationMemory"
                            ],
                            [
                                "Continuous Manga",
                                "continuousManga"
                            ],
                            [
                                "Novel TXT",
                                "novelReaderTxt"
                            ],
                            [
                                "Novel EPUB",
                                "novelReaderEpub"
                            ],
                            [
                                "PDF Text Reader",
                                "pdfTextReader"
                            ],
                            [
                                "PDF OCR Reader",
                                "pdfOcrReader"
                            ]
                        ].map(
                            ([label, key]) => (
                                <div
                                    className="device-row"
                                    key={key}
                                >
                                    <div>
                                        <strong>
                                            {label}
                                        </strong>

                                    </div>

                                    <div
                                        className={
                                            entitlements
                                                .features[
                                                    key
                                                ]
                                                ? "verified-badge"
                                                : ""
                                        }
                                    >
                                        {entitlements
                                            .features[key]
                                            ? "✓ Có"
                                            : "— Chưa có"}
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    <div className="notice info">
                        Mức sử dụng:
                        {" "}
                        {entitlements
                            .usage
                            .monthlyTranslationsUsed ?? 0}
                        /
                        {(entitlements.limits.monthlyTranslations ?? 0) < 0
                            ? "∞"
                            : entitlements.limits.monthlyTranslations ?? 0}
                        {" "}lượt ·
                        {" "}
                        {entitlements
                            .limits
                            .mangaPagesPerDay ?? 0}
                        {" "}trang manga/ngày ·
                        {" "}
                        {entitlements
                            .limits
                            .devices ?? 0}
                        {" "}thiết bị.
                    </div>

                    <form
                        className="auth-form"
                        onSubmit={submitLicense}
                    >
                        <label className="control-field">
                            <span>
                                Mã giấy phép
                            </span>

                            <input
                                type="text"
                                value={licenseKey}
                                onChange={(event) => {
                                    setLicenseKey(
                                        event.target.value
                                    );
                                }}
                                placeholder="AIT-XXXX-XXXX-XXXX"
                                autoComplete="off"
                            />
                        </label>

                        <button
                            className="primary-action"
                            type="submit"
                            disabled={
                                isActivatingLicense ||
                                isEntitlementLoading ||
                                !licenseKey.trim()
                            }
                        >
                            {isActivatingLicense
                                ? "Đang kích hoạt..."
                                : "Kích hoạt giấy phép"}
                        </button>
                    </form>

                    {entitlementMessage && (
                        <div className="notice info">
                            {entitlementMessage}
                        </div>
                    )}
                </section>
            )}

            {auth.authenticated && (
                <section data-settings-group="plan" className="settings-section">
                    <div className="settings-section-header">
                        <div>
                            <span className="eyebrow">
                                DEVICES
                            </span>

                            <h2>
                                Thiết bị đăng nhập
                            </h2>

                            <p>
                                Quản lý các thiết bị đang đăng nhập vào tài khoản.
                            </p>
                        </div>

                        <button
                            className="secondary-action"
                            onClick={onLoadDevices}
                            disabled={isLoadingDevices}
                        >
                            {isLoadingDevices
                                ? "Đang tải..."
                                : "Làm mới"}
                        </button>
                    </div>

                    <div className="device-table">
                        {devices.map(
                            (device) => (
                                <div
                                    className="device-row"
                                    key={
                                        device.sessionId
                                    }
                                >
                                    <div>
                                        <strong>
                                            {device.deviceName}
                                            {device.current
                                                ? " · Máy này"
                                                : ""}
                                        </strong>

                                        <span>
                                            {device.lastUsedAt
                                                ? `Hoạt động gần đây: ${new Date(device.lastUsedAt).toLocaleString(intlLocale)}`
                                                : "Thiết bị đã đăng nhập"}
                                        </span>
                                    </div>

                                    <button
                                        className="danger-outline compact"
                                        onClick={() => {
                                            onRevokeDevice(
                                                device.sessionId
                                            );
                                        }}
                                    >
                                        Thu hồi
                                    </button>
                                </div>
                            )
                        )}

                        {!devices.length &&
                            !isLoadingDevices && (
                            <div className="empty-inline">
                                Chưa có dữ liệu thiết bị.
                            </div>
                        )}
                    </div>
                </section>
            )}

            <section data-settings-group="reading" className="settings-section">
                <div className="settings-section-header">
                    <div>
                        <span className="eyebrow violet">
                            READING & STUDY
                        </span>

                        <h2>
                            Mặc định khi đọc truyện
                        </h2>

                        <p>
                            Thiết lập mặc định khi dịch và học.
                        </p>
                    </div>

                    <button
                        className="primary-action"
                        onClick={() => {
                            void savePreferences();
                        }}
                        disabled={
                            isSavingPreferences
                        }
                    >
                        {isSavingPreferences
                            ? "Đang lưu..."
                            : "Lưu cài đặt"}
                    </button>
                </div>

                <div className="settings-preference-grid">
                    <label className="control-field">
                        <span>
                            Trình độ giải thích mặc định
                        </span>

                        <select
                            value={studyLevel}
                            onChange={(event) => {
                                setStudyLevel(
                                    event
                                        .target
                                        .value as
                                        StudyLevel
                                );
                            }}
                        >
                            <option value="AUTO">
                                Auto
                            </option>
                            <option value="N5">
                                N5
                            </option>
                            <option value="N4">
                                N4
                            </option>
                            <option value="N3">
                                N3
                            </option>
                            <option value="N2">
                                N2
                            </option>
                            <option value="N1">
                                N1
                            </option>
                        </select>
                    </label>

                    <label className="settings-toggle-card">
                        <input
                            type="checkbox"
                            checked={
                                autoSaveVocabulary
                            }
                            onChange={(event) => {
                                setAutoSaveVocabulary(
                                    event.target.checked
                                );
                            }}
                        />

                        <span>
                            <strong>
                                Tự động lưu từ vựng
                            </strong>

                            <small>
                                Tự động lưu từ mới.
                            </small>
                        </span>
                    </label>

                    <label className="settings-toggle-card">
                        <input
                            type="checkbox"
                            checked={
                                autoSaveGrammar
                            }
                            onChange={(event) => {
                                setAutoSaveGrammar(
                                    event.target.checked
                                );
                            }}
                        />

                        <span>
                            <strong>
                                Tự động lưu ngữ pháp
                            </strong>

                            <small>
                                Tự động lưu mẫu ngữ pháp.
                            </small>
                        </span>
                    </label>
                </div>

                <div className="settings-subsection">
                    <div>
                        <strong>
                            Bản dịch trên màn hình
                        </strong>

                        <span>
                            Điều chỉnh cách hiển thị bản dịch trên màn hình.
                        </span>
                    </div>

                    <div className="overlay-settings-grid">
                        <label className="settings-toggle-card">
                            <input
                                type="checkbox"
                                checked={
                                    overlayAutoHide
                                }
                                onChange={(event) => {
                                    setOverlayAutoHide(
                                        event
                                            .target
                                            .checked
                                    );
                                }}
                            />

                            <span>
                                <strong>
                                    Tự ẩn khi đổi tab/cửa sổ
                                </strong>

                                <small>
                                    Tắt nếu muốn bản dịch ở lại
                                    cho tới khi bạn đóng hoặc quét lại.
                                </small>
                            </span>
                        </label>

                        <label className="range-setting">
                            <span>
                                Độ trong suốt
                                <strong>
                                    {Math.round(
                                        overlayOpacity *
                                        100
                                    )}%
                                </strong>
                            </span>

                            <input
                                type="range"
                                min={0.5}
                                max="1"
                                step="0.01"
                                value={
                                    overlayOpacity
                                }
                                onChange={(event) => {
                                    setOverlayOpacity(
                                        Number(
                                            event
                                                .target
                                                .value
                                        )
                                    );
                                }}
                            />
                        </label>

                        <label className="control-field">
                            <span>
                                Cỡ chữ bản dịch
                            </span>

                            <select
                                value={
                                    overlayFontScale
                                }
                                onChange={(event) => {
                                    setOverlayFontScale(
                                        Number(
                                            event
                                                .target
                                                .value
                                        )
                                    );
                                }}
                            >
                                <option value="0.5">
                                    Rất nhỏ (50%)
                                </option>
                                <option value="0.6">
                                    60%
                                </option>
                                <option value="0.7">
                                    70%
                                </option>
                                <option value="0.8">
                                    Nhỏ (80%)
                                </option>
                                <option value="1">
                                    Tiêu chuẩn
                                </option>
                                <option value="1.2">
                                    Lớn
                                </option>
                                <option value="1.4">
                                    Rất lớn
                                </option>
                            </select>
                        </label>
                    </div>
                </div>

                {preferencesMessage && (
                    <div className="notice info">
                        {preferencesMessage}
                    </div>
                )}
            </section>

            <section data-settings-group="reading" className="settings-section novel-font-settings-section">
                <div className="settings-section-header">
                    <div>
                        <span className="eyebrow violet">
                            NOVEL READER FONT
                        </span>

                        <h2>
                            Font chữ khi đọc Novel
                        </h2>

                        <p>
                            Font này áp dụng làm mặc định cho Novel Reader.
                            Chế độ Tự động vẫn ưu tiên font phù hợp với
                            tiếng Nhật, Việt, Anh, Trung và Hàn.
                        </p>
                    </div>

                    <div className="novel-font-settings-actions">
                        <button
                            type="button"
                            className="secondary-action"
                            onClick={resetNovelFontSettings}
                        >
                            Reset font
                        </button>

                        <button
                            type="button"
                            className="primary-action"
                            onClick={saveNovelFontSettings}
                        >
                            Lưu font
                        </button>
                    </div>
                </div>

                <div className="settings-preference-grid novel-font-settings-grid">
                    <label className="control-field">
                        <span>Font Reader</span>

                        <select
                            value={novelFontPreset}
                            onChange={(event) => {
                                setNovelFontPreset(
                                    event.target.value as NovelReaderFontPreset
                                );
                            }}
                        >
                            <option value="auto">
                                Tự động · Khuyên dùng
                            </option>
                            <option value="serif">
                                Serif · Kiểu sách
                            </option>
                            <option value="sans">
                                Sans · Dễ nhìn
                            </option>
                            <option value="jp-gothic">
                                Japanese Gothic
                            </option>
                            <option value="jp-mincho">
                                Japanese Mincho
                            </option>
                            <option value="system">
                                Font hệ thống
                            </option>
                            <option value="custom">
                                Font tùy chỉnh
                            </option>
                        </select>

                        <small>
                            Tự động là lựa chọn an toàn nhất khi novel
                            có nhiều ngôn ngữ.
                        </small>
                    </label>

                    <label className="control-field">
                        <span>Custom font family</span>

                        <input
                            value={novelCustomFont}
                            onChange={(event) => {
                                setNovelCustomFont(
                                    event.target.value.slice(0, 160)
                                );
                            }}
                            disabled={novelFontPreset !== "custom"}
                            placeholder='Ví dụ: "Noto Serif JP", Meiryo'
                        />

                        <small>
                            Nhập tên font đã cài trên máy.
                        </small>
                    </label>
                </div>

                <div
                    className="novel-font-preview"
                    style={{
                        fontFamily: novelReaderFontStack({
                            preset: novelFontPreset,
                            customFamily: novelCustomFont
                        })
                    }}
                >
                    <span>Preview</span>
                    <strong>
                        日本語の小説 · Tiếng Việt · English Novel
                    </strong>
                    <p>
                        魔法の本を開いた。 — Cô ấy mở cuốn sách ma thuật.
                        — She opened the book of magic.
                    </p>
                </div>

                {novelFontMessage && (
                    <div className="notice info">
                        {novelFontMessage}
                    </div>
                )}
            </section>

            <section data-settings-group="reading" className="settings-section">
                <div className="settings-section-header">
                    <div>
                        <span className="eyebrow">
                            GLOBAL HOTKEYS
                        </span>

                        <h2>
                            Phím tắt khi đọc truyện
                        </h2>

                        <p>
                            Các phím tắt vẫn hoạt động khi AI Translator đang chạy nền.
                        </p>
                    </div>

                    <button
                        className="primary-action"
                        onClick={() => {
                            void saveShortcuts();
                        }}
                        disabled={
                            isSavingShortcuts
                        }
                    >
                        {isSavingShortcuts
                            ? "Đang lưu..."
                            : "Lưu phím tắt"}
                    </button>
                </div>

                <div className="shortcut-settings-grid">
                    <label className="control-field">
                        <span>
                            Dịch nhanh
                        </span>

                        <input
                            value={
                                translateShortcut
                            }
                            onChange={(event) => {
                                setTranslateShortcut(
                                    event.target.value
                                );
                            }}
                            placeholder="Ctrl+Shift+Q"
                        />

                        <small>
                            Mặc định:
                            {" "}
                            Ctrl+Shift+Q
                        </small>
                    </label>

                    <label className="control-field">
                        <span>
                            Quét khung truyện
                        </span>

                        <input
                            value={
                                panelShortcut
                            }
                            onChange={(event) => {
                                setPanelShortcut(
                                    event.target.value
                                );
                            }}
                            placeholder="Ctrl+Shift+W"
                        />

                        <small>
                            Mặc định:
                            {" "}
                            Ctrl+Shift+W
                        </small>
                    </label>

                    <label className="control-field">
                        <span>
                            Dịch trang manga hiện tại
                        </span>

                        <input
                            value={
                                panelNextShortcut
                            }
                            onChange={(event) => {
                                setPanelNextShortcut(
                                    event.target.value
                                );
                            }}
                            placeholder="Ctrl+Shift+Y"
                        />

                        <small>
                            Sau khi tự chuyển trang, nhấn phím này để quét lại vùng cũ. Mặc định: Ctrl+Shift+Y
                        </small>
                    </label>

                    <label className="control-field">
                        <span>
                            Study / Học câu
                        </span>

                        <input
                            value={
                                studyShortcut
                            }
                            onChange={(event) => {
                                setStudyShortcut(
                                    event.target.value
                                );
                            }}
                            placeholder="Ctrl+Shift+E"
                        />

                        <small>
                            Mặc định:
                            {" "}
                            Ctrl+Shift+E
                        </small>
                    </label>
                </div>

                {shortcutMessage && (
                    <div className="notice info">
                        {shortcutMessage}
                    </div>
                )}
            </section>

            <section data-settings-group="advanced" className="settings-section">
                <div className="settings-section-header">
                    <div>
                        <span className="eyebrow">
                            EXPERIENCE
                        </span>

                        <h2>
                            Hướng dẫn & khôi phục
                        </h2>

                        <p>
                            Chỉ đặt lại cài đặt ứng dụng. Tài khoản, hồ sơ dịch,
                            từ vựng, ngữ pháp và lịch sử ôn tập sẽ được giữ nguyên.
                        </p>
                    </div>
                </div>

                <div className="settings-action-row">
                    <button
                        className="secondary-action"
                        onClick={
                            onShowOnboarding
                        }
                    >
                        Xem lại hướng dẫn
                    </button>

                    <button
                        className="danger-outline"
                        onClick={() => {
                            void resetPreferences();
                        }}
                        disabled={isResetting}
                    >
                        {isResetting
                            ? "Đang khôi phục..."
                            : "Khôi phục mặc định"}
                    </button>
                </div>

                <div className="defaults-preview">
                    <span>
                        Dịch:
                        {" "}
                        Ctrl+Shift+Q
                    </span>

                    <span>
                        Học:
                        {" "}
                        Ctrl+Shift+E
                    </span>

                    <span>
                        Trình độ:
                        {" "}
                        AUTO
                    </span>

                    <span>
                        Hiển thị:
                        {" "}
                        Tự ẩn · 96%
                    </span>
                </div>
            </section>

            <section data-settings-group="advanced" className="settings-section">
                <div className="settings-section-header">
                    <div>
                        <span className="eyebrow">SERVICE</span>
                        <h2>Trạng thái dịch vụ</h2>
                    </div>

                    <button
                        className="secondary-action"
                        onClick={onRefreshBackend}
                        disabled={isCheckingBackend}
                    >
                        {isCheckingBackend ? "Đang kiểm tra..." : "Thử lại"}
                    </button>
                </div>

                <div className="backend-summary">
                    <span
                        className={
                            backend.connected
                                ? "status-dot online"
                                : "status-dot"
                        }
                    />
                    <div>
                        <strong>
                            {backend.connected
                                ? "Dịch vụ sẵn sàng"
                                : "Dịch vụ tạm thời không khả dụng"}
                        </strong>
                    </div>
                </div>

                {!backend.connected && (
                    <div className="notice info">
                        Kiểm tra kết nối mạng rồi thử lại.
                    </div>
                )}

                <div className="ocr-service-card">
                    <div className="ocr-service-main">
                        <span
                            className={
                                ocrHealth?.ready
                                    ? "status-dot online"
                                    : ocrHealth?.status === "starting"
                                        ? "status-dot warming"
                                        : "status-dot"
                            }
                        />

                        <div>
                            <div className="ocr-service-title-row">
                                <strong>{t("settings.ocr.title")}</strong>
                                <span className="ocr-service-state">
                                    {ocrStatusLabel()}
                                </span>
                            </div>

                            <p>
                                {t("settings.ocr.description")}
                            </p>

                            <small>
                                {ocrHealth?.runtime.paddleOcrVersion
                                    ? `PaddleOCR ${ocrHealth.runtime.paddleOcrVersion}${
                                        ocrHealth.runtime.pythonVersion
                                            ? ` · Python ${ocrHealth.runtime.pythonVersion}`
                                            : ""
                                    }`
                                    : t("settings.ocr.runtimeFallback")}

                                {ocrHealth?.queued
                                    ? ` · ${ocrHealth.queued} ${t("settings.ocr.queuedSuffix")}`
                                    : ""}
                            </small>
                        </div>
                    </div>

                    <div className="ocr-service-actions">
                        <button
                            className="secondary-action compact"
                            type="button"
                            onClick={() => {
                                void refreshOcrHealth();
                            }}
                            disabled={isCheckingOcr || isRestartingOcr}
                        >
                            {isCheckingOcr
                                ? t("settings.ocr.checking")
                                : t("settings.ocr.refresh")}
                        </button>

                        <button
                            className="secondary-action compact"
                            type="button"
                            onClick={() => {
                                void restartOcrEngine();
                            }}
                            disabled={isRestartingOcr}
                        >
                            {isRestartingOcr
                                ? t("settings.ocr.restarting")
                                : t("settings.ocr.restart")}
                        </button>
                    </div>
                </div>

                {ocrHealth?.status === "degraded" && (
                    <div className="notice info">
                        {t("settings.ocr.problemHint")}
                    </div>
                )}
            </section>
        </div>
    );
}

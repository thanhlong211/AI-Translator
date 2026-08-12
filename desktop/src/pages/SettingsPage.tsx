import {
    useEffect,
    useState
} from "react";

import type {
    FormEvent
} from "react";

import type {
    AppPreferences,
    AuthStatus,
    BackendStatus,
    DeviceSession,
    ShortcutSettings,
    StudyLevel
} from "../app/types";

interface SettingsPageProps {
    backend: BackendStatus;
    auth: AuthStatus;
    authMode: "login" | "register";
    email: string;
    password: string;
    authMessage: string;
    isAuthLoading: boolean;
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
}

export function SettingsPage({
    backend,
    auth,
    authMode,
    email,
    password,
    authMessage,
    isAuthLoading,
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
    onLogout,
    onRestoreSession,
    onRefreshBackend,
    onLoadDevices,
    onRevokeDevice
}: SettingsPageProps) {
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

    return (
        <div className="page-stack settings-page">
            <section className="settings-section">
                <div className="settings-section-header">
                    <div>
                        <span className="eyebrow">
                            ACCOUNT
                        </span>

                        <h2>
                            Tài khoản AI Translator
                        </h2>

                        <p>
                            Access token chỉ giữ trong RAM.
                            Refresh token được mã hóa bằng
                            Electron safeStorage.
                        </p>
                    </div>

                    {auth.authenticated && (
                        <button
                            className="danger-outline"
                            onClick={onLogout}
                            disabled={isAuthLoading}
                        >
                            Đăng xuất
                        </button>
                    )}
                </div>

                {!auth.authenticated ? (
                    <div className="auth-surface">
                        <div className="auth-tabs">
                            <button
                                className={
                                    authMode === "login"
                                        ? "segment active"
                                        : "segment"
                                }
                                onClick={() => {
                                    onAuthModeChange(
                                        "login"
                                    );
                                }}
                            >
                                Đăng nhập
                            </button>

                            <button
                                className={
                                    authMode === "register"
                                        ? "segment active"
                                        : "segment"
                                }
                                onClick={() => {
                                    onAuthModeChange(
                                        "register"
                                    );
                                }}
                            >
                                Đăng ký
                            </button>
                        </div>

                        <form
                            className="auth-form"
                            onSubmit={onSubmitAuth}
                        >
                            <label className="control-field">
                                <span>Email</span>

                                <input
                                    type="email"
                                    value={email}
                                    onChange={(event) => {
                                        onEmailChange(
                                            event.target.value
                                        );
                                    }}
                                    autoComplete="email"
                                />
                            </label>

                            <label className="control-field">
                                <span>Mật khẩu</span>

                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) => {
                                        onPasswordChange(
                                            event.target.value
                                        );
                                    }}
                                    autoComplete={
                                        authMode === "login"
                                            ? "current-password"
                                            : "new-password"
                                    }
                                />
                            </label>

                            <button
                                className="primary-action"
                                type="submit"
                                disabled={
                                    isAuthLoading ||
                                    !backend.connected
                                }
                            >
                                {isAuthLoading
                                    ? "Đang xử lý..."
                                    : authMode === "login"
                                        ? "Đăng nhập"
                                        : "Tạo tài khoản"}
                            </button>
                        </form>

                        {auth.sessionStored && (
                            <button
                                className="text-action"
                                onClick={onRestoreSession}
                            >
                                Khôi phục phiên đã lưu
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="account-summary">
                        <div className="large-avatar">
                            {auth.user?.email
                                ?.slice(0, 1)
                                .toUpperCase()}
                        </div>

                        <div>
                            <strong>
                                {auth.user?.email}
                            </strong>

                            <span>
                                Role:
                                {" "}
                                {auth.user?.role}
                            </span>
                        </div>

                        <div className="verified-badge">
                            ✓ Đã xác thực
                        </div>
                    </div>
                )}

                {authMessage && (
                    <div className="notice info">
                        {authMessage}
                    </div>
                )}
            </section>

            {auth.authenticated && (
                <section className="settings-section">
                    <div className="settings-section-header">
                        <div>
                            <span className="eyebrow">
                                DEVICES
                            </span>

                            <h2>
                                Thiết bị đăng nhập
                            </h2>

                            <p>
                                Thu hồi refresh session của từng máy.
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
                                            {device.deviceId}
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

            <section className="settings-section">
                <div className="settings-section-header">
                    <div>
                        <span className="eyebrow violet">
                            STUDY & OVERLAY
                        </span>

                        <h2>
                            Mặc định khi đọc truyện
                        </h2>

                        <p>
                            Các lựa chọn này được lưu ở Desktop
                            và áp dụng cho Global Shortcut.
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
                            Study level mặc định
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
                                Chỉ lưu Vocabulary metadata,
                                không lưu screenshot/câu manga.
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
                                Pattern/meaning/explanation được
                                đưa vào Learning Library.
                            </small>
                        </span>
                    </label>
                </div>

                <div className="settings-subsection">
                    <div>
                        <strong>
                            Translation Overlay
                        </strong>

                        <span>
                            Điều chỉnh bubble dịch mà không ảnh hưởng
                            OCR hay vùng chọn.
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
                                    Tắt nếu muốn overlay ở lại
                                    cho tới khi Close/scan mới.
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
                                min="0.65"
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
                                Cỡ chữ overlay
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
                                <option value="0.8">
                                    Nhỏ
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

            <section className="settings-section">
                <div className="settings-section-header">
                    <div>
                        <span className="eyebrow">
                            GLOBAL HOTKEYS
                        </span>

                        <h2>
                            Phím tắt khi đọc truyện
                        </h2>

                        <p>
                            Dịch nhanh, Quét khung truyện và Study là
                            ba phím độc lập, kể cả khi app đang minimized.
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
                            Trang manga tiếp theo
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
                            Dùng lại vùng quét của Manga Session · mặc định Ctrl+Shift+Y
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

                <div className="shortcut-behavior-note">
                    <strong>
                        Dịch nhanh
                    </strong>

                    <span>
                        → OCR → /translate → overlay
                    </span>

                    <strong>
                        Quét khung truyện
                    </strong>

                    <span>
                        → chọn một khung/page → OCR nhiều bubble → batch translate → multi-overlay
                    </span>

                    <strong>
                        Trang tiếp theo
                    </strong>

                    <span>
                        → dùng lại vùng Manga Session → OCR → bubble detect → batch translate với context trang trước
                    </span>

                    <strong>
                        Study
                    </strong>

                    <span>
                        → OCR → Fast Translate + Study background
                    </span>
                </div>
            </section>

            <section className="settings-section">
                <div className="settings-section-header">
                    <div>
                        <span className="eyebrow">
                            EXPERIENCE
                        </span>

                        <h2>
                            Hướng dẫn & khôi phục
                        </h2>

                        <p>
                            Khôi phục chỉ tác động cấu hình Desktop.
                            Không xóa account, Profile, Vocabulary,
                            Grammar hoặc Review history.
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
                        Study:
                        {" "}
                        Ctrl+Shift+E
                    </span>

                    <span>
                        Level:
                        {" "}
                        AUTO
                    </span>

                    <span>
                        Overlay:
                        {" "}
                        Auto-hide · 96%
                    </span>
                </div>
            </section>

            <section className="settings-section">
                <div className="settings-section-header">
                    <div>
                        <span className="eyebrow">
                            BACKEND
                        </span>

                        <h2>
                            Java Spring Boot
                        </h2>

                        <p>
                            {backend.baseUrl}
                        </p>
                    </div>

                    <button
                        className="secondary-action"
                        onClick={
                            onRefreshBackend
                        }
                        disabled={
                            isCheckingBackend
                        }
                    >
                        {isCheckingBackend
                            ? "Đang kiểm tra..."
                            : "Kiểm tra"}
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
                                ? "Backend ready"
                                : "Backend offline"}
                        </strong>

                        <span>
                            {backend.status}
                        </span>
                    </div>
                </div>

                {backend.error && (
                    <div className="notice danger">
                        {backend.error}
                    </div>
                )}

                <div className="swagger-link">
                    Swagger UI:
                    {" "}
                    {backend.baseUrl}
                    /swagger-ui.html
                </div>
            </section>
        </div>
    );
}

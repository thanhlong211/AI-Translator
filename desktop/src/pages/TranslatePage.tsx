import { useState } from "react";

import type {
    AuthStatus,
    BackendStatus,
    TargetTranslationLanguage,
    TranslationLanguage,
    TranslationProfile,
    TranslationState,
    TranslationStyle
} from "../app/types";

import { Icon } from "../components/Icon";
import {
    sourceTranslationLanguages,
    targetTranslationLanguages,
    translationLanguageLabels
} from "../app/translationLanguages";

interface TranslatePageProps {
    backend: BackendStatus;
    auth: AuthStatus;
    translation: TranslationState;
    profiles: TranslationProfile[];
    activeProfile: TranslationProfile | null;
    profileDirty: boolean;
    isProfileSaving: boolean;
    shortcutDisplay: string;
    panelShortcutDisplay: string;
    sourceLanguage: TranslationLanguage;
    targetLanguage: TargetTranslationLanguage;
    onSourceLanguageChange:
        (value: TranslationLanguage) => void;
    onTargetLanguageChange:
        (value: TargetTranslationLanguage) => void;
    onSelectProfile: (profileId: number) => void;
    onProfileChange:
        (next: TranslationProfile) => void;
    onSaveProfile: () => void;
    onClearContext: () => void;
    onScan: () => void;
    onPanelScan: () => void;
    onFullScreenScan: () => void;
    onSubmitFeedback:
        (allowModelImprovement: boolean) => Promise<unknown>;
    onCopy: () => void;
    onOriginalChange: (value: string) => void;
    onVietnameseChange: (value: string) => void;
}

const styleLabels:
    Record<TranslationStyle, string> = {
        NATURAL: "Tự nhiên",
        MANGA: "Manga / Anime",
        LITERAL: "Sát nghĩa",
        POLITE: "Lịch sự"
    };

export function TranslatePage({
    backend,
    auth,
    translation,
    profiles,
    activeProfile,
    profileDirty,
    isProfileSaving,
    shortcutDisplay,
    panelShortcutDisplay,
    sourceLanguage,
    targetLanguage,
    onSourceLanguageChange,
    onTargetLanguageChange,
    onSelectProfile,
    onProfileChange,
    onSaveProfile,
    onClearContext,
    onScan,
    onPanelScan,
    onFullScreenScan,
    onSubmitFeedback,
    onCopy,
    onOriginalChange,
    onVietnameseChange
}: TranslatePageProps) {
    const [
        allowModelImprovement,
        setAllowModelImprovement
    ] = useState(false);

    const [
        isSubmittingFeedback,
        setIsSubmittingFeedback
    ] = useState(false);

    const aiBaseline =
        (translation.aiTranslation || "")
            .trim();

    const editedTranslation =
        translation.vietnamese.trim();

    const canSubmitFeedback =
        Boolean(translation.original.trim()) &&
        Boolean(aiBaseline) &&
        Boolean(editedTranslation) &&
        editedTranslation !== aiBaseline &&
        editedTranslation !==
            (translation.lastFeedbackTranslation || "")
                .trim();

    async function submitFeedback() {
        try {
            setIsSubmittingFeedback(true);
            await onSubmitFeedback(
                allowModelImprovement
            );
        } finally {
            setIsSubmittingFeedback(false);
        }
    }

    const canScan =
        backend.connected &&
        auth.authenticated &&
        !translation.isScanning &&
        Boolean(activeProfile);

    function patchProfile(
        patch:
            Partial<TranslationProfile>
    ) {
        if (!activeProfile) {
            return;
        }

        onProfileChange({
            ...activeProfile,
            ...patch
        });
    }

    return (
        <div className="page-stack">
            <section className="hero-card">
                <div>
                    <span className="eyebrow">
                        QUICK TRANSLATE
                    </span>

                    <h2>
                        Dịch khung truyện, manga hoặc vùng trên màn hình
                    </h2>

                    <p>
                        Quét một khung truyện hoặc vùng nội dung bạn muốn dịch.
                    </p>
                </div>

                <div className="hero-translation-actions">
                    <button
                        className="scan-primary"
                        onClick={onPanelScan}
                        disabled={!canScan}
                        title="Kéo chọn một khung truyện hoặc vùng manga để dịch cùng lúc"
                    >
                        <Icon name="scan" size={19} />

                        {translation.isScanning
                            ? "Đang xử lý..."
                            : "Quét khung truyện"}

                        <kbd>
                            {panelShortcutDisplay}
                        </kbd>
                    </button>

                    <button
                        className="secondary-action"
                        onClick={onScan}
                        disabled={!canScan}
                        title="Dịch nhanh một vùng chữ"
                    >
                        <Icon name="scan" size={18} />
                        Chọn 1 vùng
                        <kbd>
                            {shortcutDisplay}
                        </kbd>
                    </button>

                    <button
                        className="secondary-action full-screen-action"
                        onClick={onFullScreenScan}
                        disabled={!canScan}
                        title="Quét toàn bộ màn hình"
                    >
                        <Icon name="scan" size={18} />
                        Toàn màn hình
                    </button>
                </div>
            </section>

            {!auth.authenticated && (
                <div className="notice warning">
                    Bạn cần đăng nhập trước khi sử dụng AI Translation.
                </div>
            )}

            {!backend.connected && (
                <div className="notice danger">
                    Dịch vụ tạm thời không khả dụng.
                </div>
            )}

            <section className="control-card">
                <div className="card-heading">
                    <div>
                        <span className="eyebrow">
                            ACTIVE TRANSLATION PROFILE
                        </span>

                        <h3>
                            Hồ sơ dịch
                        </h3>
                    </div>

                    <div className="profile-save-state">
                        {profileDirty && (
                            <span className="unsaved-chip">
                                Chưa lưu
                            </span>
                        )}

                        <button
                            className="secondary-action"
                            onClick={onClearContext}
                            disabled={!activeProfile}
                        >
                            Xóa context
                        </button>

                        <button
                            className="primary-action"
                            onClick={onSaveProfile}
                            disabled={
                                !activeProfile ||
                                !profileDirty ||
                                isProfileSaving
                            }
                        >
                            {isProfileSaving
                                ? "Đang lưu..."
                                : "Lưu Hồ sơ"}
                        </button>
                    </div>
                </div>

                <div className="translation-language-grid">
                    <label className="control-field">
                        <span>Ngôn ngữ nguồn</span>

                        <select
                            value={sourceLanguage}
                            onChange={(event) => {
                                onSourceLanguageChange(
                                    event.target.value as
                                        TranslationLanguage
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

                    <div className="translation-language-arrow">
                        →
                    </div>

                    <label className="control-field">
                        <span>Ngôn ngữ đích</span>

                        <select
                            value={targetLanguage}
                            onChange={(event) => {
                                onTargetLanguageChange(
                                    event.target.value as
                                        TargetTranslationLanguage
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
                </div>

                <div className="profile-selector-row">
                    <label className="control-field">
                        <span>Profile</span>

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

                    <div className="active-profile-meta">
                        <span>
                            {activeProfile?.characters.length ?? 0}
                            {" "}character rules
                        </span>

                        <span>
                            {activeProfile?.glossary.length ?? 0}
                            {" "}glossary terms
                        </span>
                    </div>
                </div>

                {activeProfile && (
                    <>
                        <div className="preference-grid">
                            <label className="control-field">
                                <span>Phong cách</span>

                                <select
                                    value={
                                        activeProfile.style
                                    }
                                    onChange={(event) => {
                                        patchProfile({
                                            style:
                                                event.target
                                                    .value as TranslationStyle
                                        });
                                    }}
                                >
                                    {(
                                        Object.keys(
                                            styleLabels
                                        ) as
                                            TranslationStyle[]
                                    ).map(
                                        (style) => (
                                            <option
                                                key={style}
                                                value={style}
                                            >
                                                {
                                                    styleLabels[
                                                        style
                                                    ]
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="control-field">
                                <span>Context Memory</span>

                                <select
                                    value={
                                        activeProfile
                                            .contextLines
                                    }
                                    onChange={(event) => {
                                        patchProfile({
                                            contextLines:
                                                Number(
                                                    event
                                                        .target
                                                        .value
                                                )
                                        });
                                    }}
                                >
                                    <option value={0}>
                                        Không dùng
                                    </option>
                                    <option value={3}>
                                        3 câu trước
                                    </option>
                                    <option value={5}>
                                        5 câu trước
                                    </option>
                                    <option value={10}>
                                        10 câu trước
                                    </option>
                                </select>
                            </label>

                            <label className="toggle-field">
                                <input
                                    type="checkbox"
                                    checked={
                                        activeProfile
                                            .keepHonorifics
                                    }
                                    onChange={(event) => {
                                        patchProfile({
                                            keepHonorifics:
                                                event
                                                    .target
                                                    .checked
                                        });
                                    }}
                                />

                                <span>
                                    Giữ Senpai / Sensei / Sama
                                </span>
                            </label>
                        </div>

                        <label className="prompt-field">
                            <span>
                                Custom Instructions
                            </span>

                            <textarea
                                value={
                                    activeProfile
                                        .customInstruction ??
                                    ""
                                }
                                onChange={(event) => {
                                    patchProfile({
                                        customInstruction:
                                            event
                                                .target
                                                .value
                                    });
                                }}
                                placeholder="Ví dụ: Nhân vật chính xưng tôi. Không dịch Senpai. Ưu tiên hội thoại manga tự nhiên..."
                            />

                            <small>
                                Hãy lưu Hồ sơ trước khi quét để dùng các thay đổi mới.
                            </small>
                        </label>
                    </>
                )}
            </section>

            <section className="translation-grid">
                <article className="result-panel">
                    <div className="result-header">
                        <div>
                            <span className="eyebrow">
                                SOURCE
                            </span>
                            <h3>Văn bản gốc</h3>
                        </div>

                        <span className="language-pill">
                            {sourceLanguage}
                        </span>
                    </div>

                    <textarea
                        className="result-editor"
                        value={translation.original}
                        onChange={(event) => {
                            onOriginalChange(
                                event.target.value
                            );
                        }}
                        placeholder="Nội dung nhận diện sẽ xuất hiện tại đây"
                    />
                </article>

                <article className="result-panel accent">
                    <div className="result-header">
                        <div>
                            <span className="eyebrow">
                                TRANSLATION
                            </span>
                            <h3>
                                {translationLanguageLabels[targetLanguage]}
                            </h3>
                        </div>

                        <span className="language-pill">
                            {targetLanguage}
                        </span>

                        <button
                            className="icon-button"
                            onClick={onCopy}
                            disabled={
                                !translation.original &&
                                !translation.vietnamese
                            }
                            title="Sao chép"
                        >
                            <Icon name="copy" size={18} />
                        </button>
                    </div>

                    <textarea
                        className="result-editor"
                        value={translation.vietnamese}
                        onChange={(event) => {
                            onVietnameseChange(
                                event.target.value
                            );
                        }}
                        placeholder="Bản dịch sẽ xuất hiện tại đây"
                    />
                </article>
            </section>

            {canSubmitFeedback && (
                <section className="control-card">
                    <div className="card-heading">
                        <div>
                            <span className="eyebrow">
                                TRANSLATION FEEDBACK
                            </span>
                            <h3>
                                Bạn đã chỉnh bản dịch trước đó
                            </h3>
                            <small>
                                Chỉ gửi khi bạn bấm “Lưu bản sửa”.
                            </small>
                        </div>

                        <div className="profile-save-state">
                            <label className="toggle-field">
                                <input
                                    type="checkbox"
                                    checked={
                                        allowModelImprovement
                                    }
                                    onChange={(event) => {
                                        setAllowModelImprovement(
                                            event.target.checked
                                        );
                                    }}
                                />
                                <span>
                                    Cho phép dùng bản sửa để cải thiện AI
                                </span>
                            </label>

                            <button
                                className="secondary-action"
                                onClick={() => {
                                    void submitFeedback();
                                }}
                                disabled={
                                    isSubmittingFeedback
                                }
                            >
                                {isSubmittingFeedback
                                    ? "Đang lưu..."
                                    : "Lưu bản sửa"}
                            </button>
                        </div>
                    </div>
                </section>
            )}

            <div className="page-status">
                <span
                    className={
                        translation.status ===
                        "Hoàn thành"
                            ? "status-indicator success"
                            : "status-indicator"
                    }
                />
                {translation.status}
            </div>
        </div>
    );
}

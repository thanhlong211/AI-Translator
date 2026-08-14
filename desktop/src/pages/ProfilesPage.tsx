import type {
    ProfileCharacterRule,
    ProfileGlossaryEntry,
    TargetTranslationLanguage,
    TranslationLanguage,
    TranslationProfile,
    TranslationStyle
} from "../app/types";

import {
    sourceTranslationLanguages,
    targetTranslationLanguages,
    translationLanguageLabels
} from "../app/translationLanguages";

interface ProfilesPageProps {
    profiles: TranslationProfile[];
    activeProfile: TranslationProfile | null;
    profileDirty: boolean;
    profileMessage: string;
    isProfileSaving: boolean;
    onSelectProfile: (profileId: number) => void;
    onProfileChange:
        (next: TranslationProfile) => void;
    onSaveProfile: () => void;
    onCreateProfile: () => void;
    onDeleteProfile: () => void;
    onSetDefaultProfile: () => void;
    onClearContext: () => void;
}

const styleLabels:
    Record<TranslationStyle, string> = {
        NATURAL: "Tự nhiên",
        MANGA: "Manga / Anime",
        LITERAL: "Sát nghĩa",
        POLITE: "Lịch sự"
    };

export function ProfilesPage({
    profiles,
    activeProfile,
    profileDirty,
    profileMessage,
    isProfileSaving,
    onSelectProfile,
    onProfileChange,
    onSaveProfile,
    onCreateProfile,
    onDeleteProfile,
    onSetDefaultProfile,
    onClearContext
}: ProfilesPageProps) {
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

    function updateCharacter(
        index: number,
        patch:
            Partial<ProfileCharacterRule>
    ) {
        if (!activeProfile) {
            return;
        }

        const next =
            activeProfile.characters.map(
                (item, itemIndex) =>
                    itemIndex === index
                        ? {
                            ...item,
                            ...patch
                        }
                        : item
            );

        patchProfile({
            characters: next
        });
    }

    function addCharacter() {
        if (!activeProfile) {
            return;
        }

        patchProfile({
            characters: [
                ...activeProfile.characters,
                {
                    name: "",
                    aliases: [],
                    rule: ""
                }
            ]
        });
    }

    function removeCharacter(
        index: number
    ) {
        if (!activeProfile) {
            return;
        }

        patchProfile({
            characters:
                activeProfile.characters.filter(
                    (_, itemIndex) =>
                        itemIndex !== index
                )
        });
    }

    function updateGlossary(
        index: number,
        patch:
            Partial<ProfileGlossaryEntry>
    ) {
        if (!activeProfile) {
            return;
        }

        const next =
            activeProfile.glossary.map(
                (item, itemIndex) =>
                    itemIndex === index
                        ? {
                            ...item,
                            ...patch
                        }
                        : item
            );

        patchProfile({
            glossary: next
        });
    }

    function addGlossary() {
        if (!activeProfile) {
            return;
        }

        patchProfile({
            glossary: [
                ...activeProfile.glossary,
                {
                    sourceLanguage: "AUTO",
                    targetLanguage: "VI",
                    source: "",
                    target: "",
                    note: ""
                }
            ]
        });
    }

    function removeGlossary(
        index: number
    ) {
        if (!activeProfile) {
            return;
        }

        patchProfile({
            glossary:
                activeProfile.glossary.filter(
                    (_, itemIndex) =>
                        itemIndex !== index
                )
        });
    }

    return (
        <div className="page-stack">
            <section className="page-intro-row">
                <div>
                    <span className="eyebrow">
                        TRANSLATION PROFILE
                    </span>

                    <h2>
                        Translation Profiles
                    </h2>

                    <p>
                        Quản lý phong cách dịch, nhân vật và thuật ngữ cho từng nội dung.
                    </p>
                </div>

                <button
                    className="primary-action"
                    onClick={onCreateProfile}
                >
                    + Tạo Profile
                </button>
            </section>

            <section className="profile-layout">
                <aside className="profile-list">
                    {profiles.map(
                        (profile) => (
                            <button
                                key={profile.id}
                                className={
                                    activeProfile?.id ===
                                    profile.id
                                        ? "profile-item active"
                                        : "profile-item"
                                }
                                onClick={() => {
                                    onSelectProfile(
                                        profile.id
                                    );
                                }}
                            >
                                <span className="profile-avatar">
                                    {profile.name
                                        .slice(0, 1)
                                        .toUpperCase()}
                                </span>

                                <span>
                                    <strong>
                                        {profile.name}
                                    </strong>

                                    <small>
                                        {
                                            styleLabels[
                                                profile.style
                                            ]
                                        }
                                        {profile.defaultProfile
                                            ? " · Default"
                                            : ""}
                                    </small>
                                </span>
                            </button>
                        )
                    )}

                    {!profiles.length && (
                        <div className="profile-placeholder">
                            Chưa có profile.
                        </div>
                    )}
                </aside>

                <article className="profile-editor">
                    {!activeProfile ? (
                        <div className="empty-inline">
                            Chọn hoặc tạo một Profile.
                        </div>
                    ) : (
                        <>
                            <div className="card-heading">
                                <div>
                                    <span className="eyebrow">
                                        PROFILE EDITOR
                                    </span>

                                    <h3>
                                        {activeProfile.name}
                                    </h3>
                                </div>

                                <div className="profile-save-state">
                                    {profileDirty && (
                                        <span className="unsaved-chip">
                                            Chưa lưu
                                        </span>
                                    )}

                                    {!activeProfile.defaultProfile && (
                                        <button
                                            className="secondary-action"
                                            onClick={
                                                onSetDefaultProfile
                                            }
                                        >
                                            Đặt mặc định
                                        </button>
                                    )}

                                    <button
                                        className="secondary-action"
                                        onClick={onClearContext}
                                    >
                                        Xóa context
                                    </button>

                                    <button
                                        className="primary-action"
                                        onClick={onSaveProfile}
                                        disabled={
                                            !profileDirty ||
                                            isProfileSaving
                                        }
                                    >
                                        {isProfileSaving
                                            ? "Đang lưu..."
                                            : "Lưu"}
                                    </button>
                                </div>
                            </div>

                            <div className="form-grid">
                                <label className="control-field">
                                    <span>
                                        Tên Profile
                                    </span>

                                    <input
                                        value={
                                            activeProfile.name
                                        }
                                        onChange={(event) => {
                                            patchProfile({
                                                name:
                                                    event
                                                        .target
                                                        .value
                                            });
                                        }}
                                    />
                                </label>

                                <label className="control-field">
                                    <span>Style</span>

                                    <select
                                        value={
                                            activeProfile.style
                                        }
                                        onChange={(event) => {
                                            patchProfile({
                                                style:
                                                    event
                                                        .target
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
                                    <span>
                                        Context Memory
                                    </span>

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
                                            3 câu
                                        </option>
                                        <option value={5}>
                                            5 câu
                                        </option>
                                        <option value={10}>
                                            10 câu
                                        </option>
                                        <option value={20}>
                                            20 câu
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
                                        Giữ honorifics
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
                                    placeholder="Ví dụ: Dịch tự nhiên. Frieren xưng tôi. Không Việt hóa tên phép thuật..."
                                />
                            </label>

                            <section className="profile-subsection">
                                <div className="subsection-heading">
                                    <div>
                                        <h4>
                                            Character Rules
                                        </h4>

                                        <p>
                                            Dùng để kiểm soát xưng hô,
                                            tên gọi và tính cách từng nhân vật.
                                        </p>
                                    </div>

                                    <button
                                        className="secondary-action"
                                        onClick={addCharacter}
                                    >
                                        + Nhân vật
                                    </button>
                                </div>

                                <div className="rule-list">
                                    {activeProfile.characters.map(
                                        (
                                            character,
                                            index
                                        ) => (
                                            <div
                                                className="rule-card"
                                                key={
                                                    character.id ??
                                                    `new-character-${index}`
                                                }
                                            >
                                                <div className="rule-grid character-grid">
                                                    <label className="control-field">
                                                        <span>
                                                            Tên
                                                        </span>

                                                        <input
                                                            value={
                                                                character.name
                                                            }
                                                            onChange={(event) => {
                                                                updateCharacter(
                                                                    index,
                                                                    {
                                                                        name:
                                                                            event
                                                                                .target
                                                                                .value
                                                                    }
                                                                );
                                                            }}
                                                            placeholder="Frieren"
                                                        />
                                                    </label>

                                                    <label className="control-field">
                                                        <span>
                                                            Aliases
                                                        </span>

                                                        <input
                                                            value={
                                                                character.aliases.join(
                                                                    ", "
                                                                )
                                                            }
                                                            onChange={(event) => {
                                                                updateCharacter(
                                                                    index,
                                                                    {
                                                                        aliases:
                                                                            event
                                                                                .target
                                                                                .value
                                                                                .split(
                                                                                    ","
                                                                                )
                                                                                .map(
                                                                                    value =>
                                                                                        value.trim()
                                                                                )
                                                                                .filter(
                                                                                    Boolean
                                                                                )
                                                                    }
                                                                );
                                                            }}
                                                            placeholder="フリーレン, Frieren"
                                                        />
                                                    </label>
                                                </div>

                                                <label className="prompt-field compact-prompt">
                                                    <span>
                                                        Rule
                                                    </span>

                                                    <textarea
                                                        value={
                                                            character.rule
                                                        }
                                                        onChange={(event) => {
                                                            updateCharacter(
                                                                index,
                                                                {
                                                                    rule:
                                                                        event
                                                                            .target
                                                                            .value
                                                                }
                                                            );
                                                        }}
                                                        placeholder="Frieren xưng tôi. Fern gọi Frieren là sư phụ..."
                                                    />
                                                </label>

                                                <button
                                                    className="danger-text"
                                                    onClick={() => {
                                                        removeCharacter(
                                                            index
                                                        );
                                                    }}
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        )
                                    )}

                                    {!activeProfile.characters.length && (
                                        <div className="empty-inline">
                                            Chưa có Character Rule.
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="profile-subsection">
                                <div className="subsection-heading">
                                    <div>
                                        <h4>
                                            Glossary
                                        </h4>

                                        <p>
                                            Thuật ngữ bắt buộc để bản dịch
                                            nhất quán qua nhiều câu.
                                        </p>
                                    </div>

                                    <button
                                        className="secondary-action"
                                        onClick={addGlossary}
                                    >
                                        + Thuật ngữ
                                    </button>
                                </div>

                                <div className="rule-list">
                                    {activeProfile.glossary.map(
                                        (
                                            entry,
                                            index
                                        ) => (
                                            <div
                                                className="rule-card"
                                                key={
                                                    entry.id ??
                                                    `new-glossary-${index}`
                                                }
                                            >
                                                <div className="rule-grid glossary-grid">
                                                    <label className="control-field">
                                                        <span>
                                                            Ngôn ngữ nguồn
                                                        </span>

                                                        <select
                                                            value={
                                                                entry.sourceLanguage ||
                                                                "AUTO"
                                                            }
                                                            onChange={(event) => {
                                                                updateGlossary(
                                                                    index,
                                                                    {
                                                                        sourceLanguage:
                                                                            event.target.value as
                                                                                TranslationLanguage
                                                                    }
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
                                                        <span>
                                                            Ngôn ngữ đích
                                                        </span>

                                                        <select
                                                            value={
                                                                entry.targetLanguage ||
                                                                "VI"
                                                            }
                                                            onChange={(event) => {
                                                                updateGlossary(
                                                                    index,
                                                                    {
                                                                        targetLanguage:
                                                                            event.target.value as
                                                                                TargetTranslationLanguage
                                                                    }
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

                                                    <label className="control-field">
                                                        <span>
                                                            Từ nguồn
                                                        </span>

                                                        <input
                                                            value={
                                                                entry.source
                                                            }
                                                            onChange={(event) => {
                                                                updateGlossary(
                                                                    index,
                                                                    {
                                                                        source:
                                                                            event
                                                                                .target
                                                                                .value
                                                                    }
                                                                );
                                                            }}
                                                            placeholder="魔力"
                                                        />
                                                    </label>

                                                    <label className="control-field">
                                                        <span>
                                                            Dịch thành
                                                        </span>

                                                        <input
                                                            value={
                                                                entry.target
                                                            }
                                                            onChange={(event) => {
                                                                updateGlossary(
                                                                    index,
                                                                    {
                                                                        target:
                                                                            event
                                                                                .target
                                                                                .value
                                                                    }
                                                                );
                                                            }}
                                                            placeholder="Ma lực"
                                                        />
                                                    </label>

                                                    <label className="control-field">
                                                        <span>
                                                            Ghi chú
                                                        </span>

                                                        <input
                                                            value={
                                                                entry.note ??
                                                                ""
                                                            }
                                                            onChange={(event) => {
                                                                updateGlossary(
                                                                    index,
                                                                    {
                                                                        note:
                                                                            event
                                                                                .target
                                                                                .value
                                                                    }
                                                                );
                                                            }}
                                                            placeholder="Không dùng năng lượng ma thuật"
                                                        />
                                                    </label>
                                                </div>

                                                <button
                                                    className="danger-text"
                                                    onClick={() => {
                                                        removeGlossary(
                                                            index
                                                        );
                                                    }}
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        )
                                    )}

                                    {!activeProfile.glossary.length && (
                                        <div className="empty-inline">
                                            Chưa có thuật ngữ.
                                        </div>
                                    )}
                                </div>
                            </section>

                            {!activeProfile.defaultProfile && (
                                <div className="profile-delete-row">
                                    <button
                                        className="danger-outline"
                                        onClick={onDeleteProfile}
                                    >
                                        Xóa Profile
                                    </button>
                                </div>
                            )}

                            {profileMessage && (
                                <div className="notice info">
                                    {profileMessage}
                                </div>
                            )}
                        </>
                    )}
                </article>
            </section>
        </div>
    );
}

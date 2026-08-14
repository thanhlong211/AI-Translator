import {
    useMemo,
    useState
} from "react";

import type {
    TargetTranslationLanguage,
    TranslationLanguage,
    TranslationMemoryItem,
    TranslationMemoryStats,
    TranslationProfile
} from "../app/types";

import {
    sourceTranslationLanguages,
    targetTranslationLanguages,
    translationLanguageLabels
} from "../app/translationLanguages";

interface TranslationMemoryPageProps {
    items: TranslationMemoryItem[];
    stats: TranslationMemoryStats;
    profiles: TranslationProfile[];
    loading: boolean;
    message: string;
    query: string;
    profileFilter: "ALL" | number;
    sourceFilter: "ALL" | TranslationLanguage;
    targetFilter: "ALL" | TargetTranslationLanguage;
    page: number;
    totalPages: number;
    onQueryChange: (value: string) => void;
    onProfileFilterChange: (value: "ALL" | number) => void;
    onSourceFilterChange: (value: "ALL" | TranslationLanguage) => void;
    onTargetFilterChange: (value: "ALL" | TargetTranslationLanguage) => void;
    onSearch: () => void;
    onRefresh: () => void;
    onPageChange: (page: number) => void;
    onUpdate: (
        memoryId: number,
        correctedTranslation: string
    ) => Promise<void>;
    onDelete: (
        memory: TranslationMemoryItem
    ) => Promise<void>;
}

function formatDate(value?: string | null) {
    if (!value) {
        return "Chưa dùng";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString(
        "vi-VN",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

export function TranslationMemoryPage({
    items,
    stats,
    profiles,
    loading,
    message,
    query,
    profileFilter,
    sourceFilter,
    targetFilter,
    page,
    totalPages,
    onQueryChange,
    onProfileFilterChange,
    onSourceFilterChange,
    onTargetFilterChange,
    onSearch,
    onRefresh,
    onPageChange,
    onUpdate,
    onDelete
}: TranslationMemoryPageProps) {
    const [editingId, setEditingId] =
        useState<number | null>(null);

    const [draft, setDraft] =
        useState("");

    const [busyId, setBusyId] =
        useState<number | null>(null);

    const [deleteCandidateId, setDeleteCandidateId] =
        useState<number | null>(null);

    const profileNameById = useMemo(() => {
        return new Map(
            profiles.map(
                (profile) => [
                    profile.id,
                    profile.name
                ]
            )
        );
    }, [profiles]);

    function beginEdit(
        item: TranslationMemoryItem
    ) {
        setEditingId(item.id);
        setDraft(item.correctedTranslation);
        setDeleteCandidateId(null);
    }

    async function saveEdit(
        item: TranslationMemoryItem
    ) {
        const clean = draft.trim();

        if (
            !clean ||
            clean === item.correctedTranslation.trim()
        ) {
            setEditingId(null);
            setDraft("");
            return;
        }

        try {
            setBusyId(item.id);
            await onUpdate(item.id, clean);
            setEditingId(null);
            setDraft("");
        } finally {
            setBusyId(null);
        }
    }

    async function removeItem(
        item: TranslationMemoryItem
    ) {
        if (deleteCandidateId !== item.id) {
            setDeleteCandidateId(item.id);
            setEditingId(null);
            return;
        }

        try {
            setBusyId(item.id);
            await onDelete(item);
            setDeleteCandidateId(null);
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="page-stack vocabulary-page">
            <section className="page-intro-row vocabulary-intro">
                <div>
                    <span className="eyebrow violet">
                        PERSONAL TRANSLATION MEMORY
                    </span>

                    <h2>
                        Bộ nhớ dịch của bạn
                    </h2>

                    <p>
                        Các bản sửa bạn lưu sẽ được ưu tiên để bản dịch sau nhất quán hơn.
                    </p>
                </div>

                <div className="mini-stats vocabulary-stats">
                    <div>
                        <strong>{stats.totalItems}</strong>
                        <span>Bản ghi</span>
                    </div>

                    <div>
                        <strong>{stats.usedItems}</strong>
                        <span>Đã dùng lại</span>
                    </div>

                    <div>
                        <strong>{stats.totalHits}</strong>
                        <span>Lần đã tái sử dụng</span>
                    </div>
                </div>
            </section>

            <section className="vocabulary-toolbar translation-memory-toolbar">
                <form
                    className="vocabulary-search"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSearch();
                    }}
                >
                    <input
                        value={query}
                        onChange={(event) => {
                            onQueryChange(event.target.value);
                        }}
                        placeholder="Tìm câu nguồn hoặc bản dịch đã sửa..."
                    />

                    <button
                        className="primary-action"
                        type="submit"
                        disabled={loading}
                    >
                        Tìm
                    </button>
                </form>

                <label className="control-field vocabulary-filter">
                    <span>Profile</span>
                    <select
                        value={profileFilter}
                        onChange={(event) => {
                            const value = event.target.value;
                            onProfileFilterChange(
                                value === "ALL"
                                    ? "ALL"
                                    : Number(value)
                            );
                        }}
                    >
                        <option value="ALL">Tất cả</option>
                        {profiles.map((profile) => (
                            <option
                                key={profile.id}
                                value={profile.id}
                            >
                                {profile.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="control-field vocabulary-filter">
                    <span>Nguồn</span>
                    <select
                        value={sourceFilter}
                        onChange={(event) => {
                            onSourceFilterChange(
                                event.target.value as
                                    | "ALL"
                                    | TranslationLanguage
                            );
                        }}
                    >
                        <option value="ALL">Tất cả</option>
                        {sourceTranslationLanguages.map((language) => (
                            <option key={language} value={language}>
                                {translationLanguageLabels[language]}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="control-field vocabulary-filter">
                    <span>Đích</span>
                    <select
                        value={targetFilter}
                        onChange={(event) => {
                            onTargetFilterChange(
                                event.target.value as
                                    | "ALL"
                                    | TargetTranslationLanguage
                            );
                        }}
                    >
                        <option value="ALL">Tất cả</option>
                        {targetTranslationLanguages.map((language) => (
                            <option key={language} value={language}>
                                {translationLanguageLabels[language]}
                            </option>
                        ))}
                    </select>
                </label>

                <button
                    className="secondary-action"
                    onClick={onRefresh}
                    disabled={loading}
                >
                    {loading ? "Đang tải..." : "Làm mới"}
                </button>
            </section>

            {message && (
                <div className="notice info">
                    {message}
                </div>
            )}

            {!items.length && !loading ? (
                <section className="empty-state-card">
                    <div className="empty-kanji">記憶</div>
                    <h3>Chưa có Translation Memory</h3>
                    <p>
                        Dịch một câu, sửa kết quả rồi bấm “Lưu bản sửa”.
                        Bản sửa sẽ xuất hiện ở đây.
                    </p>
                </section>
            ) : (
                <section className="grammar-library-grid">
                    {items.map((item) => {
                        const editing = editingId === item.id;
                        const deleting = deleteCandidateId === item.id;
                        const busy = busyId === item.id;

                        return (
                            <article
                                className="grammar-library-card"
                                key={item.id}
                            >
                                <div className="grammar-library-head">
                                    <div>
                                        <strong>
                                            {translationLanguageLabels[
                                                item.sourceLanguage
                                            ]}
                                            {" → "}
                                            {translationLanguageLabels[
                                                item.targetLanguage
                                            ]}
                                        </strong>

                                        <small>
                                            {profileNameById.get(item.profileId) ||
                                                `Hồ sơ #${item.profileId}`}
                                        </small>
                                    </div>

                                    <span className="language-pill">
                                        {item.hitCount} lần dùng
                                    </span>
                                </div>

                                <div className="memory-text-section">
                                    <span className="eyebrow">SOURCE</span>
                                    <div className="memory-text-block source">
                                        {item.sourceText}
                                    </div>
                                </div>

                                <div className="memory-text-section">
                                    <span className="eyebrow violet">
                                        YOUR TRANSLATION
                                    </span>

                                    {editing ? (
                                        <textarea
                                            className="memory-translation-editor"
                                            value={draft}
                                            onChange={(event) => {
                                                setDraft(event.target.value);
                                            }}
                                            disabled={busy}
                                        />
                                    ) : (
                                        <div className="memory-text-block translation">
                                            {item.correctedTranslation}
                                        </div>
                                    )}
                                </div>

                                <div className="memory-card-footer">
                                    <span className="memory-meta">
                                        Cập nhật {formatDate(item.updatedAt)}
                                        {" · "}
                                        Dùng gần nhất {formatDate(item.lastUsedAt)}
                                    </span>

                                    <div className="profile-save-state">

                                    {editing ? (
                                        <>
                                            <button
                                                className="secondary-action"
                                                onClick={() => {
                                                    setEditingId(null);
                                                    setDraft("");
                                                }}
                                                disabled={busy}
                                            >
                                                Hủy
                                            </button>

                                            <button
                                                className="primary-action"
                                                onClick={() => {
                                                    void saveEdit(item);
                                                }}
                                                disabled={busy || !draft.trim()}
                                            >
                                                {busy ? "Đang lưu..." : "Lưu sửa"}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                className="secondary-action"
                                                onClick={() => beginEdit(item)}
                                                disabled={busy}
                                            >
                                                Sửa
                                            </button>

                                            <button
                                                className="danger-outline"
                                                onClick={() => {
                                                    void removeItem(item);
                                                }}
                                                disabled={busy}
                                            >
                                                {busy
                                                    ? "Đang xóa..."
                                                    : deleting
                                                        ? "Bấm lần nữa để xóa"
                                                        : "Xóa"}
                                            </button>
                                        </>
                                    )}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </section>
            )}

            {totalPages > 1 && (
                <section className="memory-pagination">
                    <button
                        className="secondary-action"
                        onClick={() => onPageChange(page - 1)}
                        disabled={loading || page <= 0}
                    >
                        ← Trang trước
                    </button>

                    <span>
                        Trang {page + 1} / {totalPages}
                    </span>

                    <button
                        className="secondary-action"
                        onClick={() => onPageChange(page + 1)}
                        disabled={
                            loading ||
                            page + 1 >= totalPages
                        }
                    >
                        Trang sau →
                    </button>
                </section>
            )}
        </div>
    );
}

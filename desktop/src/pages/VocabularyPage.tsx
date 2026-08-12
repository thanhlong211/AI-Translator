import {
    useState
} from "react";

import type {
    VocabularyItem,
    VocabularyStats,
    VocabularyStatus
} from "../app/types";

interface VocabularyPageProps {
    items: VocabularyItem[];
    stats: VocabularyStats;
    loading: boolean;
    message: string;
    query: string;
    statusFilter:
        "ALL" | VocabularyStatus;
    favoriteOnly: boolean;
    onQueryChange:
        (value: string) => void;
    onStatusFilterChange:
        (
            value:
                "ALL" |
                VocabularyStatus
        ) => void;
    onFavoriteOnlyChange:
        (value: boolean) => void;
    onSearch: () => void;
    onRefresh: () => void;
    onUpdate:
        (
            vocabularyId: number,
            patch: {
                status?: VocabularyStatus;
                favorite?: boolean;
                personalNote?: string;
            }
        ) => Promise<void>;
    onDelete:
        (
            vocabularyId: number
        ) => Promise<void>;
}

const statusLabels:
    Record<VocabularyStatus, string> = {
        NEW: "Mới",
        LEARNING: "Đang học",
        KNOWN: "Đã thuộc"
    };

function formatDate(
    value: string
) {
    if (!value) {
        return "";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return date.toLocaleDateString(
        "vi-VN"
    );
}

export function VocabularyPage({
    items,
    stats,
    loading,
    message,
    query,
    statusFilter,
    favoriteOnly,
    onQueryChange,
    onStatusFilterChange,
    onFavoriteOnlyChange,
    onSearch,
    onRefresh,
    onUpdate,
    onDelete
}: VocabularyPageProps) {
    const [
        deleteCandidateId,
        setDeleteCandidateId
    ] = useState<number | null>(
        null
    );

    const [
        updatingId,
        setUpdatingId
    ] = useState<number | null>(
        null
    );

    async function updateItem(
        vocabularyId: number,
        patch: {
            status?: VocabularyStatus;
            favorite?: boolean;
            personalNote?: string;
        }
    ) {
        try {
            setUpdatingId(
                vocabularyId
            );

            await onUpdate(
                vocabularyId,
                patch
            );
        } finally {
            setUpdatingId(
                null
            );
        }
    }

    async function deleteItem(
        vocabularyId: number
    ) {
        if (
            deleteCandidateId !==
            vocabularyId
        ) {
            setDeleteCandidateId(
                vocabularyId
            );

            return;
        }

        try {
            setUpdatingId(
                vocabularyId
            );

            await onDelete(
                vocabularyId
            );

            setDeleteCandidateId(
                null
            );
        } finally {
            setUpdatingId(
                null
            );
        }
    }

    return (
        <div className="page-stack vocabulary-page">
            <section className="page-intro-row vocabulary-intro">
                <div>
                    <span className="eyebrow">
                        PERSONAL LIBRARY
                    </span>

                    <h2>
                        Từ vựng của tôi
                    </h2>

                    <p>
                        Kho từ riêng của tài khoản.
                        Từ được chống trùng, đếm số lần gặp
                        và theo dõi tiến độ NEW / LEARNING / KNOWN.
                    </p>
                </div>

                <div className="mini-stats vocabulary-stats">
                    <div>
                        <strong>
                            {stats.total}
                        </strong>
                        <span>
                            Tổng từ
                        </span>
                    </div>

                    <div>
                        <strong>
                            {stats.newCount}
                        </strong>
                        <span>
                            Mới
                        </span>
                    </div>

                    <div>
                        <strong>
                            {stats.learningCount}
                        </strong>
                        <span>
                            Đang học
                        </span>
                    </div>

                    <div>
                        <strong>
                            {stats.knownCount}
                        </strong>
                        <span>
                            Đã thuộc
                        </span>
                    </div>

                    <div>
                        <strong>
                            {stats.favoriteCount}
                        </strong>
                        <span>
                            Yêu thích
                        </span>
                    </div>
                </div>
            </section>

            <section className="vocabulary-toolbar">
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
                            onQueryChange(
                                event.target.value
                            );
                        }}
                        placeholder="Tìm Kanji, Hiragana, Romaji hoặc nghĩa..."
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
                    <span>
                        Trạng thái
                    </span>

                    <select
                        value={
                            statusFilter
                        }
                        onChange={(event) => {
                            onStatusFilterChange(
                                event.target
                                    .value as
                                    "ALL" |
                                    VocabularyStatus
                            );
                        }}
                    >
                        <option value="ALL">
                            Tất cả
                        </option>

                        <option value="NEW">
                            Mới
                        </option>

                        <option value="LEARNING">
                            Đang học
                        </option>

                        <option value="KNOWN">
                            Đã thuộc
                        </option>
                    </select>
                </label>

                <label className="favorite-filter">
                    <input
                        type="checkbox"
                        checked={
                            favoriteOnly
                        }
                        onChange={(event) => {
                            onFavoriteOnlyChange(
                                event.target.checked
                            );
                        }}
                    />

                    <span>
                        ★ Chỉ yêu thích
                    </span>
                </label>

                <button
                    className="secondary-action"
                    onClick={onRefresh}
                    disabled={loading}
                >
                    {loading
                        ? "Đang tải..."
                        : "Làm mới"}
                </button>
            </section>

            {message && (
                <div className="notice info">
                    {message}
                </div>
            )}

            {!items.length &&
                !loading ? (
                <section className="empty-state-card">
                    <div className="empty-kanji">
                        単語
                    </div>

                    <h3>
                        Chưa có từ phù hợp
                    </h3>

                    <p>
                        Bật “Tự động lưu từ mới” trong Study Mode
                        hoặc bấm “+ Lưu” trên một từ trong câu phân tích.
                    </p>
                </section>
            ) : (
                <section className="vocabulary-list-card">
                    <div className="vocabulary-list-header">
                        <span>
                            Từ
                        </span>
                        <span>
                            Cách đọc
                        </span>
                        <span>
                            Nghĩa
                        </span>
                        <span>
                            Tiến độ
                        </span>
                        <span>
                            Gặp
                        </span>
                        <span>
                            Thao tác
                        </span>
                    </div>

                    <div className="vocabulary-list">
                        {items.map(
                            (item) => (
                                <article
                                    className="vocabulary-library-row"
                                    key={item.id}
                                >
                                    <div className="library-word">
                                        <div className="library-word-title">
                                            <strong>
                                                {
                                                    item.dictionaryForm
                                                }
                                            </strong>

                                            {item.jlptLevel &&
                                                item.jlptLevel !==
                                                    "UNKNOWN" && (
                                                <span className="jlpt-badge">
                                                    {
                                                        item.jlptLevel
                                                    }
                                                </span>
                                            )}
                                        </div>

                                        {item.surface &&
                                            item.surface !==
                                                item.dictionaryForm && (
                                            <small>
                                                Trong câu:
                                                {" "}
                                                {
                                                    item.surface
                                                }
                                            </small>
                                        )}

                                        <span className="last-seen">
                                            Gặp gần nhất:
                                            {" "}
                                            {
                                                formatDate(
                                                    item.lastSeenAt
                                                )
                                            }
                                        </span>
                                    </div>

                                    <div className="library-reading">
                                        <strong>
                                            {
                                                item.reading ||
                                                "—"
                                            }
                                        </strong>

                                        <span>
                                            {
                                                item.romaji ||
                                                ""
                                            }
                                        </span>
                                    </div>

                                    <div className="library-meaning">
                                        <strong>
                                            {
                                                item.meaning ||
                                                "Chưa có nghĩa"
                                            }
                                        </strong>

                                        <span>
                                            {
                                                item.partOfSpeech ||
                                                ""
                                            }
                                        </span>
                                    </div>

                                    <label className="library-status">
                                        <select
                                            value={
                                                item.status
                                            }
                                            disabled={
                                                updatingId ===
                                                item.id
                                            }
                                            onChange={(event) => {
                                                void updateItem(
                                                    item.id,
                                                    {
                                                        status:
                                                            event.target
                                                                .value as
                                                                VocabularyStatus
                                                    }
                                                );
                                            }}
                                        >
                                            {(
                                                Object.keys(
                                                    statusLabels
                                                ) as
                                                    VocabularyStatus[]
                                            ).map(
                                                (status) => (
                                                    <option
                                                        key={
                                                            status
                                                        }
                                                        value={
                                                            status
                                                        }
                                                    >
                                                        {
                                                            statusLabels[
                                                                status
                                                            ]
                                                        }
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </label>

                                    <div className="encounter-count">
                                        <strong>
                                            {
                                                item.encounterCount
                                            }
                                        </strong>

                                        <span>
                                            lần
                                        </span>
                                    </div>

                                    <div className="library-actions">
                                        <button
                                            className={
                                                item.favorite
                                                    ? "favorite-button active"
                                                    : "favorite-button"
                                            }
                                            title={
                                                item.favorite
                                                    ? "Bỏ yêu thích"
                                                    : "Yêu thích"
                                            }
                                            disabled={
                                                updatingId ===
                                                item.id
                                            }
                                            onClick={() => {
                                                void updateItem(
                                                    item.id,
                                                    {
                                                        favorite:
                                                            !item.favorite
                                                    }
                                                );
                                            }}
                                        >
                                            ★
                                        </button>

                                        <button
                                            className={
                                                deleteCandidateId ===
                                                item.id
                                                    ? "danger-outline compact confirm-delete"
                                                    : "danger-outline compact"
                                            }
                                            disabled={
                                                updatingId ===
                                                item.id
                                            }
                                            onClick={() => {
                                                void deleteItem(
                                                    item.id
                                                );
                                            }}
                                        >
                                            {deleteCandidateId ===
                                            item.id
                                                ? "Xác nhận"
                                                : "Xóa"}
                                        </button>
                                    </div>

                                    <label className="library-note">
                                        <span>
                                            Ghi chú cá nhân
                                        </span>

                                        <input
                                            key={`${item.id}-${item.updatedAt}`}
                                            defaultValue={
                                                item.personalNote ||
                                                ""
                                            }
                                            placeholder="Ví dụ: Hay nhầm với 行う..."
                                            onBlur={(event) => {
                                                const next =
                                                    event.target
                                                        .value
                                                        .trim();

                                                const current =
                                                    (
                                                        item.personalNote ||
                                                        ""
                                                    )
                                                        .trim();

                                                if (
                                                    next ===
                                                    current
                                                ) {
                                                    return;
                                                }

                                                void updateItem(
                                                    item.id,
                                                    {
                                                        personalNote:
                                                            next
                                                    }
                                                );
                                            }}
                                        />
                                    </label>
                                </article>
                            )
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}

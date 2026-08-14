import {
    useState
} from "react";

import type {
    GrammarItem,
    GrammarStats,
    GrammarStatus
} from "../app/types";

interface GrammarPageProps {
    items: GrammarItem[];
    stats: GrammarStats;
    loading: boolean;
    message: string;
    query: string;
    statusFilter:
        "ALL" | GrammarStatus;
    favoriteOnly: boolean;
    onQueryChange:
        (value: string) => void;
    onStatusFilterChange:
        (
            value:
                "ALL" |
                GrammarStatus
        ) => void;
    onFavoriteOnlyChange:
        (value: boolean) => void;
    onSearch: () => void;
    onRefresh: () => void;
    onUpdate:
        (
            grammarId: number,
            patch: {
                status?: GrammarStatus;
                favorite?: boolean;
                personalNote?: string;
            }
        ) => Promise<void>;
    onDelete:
        (
            grammarId: number
        ) => Promise<void>;
}

const statusLabels:
    Record<GrammarStatus, string> = {
        NEW: "Mới",
        LEARNING: "Đang học",
        KNOWN: "Đã thuộc"
    };

export function GrammarPage({
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
}: GrammarPageProps) {
    const [
        updatingId,
        setUpdatingId
    ] = useState<number | null>(
        null
    );

    const [
        deleteCandidateId,
        setDeleteCandidateId
    ] = useState<number | null>(
        null
    );

    async function updateItem(
        grammarId: number,
        patch: {
            status?: GrammarStatus;
            favorite?: boolean;
            personalNote?: string;
        }
    ) {
        try {
            setUpdatingId(
                grammarId
            );

            await onUpdate(
                grammarId,
                patch
            );
        } finally {
            setUpdatingId(
                null
            );
        }
    }

    async function deleteItem(
        grammarId: number
    ) {
        if (
            deleteCandidateId !==
            grammarId
        ) {
            setDeleteCandidateId(
                grammarId
            );
            return;
        }

        try {
            setUpdatingId(
                grammarId
            );

            await onDelete(
                grammarId
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
        <div className="page-stack grammar-library-page">
            <section className="page-intro-row">
                <div>
                    <span className="eyebrow">
                        GRAMMAR LIBRARY
                    </span>

                    <h2>
                        Cấu trúc / Ngữ pháp của tôi
                    </h2>

                    <p>
                        Lưu các mẫu ngữ pháp bạn gặp để theo dõi và ôn lại.
                    </p>
                </div>

                <div className="mini-stats">
                    <div>
                        <strong>
                            {stats.total}
                        </strong>
                        <span>Tổng</span>
                    </div>

                    <div>
                        <strong>
                            {stats.newCount}
                        </strong>
                        <span>Mới</span>
                    </div>

                    <div>
                        <strong>
                            {stats.learningCount}
                        </strong>
                        <span>Đang học</span>
                    </div>

                    <div>
                        <strong>
                            {stats.knownCount}
                        </strong>
                        <span>Đã thuộc</span>
                    </div>

                    <div>
                        <strong>
                            {stats.favoriteCount}
                        </strong>
                        <span>★</span>
                    </div>
                </div>
            </section>

            <section className="vocabulary-toolbar grammar-toolbar">
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
                        placeholder="Tìm pattern hoặc ý nghĩa..."
                    />

                    <button
                        className="primary-action"
                        type="submit"
                        disabled={loading}
                    >
                        Tìm
                    </button>
                </form>

                <label className="control-field">
                    <span>Trạng thái</span>

                    <select
                        value={statusFilter}
                        onChange={(event) => {
                            onStatusFilterChange(
                                event.target.value as
                                    "ALL" |
                                    GrammarStatus
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
                        checked={favoriteOnly}
                        onChange={(event) => {
                            onFavoriteOnlyChange(
                                event.target.checked
                            );
                        }}
                    />
                    <span>★ Chỉ yêu thích</span>
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
                        文法
                    </div>

                    <h3>
                        Chưa có cấu trúc đã lưu
                    </h3>

                    <p>
                        Bật “Tự động lưu ngữ pháp” trong Study
                        hoặc bấm “+ Lưu” trên thẻ ngữ pháp.
                    </p>
                </section>
            ) : (
                <section className="grammar-library-grid">
                    {items.map(
                        (item) => (
                            <article
                                className="grammar-library-card"
                                key={item.id}
                            >
                                <div className="grammar-library-head">
                                    <div>
                                        <strong>
                                            {item.pattern}
                                        </strong>

                                        {item.meaning && (
                                            <span>
                                                {item.meaning}
                                            </span>
                                        )}
                                    </div>

                                    <div className="grammar-library-badges">
                                        {item.jlptLevel !==
                                            "UNKNOWN" && (
                                            <span className="jlpt-badge">
                                                {
                                                    item.jlptLevel
                                                }
                                            </span>
                                        )}

                                        <button
                                            className={
                                                item.favorite
                                                    ? "favorite-button active"
                                                    : "favorite-button"
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
                                    </div>
                                </div>

                                {item.explanation && (
                                    <p className="grammar-library-explanation">
                                        {item.explanation}
                                    </p>
                                )}

                                <div className="grammar-library-meta">
                                    <label>
                                        <span>
                                            Tiến độ
                                        </span>

                                        <select
                                            value={item.status}
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
                                                                GrammarStatus
                                                    }
                                                );
                                            }}
                                        >
                                            {(
                                                Object.keys(
                                                    statusLabels
                                                ) as GrammarStatus[]
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

                                    <div className="grammar-encounter">
                                        <span>
                                            Đã gặp
                                        </span>
                                        <strong>
                                            {
                                                item.encounterCount
                                            }
                                            {" "}lần
                                        </strong>
                                    </div>
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
                                        placeholder="Mẹo nhớ, cách chia, điểm hay nhầm..."
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
                                        ? "Xác nhận xóa"
                                        : "Xóa"}
                                </button>
                            </article>
                        )
                    )}
                </section>
            )}
        </div>
    );
}

import type {
    LearningDashboard,
    LearningWeakItem,
    StudyLanguage
} from "../app/types";

import {
    LearningLanguageTabs
} from "../components/LearningLanguageTabs";

interface HistoryPageProps {
    language: StudyLanguage;

    onLanguageChange:
        (language: StudyLanguage) => void;

    dashboard: LearningDashboard;
    loading: boolean;
    message: string;
    onRefresh: () => void;
    onOpenReview: () => void;
}

function shortDate(
    value: string
) {
    const date =
        new Date(
            `${value}T00:00:00`
        );

    return date.toLocaleDateString(
        "vi-VN",
        {
            day: "2-digit",
            month: "2-digit"
        }
    );
}

function timeLabel(
    value: string
) {
    const date =
        new Date(value);

    return date.toLocaleString(
        "vi-VN",
        {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

function masteryLabel(
    value:
        LearningWeakItem["masteryLevel"]
) {
    switch (value) {
        case "NEW":
            return "Mới";
        case "WEAK":
            return "Yếu";
        case "LEARNING":
            return "Đang học";
        case "FAMILIAR":
            return "Khá thuộc";
        case "MASTERED":
            return "Đã thuộc";
    }
}

export function HistoryPage({
    language,
    onLanguageChange,
    dashboard,
    loading,
    message,
    onRefresh,
    onOpenReview
}: HistoryPageProps) {
    const maxReviewed =
        Math.max(
            1,
            ...dashboard.dailyActivity
                .map(
                    (day) =>
                        day.reviewed
                )
        );

    return (
        <div className="page-stack learning-dashboard-page">
            <LearningLanguageTabs
                value={language}
                disabled={loading}
                onChange={
                    onLanguageChange
                }
            />

            <section className="page-intro-row learning-dashboard-intro">
                <div>
                    <span className="eyebrow violet">
                        LEARNING DASHBOARD
                    </span>

                    <h2>
                        Tiến độ học của bạn
                    </h2>

                    <p>
                        Theo dõi tiến độ ôn tập gần đây.
                    </p>
                </div>

                <div className="dashboard-actions">
                    <button
                        className="secondary-action"
                        onClick={onRefresh}
                        disabled={loading}
                    >
                        {loading
                            ? "Đang tải..."
                            : "Làm mới"}
                    </button>

                    <button
                        className="primary-action"
                        onClick={onOpenReview}
                    >
                        Ôn tập ngay
                    </button>
                </div>
            </section>

            {message && (
                <div className="notice info">
                    {message}
                </div>
            )}

            <section className="learning-overview-grid">
                <article className="learning-overview-card primary">
                    <span>
                        Accuracy 14 ngày
                    </span>

                    <strong>
                        {dashboard.overview.accuracy14Days}%
                    </strong>

                    <small>
                        {dashboard.overview.correct14Days}
                        {" "}đúng ·{" "}
                        {dashboard.overview.wrong14Days}
                        {" "}sai
                    </small>
                </article>

                <article className="learning-overview-card">
                    <span>
                        Đã ôn
                    </span>

                    <strong>
                        {dashboard.overview.reviewed14Days}
                    </strong>

                    <small>
                        lượt trong 14 ngày
                    </small>
                </article>

                <article className="learning-overview-card">
                    <span>
                        Chuỗi học
                    </span>

                    <strong>
                        {dashboard.overview.currentStreakDays}
                    </strong>

                    <small>
                        ngày liên tiếp
                    </small>
                </article>

                <article className="learning-overview-card">
                    <span>
                        Ngày hoạt động
                    </span>

                    <strong>
                        {dashboard.overview.activeDays14Days}
                        /14
                    </strong>

                    <small>
                        có ít nhất 1 lượt ôn
                    </small>
                </article>

                <article className="learning-overview-card warning">
                    <span>
                        Item yếu
                    </span>

                    <strong>
                        {dashboard.overview.weakItems}
                    </strong>

                    <small>
                        đang cần ưu tiên
                    </small>
                </article>

                <article className="learning-overview-card success">
                    <span>
                        Đã thuộc
                    </span>

                    <strong>
                        {dashboard.overview.masteredItems}
                    </strong>

                    <small>
                        đã thuộc hoàn toàn
                    </small>
                </article>
            </section>

            <section className="learning-panel">
                <div className="learning-panel-heading">
                    <div>
                        <span className="eyebrow">
                            LAST 14 DAYS
                        </span>

                        <h3>
                            Hoạt động ôn tập
                        </h3>
                    </div>

                    <div className="learning-chart-legend">
                        <span>
                            <i className="legend-correct" />
                            Đúng
                        </span>

                        <span>
                            <i className="legend-wrong" />
                            Sai
                        </span>
                    </div>
                </div>

                <div className="learning-activity-chart">
                    {dashboard.dailyActivity.map(
                        (day) => {
                            const totalHeight =
                                Math.max(
                                    5,
                                    Math.round(
                                        (
                                            day.reviewed /
                                            maxReviewed
                                        )
                                        *
                                        120
                                    )
                                );

                            const correctRatio =
                                day.reviewed > 0
                                    ? day.correct /
                                      day.reviewed
                                    : 0;

                            const correctHeight =
                                Math.round(
                                    totalHeight *
                                    correctRatio
                                );

                            const wrongHeight =
                                totalHeight -
                                correctHeight;

                            return (
                                <div
                                    className="learning-day-column"
                                    key={day.date}
                                    title={`${day.reviewed} lượt · ${day.accuracyPercent}%`}
                                >
                                    <div className="learning-day-value">
                                        {day.reviewed || ""}
                                    </div>

                                    <div
                                        className="learning-day-bar"
                                        style={{
                                            height:
                                                `${totalHeight}px`
                                        }}
                                    >
                                        <div
                                            className="learning-day-bar-wrong"
                                            style={{
                                                height:
                                                    `${wrongHeight}px`
                                            }}
                                        />

                                        <div
                                            className="learning-day-bar-correct"
                                            style={{
                                                height:
                                                    `${correctHeight}px`
                                            }}
                                        />
                                    </div>

                                    <span>
                                        {shortDate(
                                            day.date
                                        )}
                                    </span>
                                </div>
                            );
                        }
                    )}
                </div>
            </section>

            <section className="learning-two-column">
                <div className="learning-panel">
                    <div className="learning-panel-heading">
                        <div>
                            <span className="eyebrow danger">
                                PRIORITY
                            </span>

                            <h3>
                                Cần ôn thêm
                            </h3>
                        </div>

                        <button
                            className="text-action"
                            onClick={onOpenReview}
                        >
                            Mở ôn tập
                        </button>
                    </div>

                    {!dashboard.weakItems.length ? (
                        <div className="learning-empty-inline">
                            Chưa có mục nào cần ưu tiên ôn thêm.
                        </div>
                    ) : (
                        <div className="weak-item-list">
                            {dashboard.weakItems.map(
                                (item) => (
                                    <article
                                        className="weak-item-row"
                                        key={`${item.itemType}-${item.itemId}`}
                                    >
                                        <div className="weak-item-type">
                                            {language === "EN"
                                                ? item.itemType ===
                                                  "VOCABULARY"
                                                    ? "VOC"
                                                    : "GR"
                                                : item.itemType ===
                                                  "VOCABULARY"
                                                    ? "語"
                                                    : "文"}
                                        </div>

                                        <div className="weak-item-main">
                                            <strong>
                                                {
                                                    item.primaryText
                                                }
                                            </strong>

                                            <span>
                                                {item.answer ||
                                                    "Chưa có nghĩa"}
                                            </span>

                                            <small>
                                                {(
                                                    language === "EN"
                                                        ? item.cefrLevel
                                                        : item.jlptLevel
                                                ) &&
                                                (
                                                    language === "EN"
                                                        ? item.cefrLevel
                                                        : item.jlptLevel
                                                ) !== "UNKNOWN"
                                                    ? (
                                                        <>
                                                            {
                                                                language === "EN"
                                                                    ? item.cefrLevel
                                                                    : item.jlptLevel
                                                            }
                                                            {" "}·{" "}
                                                        </>
                                                    )
                                                    : null}

                                                {
                                                    masteryLabel(
                                                        item.masteryLevel
                                                    )
                                                }

                                                {" "}·{" "}
                                                đúng{" "}
                                                {item.correctCount}
                                                {" "}· sai{" "}
                                                {item.wrongCount}
                                            </small>
                                        </div>

                                        <div className="weak-item-score">
                                            <strong>
                                                {
                                                    item.accuracyPercent
                                                }%
                                            </strong>

                                            <span>
                                                chính xác
                                            </span>
                                        </div>
                                    </article>
                                )
                            )}
                        </div>
                    )}
                </div>

                <div className="learning-panel">
                    <div className="learning-panel-heading">
                        <div>
                            <span className="eyebrow">
                                RECENT
                            </span>

                            <h3>
                                Lượt ôn gần đây
                            </h3>
                        </div>
                    </div>

                    {!dashboard.recentReviews.length ? (
                        <div className="learning-empty-inline">
                            Chưa có review trắc nghiệm.
                        </div>
                    ) : (
                        <div className="recent-review-list">
                            {dashboard.recentReviews.map(
                                (event) => (
                                    <article
                                        className="recent-review-row"
                                        key={event.eventId}
                                    >
                                        <span
                                            className={
                                                event.correct
                                                    ? "recent-review-result correct"
                                                    : "recent-review-result wrong"
                                            }
                                        >
                                            {event.correct
                                                ? "✓"
                                                : "×"}
                                        </span>

                                        <div className="recent-review-main">
                                            <strong>
                                                {
                                                    event.primaryText
                                                }
                                            </strong>

                                            <span>
                                                {event.itemType ===
                                                "VOCABULARY"
                                                    ? "Từ vựng"
                                                    : "Ngữ pháp"}
                                                {" "}·{" "}
                                                {
                                                    event.automaticGrade
                                                }
                                            </span>
                                        </div>

                                        <div className="recent-review-time">
                                            <span>
                                                {timeLabel(
                                                    event.reviewedAt
                                                )}
                                            </span>

                                            {event.responseTimeMs != null && (
                                                <small>
                                                    {(
                                                        event.responseTimeMs /
                                                        1000
                                                    ).toFixed(1)}
                                                    s
                                                </small>
                                            )}
                                        </div>
                                    </article>
                                )
                            )}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

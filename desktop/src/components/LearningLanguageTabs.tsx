import type {
    StudyLanguage
} from "../app/types";

interface LearningLanguageTabsProps {
    value: StudyLanguage;
    disabled?: boolean;
    onChange:
        (language: StudyLanguage) => void;
}

export function LearningLanguageTabs({
    value,
    disabled = false,
    onChange
}: LearningLanguageTabsProps) {
    return (
        <div
            className="review-mode-actions"
            role="tablist"
            aria-label="Ngôn ngữ học"
        >
            <button
                type="button"
                role="tab"
                aria-selected={
                    value === "JA"
                }
                className={
                    value === "JA"
                        ? "review-mode-button active"
                        : "review-mode-button"
                }
                disabled={disabled}
                onClick={() => {
                    onChange("JA");
                }}
            >
                🇯🇵 Tiếng Nhật
            </button>

            <button
                type="button"
                role="tab"
                aria-selected={
                    value === "EN"
                }
                className={
                    value === "EN"
                        ? "review-mode-button active"
                        : "review-mode-button"
                }
                disabled={disabled}
                onClick={() => {
                    onChange("EN");
                }}
            >
                🇬🇧 English
            </button>
        </div>
    );
}

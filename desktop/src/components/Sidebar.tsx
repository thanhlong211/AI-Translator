import type { PageId } from "../app/types";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";

interface SidebarProps {
    activePage: PageId;
    onChange: (page: PageId) => void;
}

const mainItems: Array<{
    id: PageId;
    labelKey: string;
    descriptionKey: string;
}> = [
    { id: "translate", labelKey: "sidebar.translate", descriptionKey: "sidebar.translateDescription" },
    { id: "novel", labelKey: "sidebar.novel", descriptionKey: "sidebar.novelDescription" },
    { id: "study", labelKey: "sidebar.study", descriptionKey: "sidebar.studyDescription" },
    { id: "vocabulary", labelKey: "sidebar.vocabulary", descriptionKey: "sidebar.vocabularyDescription" },
    { id: "grammar", labelKey: "sidebar.grammar", descriptionKey: "sidebar.grammarDescription" },
    { id: "review", labelKey: "sidebar.review", descriptionKey: "sidebar.reviewDescription" },
    { id: "profiles", labelKey: "sidebar.profiles", descriptionKey: "sidebar.profilesDescription" },
    { id: "memory", labelKey: "sidebar.memory", descriptionKey: "sidebar.memoryDescription" },
    { id: "history", labelKey: "sidebar.history", descriptionKey: "sidebar.historyDescription" }
];

export function Sidebar({
    activePage,
    onChange
}: SidebarProps) {
    const { t } = useI18n();

    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand-mark" aria-hidden="true">
                    <span>A</span>
                </div>

                <div className="brand-copy">
                    <strong>AI Translator</strong>
                    <span>Desktop</span>
                </div>
            </div>

            <nav className="side-nav">
                <div className="nav-section-label">
                    {t("sidebar.workspace")}
                </div>

                {mainItems.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        title={t(item.labelKey)}
                        aria-current={activePage === item.id ? "page" : undefined}
                        className={
                            activePage === item.id
                                ? "nav-item active"
                                : "nav-item"
                        }
                        onClick={() => onChange(item.id)}
                    >
                        <span className="nav-icon">
                            <Icon name={item.id} />
                        </span>

                        <span className="nav-copy">
                            <strong>{t(item.labelKey)}</strong>
                            <small>{t(item.descriptionKey)}</small>
                        </span>
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <button
                    type="button"
                    title={t("sidebar.settings")}
                    aria-current={activePage === "settings" ? "page" : undefined}
                    className={
                        activePage === "settings"
                            ? "nav-item active"
                            : "nav-item"
                    }
                    onClick={() => onChange("settings")}
                >
                    <span className="nav-icon">
                        <Icon name="settings" />
                    </span>

                    <span className="nav-copy">
                        <strong>{t("sidebar.settings")}</strong>
                        <small>{t("sidebar.settingsDescription")}</small>
                    </span>
                </button>
            </div>
        </aside>
    );
}

import type {
    AuthStatus,
    BackendStatus,
    PageId
} from "../app/types";

import { useI18n } from "../i18n";
import { Icon } from "./Icon";

interface TopbarProps {
    activePage: PageId;
    backend: BackendStatus;
    auth: AuthStatus;
    onOpenSettings: () => void;
}

const pageTitleKeys: Record<
    PageId,
    { title: string; subtitle: string }
> = {
    translate: {
        title: "topbar.translate.title",
        subtitle: "topbar.translate.subtitle"
    },
    novel: {
        title: "topbar.novel.title",
        subtitle: "topbar.novel.subtitle"
    },
    study: {
        title: "topbar.study.title",
        subtitle: "topbar.study.subtitle"
    },
    vocabulary: {
        title: "topbar.vocabulary.title",
        subtitle: "topbar.vocabulary.subtitle"
    },
    grammar: {
        title: "topbar.grammar.title",
        subtitle: "topbar.grammar.subtitle"
    },
    review: {
        title: "topbar.review.title",
        subtitle: "topbar.review.subtitle"
    },
    profiles: {
        title: "topbar.profiles.title",
        subtitle: "topbar.profiles.subtitle"
    },
    memory: {
        title: "topbar.memory.title",
        subtitle: "topbar.memory.subtitle"
    },
    history: {
        title: "topbar.history.title",
        subtitle: "topbar.history.subtitle"
    },
    settings: {
        title: "topbar.settings.title",
        subtitle: "topbar.settings.subtitle"
    }
};

export function Topbar({
    activePage,
    backend,
    auth,
    onOpenSettings
}: TopbarProps) {
    const { t } = useI18n();
    const current = pageTitleKeys[activePage];

    return (
        <header className="topbar">
            <div>
                <h1>{t(current.title)}</h1>
                <p>{t(current.subtitle)}</p>
            </div>

            <div className="topbar-actions">
                <div
                    className={
                        backend.connected
                            ? "connection-pill online"
                            : "connection-pill"
                    }
                >
                    <span className="status-dot" />
                    <Icon name="server" size={16} />
                    {backend.connected
                        ? t("topbar.backendOnline")
                        : t("topbar.backendOffline")}
                </div>

                <button
                    type="button"
                    className="account-button"
                    onClick={onOpenSettings}
                    aria-label={
                        auth.authenticated
                            ? auth.user?.email || t("topbar.signedIn")
                            : t("topbar.openAccount")
                    }
                    title={
                        auth.authenticated
                            ? auth.user?.email || t("topbar.signedIn")
                            : t("topbar.openAccount")
                    }
                >
                    <span className="account-avatar">
                        {auth.authenticated && auth.user?.email
                            ? auth.user.email.slice(0, 1).toUpperCase()
                            : <Icon name="user" size={17} />}
                    </span>

                    <span className="account-copy">
                        <strong>
                            {auth.authenticated
                                ? auth.user?.email
                                : t("topbar.notSignedIn")}
                        </strong>

                        <small>
                            {auth.authenticated
                                ? t("topbar.signedIn")
                                : t("topbar.openAccount")}
                        </small>
                    </span>

                    <span className="account-chevron" aria-hidden="true">›</span>
                </button>
            </div>
        </header>
    );
}

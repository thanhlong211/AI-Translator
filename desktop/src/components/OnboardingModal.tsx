import type {
    ShortcutSettings
} from "../app/types";
import { useI18n } from "../i18n";

interface OnboardingModalProps {
    open: boolean;
    replay: boolean;
    shortcuts: ShortcutSettings;
    onComplete: () => void;
}

export function OnboardingModal({
    open,
    replay,
    shortcuts,
    onComplete
}: OnboardingModalProps) {
    const { t } = useI18n();

    if (!open) {
        return null;
    }

    return (
        <div className="onboarding-backdrop">
            <section
                className="onboarding-modal"
                role="dialog"
                aria-modal="true"
                aria-label={t("onboarding.aria")}
            >
                <div className="onboarding-badge">
                    AI TRANSLATOR
                </div>

                <h2>
                    {t("onboarding.title")}
                </h2>

                <p className="onboarding-lead">
                    {t("onboarding.lead")}
                </p>

                <div className="onboarding-steps">
                    <article>
                        <span>1</span>

                        <div>
                            <strong>
                                {t("onboarding.step1.title")}
                            </strong>

                            <p>
                                {t("onboarding.step1.body")}
                            </p>
                        </div>
                    </article>

                    <article>
                        <span>2</span>

                        <div>
                            <strong>
                                {t("onboarding.step2.title")}
                            </strong>

                            <p>
                                {t("onboarding.step2.before")}
                                {" "}
                                <kbd>
                                    {shortcuts.panelDisplay}
                                </kbd>
                                {" "}
                                {t("onboarding.step2.after")}
                            </p>
                        </div>
                    </article>

                    <article>
                        <span>3</span>

                        <div>
                            <strong>
                                {t("onboarding.step3.title")}
                            </strong>

                            <p>
                                {t("onboarding.step3.before")}
                                {" "}
                                <kbd>
                                    {shortcuts.panelNextDisplay}
                                </kbd>
                                {" "}
                                {t("onboarding.step3.after")}
                            </p>
                        </div>
                    </article>

                    <article>
                        <span>4</span>

                        <div>
                            <strong>
                                {t("onboarding.step4.title")}
                            </strong>

                            <p>
                                {t("onboarding.step4.before")}
                                {" "}
                                <kbd>
                                    {shortcuts.translateDisplay}
                                </kbd>
                                {" "}
                                {t("onboarding.step4.after")}
                            </p>
                        </div>
                    </article>

                    <article>
                        <span>5</span>

                        <div>
                            <strong>
                                {t("onboarding.step5.title")}
                            </strong>

                            <p>
                                {t("onboarding.step5.before")}
                                {" "}
                                <kbd>
                                    {shortcuts.studyDisplay}
                                </kbd>
                                {" "}
                                {t("onboarding.step5.after")}
                            </p>
                        </div>
                    </article>
                </div>

                <div className="onboarding-note">
                    {t("onboarding.note")}
                </div>

                <button
                    className="primary-action onboarding-start"
                    onClick={onComplete}
                >
                    {replay
                        ? t("onboarding.close")
                        : t("onboarding.start")}
                </button>
            </section>
        </div>
    );
}

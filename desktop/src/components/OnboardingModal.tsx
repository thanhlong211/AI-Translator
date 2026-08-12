import type {
    ShortcutSettings
} from "../app/types";

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
    if (!open) {
        return null;
    }

    return (
        <div className="onboarding-backdrop">
            <section
                className="onboarding-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Hướng dẫn bắt đầu"
            >
                <div className="onboarding-badge">
                    AI TRANSLATOR
                </div>

                <h2>
                    Bắt đầu trong 5 bước
                </h2>

                <p className="onboarding-lead">
                    Đăng nhập, chọn Translation Profile,
                    sau đó dùng phím tắt ở bất kỳ trang đọc truyện nào.
                </p>

                <div className="onboarding-steps">
                    <article>
                        <span>1</span>

                        <div>
                            <strong>
                                Đăng nhập và chọn Profile
                            </strong>

                            <p>
                                Profile quyết định phong cách dịch,
                                glossary và quy tắc nhân vật.
                            </p>
                        </div>
                    </article>

                    <article>
                        <span>2</span>

                        <div>
                            <strong>
                                Quét khung truyện
                            </strong>

                            <p>
                                Nhấn
                                {" "}
                                <kbd>
                                    {shortcuts.panelDisplay}
                                </kbd>
                                {" "}
                                rồi kéo chọn một khung manga hoặc vùng
                                chứa nhiều bubble để dịch cùng lúc.
                            </p>
                        </div>
                    </article>

                    <article>
                        <span>3</span>

                        <div>
                            <strong>
                                Sang trang manga tiếp theo
                            </strong>

                            <p>
                                Sau khi chuyển trang, nhấn
                                {" "}
                                <kbd>
                                    {shortcuts.panelNextDisplay}
                                </kbd>
                                {" "}
                                để quét lại đúng vùng cũ và giữ context
                                hội thoại của Manga Session.
                            </p>
                        </div>
                    </article>

                    <article>
                        <span>4</span>

                        <div>
                            <strong>
                                Dịch nhanh
                            </strong>

                            <p>
                                Nhấn
                                {" "}
                                <kbd>
                                    {shortcuts.translateDisplay}
                                </kbd>
                                {" "}
                                rồi kéo một vùng chữ cần dịch.
                            </p>
                        </div>
                    </article>

                    <article>
                        <span>5</span>

                        <div>
                            <strong>
                                Study
                            </strong>

                            <p>
                                Nhấn
                                {" "}
                                <kbd>
                                    {shortcuts.studyDisplay}
                                </kbd>
                                {" "}
                                để vừa dịch nhanh vừa phân tích
                                từ vựng/ngữ pháp ở background.
                            </p>
                        </div>
                    </article>
                </div>

                <div className="onboarding-note">
                    Overlay mặc định tự ẩn khi đổi cửa sổ/tab.
                    Có thể Pin hoặc đổi hành vi trong Settings.
                </div>

                <button
                    className="primary-action onboarding-start"
                    onClick={onComplete}
                >
                    {replay
                        ? "Đóng hướng dẫn"
                        : "Bắt đầu sử dụng"}
                </button>
            </section>
        </div>
    );
}

import type {
    AuthStatus,
    BackendStatus,
    PageId
} from "../app/types";

import { Icon } from "./Icon";

interface TopbarProps {
    activePage: PageId;
    backend: BackendStatus;
    auth: AuthStatus;
    onOpenSettings: () => void;
}

const pageTitles: Record<
    PageId,
    { title: string; subtitle: string }
> = {
    translate: {
        title: "Dịch màn hình",
        subtitle: "OCR local, AI translation qua Java backend"
    },
    novel: {
        title: "Novel Reader TXT",
        subtitle: "Đọc song ngữ + Context + Translation Memory"
    },
    study: {
        title: "Chế độ học",
        subtitle: "Dịch và phân tích tiếng Nhật theo ngữ cảnh"
    },
    vocabulary: {
        title: "Từ vựng của tôi",
        subtitle: "Kho từ cá nhân được xây từ nội dung bạn đọc"
    },
    grammar: {
        title: "Cấu trúc / Ngữ pháp",
        subtitle: "Kho pattern cá nhân, số lần gặp và tiến độ học"
    },
    review: {
        title: "Ôn tập SRS",
        subtitle: "Vocabulary + Grammar đến hạn trong một hàng đợi"
    },
    profiles: {
        title: "Translation Profiles",
        subtitle: "Phong cách, prompt, nhân vật và thuật ngữ"
    },
    memory: {
        title: "Bộ nhớ dịch",
        subtitle: "Xem và quản lý các bản sửa Translation Memory"
    },
    history: {
        title: "Lịch sử",
        subtitle: "Các phiên dịch và học gần đây"
    },
    settings: {
        title: "Cài đặt",
        subtitle: "Tài khoản, thiết bị và kết nối backend"
    }
};

export function Topbar({
    activePage,
    backend,
    auth,
    onOpenSettings
}: TopbarProps) {
    const current = pageTitles[activePage];

    return (
        <header className="topbar">
            <div>
                <h1>{current.title}</h1>
                <p>{current.subtitle}</p>
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
                        ? "Backend online"
                        : "Backend offline"}
                </div>

                <button
                    className="account-button"
                    onClick={onOpenSettings}
                >
                    <span className="account-avatar">
                        <Icon name="user" size={17} />
                    </span>

                    <span className="account-copy">
                        <strong>
                            {auth.authenticated
                                ? auth.user?.email
                                : "Chưa đăng nhập"}
                        </strong>

                        <small>
                            {auth.authenticated
                                ? auth.user?.role
                                : "Mở tài khoản"}
                        </small>
                    </span>
                </button>
            </div>
        </header>
    );
}

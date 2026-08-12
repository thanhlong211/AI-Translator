import type { PageId } from "../app/types";
import { Icon } from "./Icon";

interface SidebarProps {
    activePage: PageId;
    onChange: (page: PageId) => void;
}

const mainItems: Array<{
    id: PageId;
    label: string;
    description: string;
}> = [
    { id: "translate", label: "Dịch", description: "OCR & AI" },
    { id: "study", label: "Học tập", description: "Phân tích câu" },
    { id: "vocabulary", label: "Từ vựng", description: "Kho cá nhân" },
    { id: "grammar", label: "Ngữ pháp", description: "Cấu trúc đã lưu" },
    { id: "review", label: "Ôn tập", description: "SRS hôm nay" },
    { id: "profiles", label: "Profiles", description: "Prompt & Style" },
    { id: "memory", label: "Bộ nhớ dịch", description: "Bản sửa cá nhân" },
    { id: "history", label: "Lịch sử", description: "Phiên gần đây" }
];

export function Sidebar({
    activePage,
    onChange
}: SidebarProps) {
    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand-mark">A</div>

                <div className="brand-copy">
                    <strong>AI Translator</strong>
                    <span>Desktop</span>
                </div>
            </div>

            <nav className="side-nav">
                <div className="nav-section-label">
                    Workspace
                </div>

                {mainItems.map((item) => (
                    <button
                        key={item.id}
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
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                        </span>
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <button
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
                        <strong>Cài đặt</strong>
                        <small>Account & App</small>
                    </span>
                </button>
            </div>
        </aside>
    );
}

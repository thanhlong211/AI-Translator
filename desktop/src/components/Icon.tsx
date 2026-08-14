import type { PageId } from "../app/types";

interface IconProps {
    name:
        | PageId
        | "scan"
        | "user"
        | "server"
        | "copy"
        | "card"
        | "sliders"
        | "check"
        | "lock";
    size?: number;
}

export function Icon({ name, size = 20 }: IconProps) {
    const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const
    };

    switch (name) {
        case "translate":
            return (
                <svg {...common}>
                    <path d="M4 5h9" />
                    <path d="M8 3v2" />
                    <path d="M6 8c1.2 2.3 3.1 4.1 5.5 5.2" />
                    <path d="M11 8c-.8 2.2-2.5 4.2-5 5.8" />
                    <path d="M14 19l3.5-8 3.5 8" />
                    <path d="M15.2 16h4.6" />
                </svg>
            );
        case "novel":
            return (
                <svg {...common}>
                    <path d="M5 3.5h10a3 3 0 0 1 3 3V21H8a3 3 0 0 1-3-3z" />
                    <path d="M8 7h7" />
                    <path d="M8 11h7" />
                    <path d="M8 15h5" />
                    <path d="M5 18a3 3 0 0 1 3-3h10" />
                </svg>
            );
        case "study":
            return (
                <svg {...common}>
                    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22z" />
                    <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22z" />
                </svg>
            );
        case "vocabulary":
            return (
                <svg {...common}>
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M7 8h6" />
                    <path d="M7 12h10" />
                    <path d="M7 16h8" />
                </svg>
            );
        case "grammar":
            return (
                <svg {...common}>
                    <path d="M5 4h14v16H5z" />
                    <path d="M8 8h8" />
                    <path d="M8 12h5" />
                    <path d="M8 16h7" />
                    <path d="M16 12l2 2 3-4" />
                </svg>
            );
        case "review":
            return (
                <svg {...common}>
                    <path d="M6 7h12" />
                    <path d="M6 12h8" />
                    <path d="M6 17h6" />
                    <path d="M16 14v6" />
                    <path d="M13 17h6" />
                    <path d="M5 4h14v16H5z" />
                </svg>
            );
        case "profiles":
            return (
                <svg {...common}>
                    <path d="M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4z" />
                    <path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
                </svg>
            );
        case "memory":
            return (
                <svg {...common}>
                    <path d="M8 4h8a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" />
                    <path d="M9 8h6" />
                    <path d="M9 12h6" />
                    <path d="M9 16h4" />
                    <path d="M3 9h2" />
                    <path d="M3 15h2" />
                </svg>
            );
        case "history":
            return (
                <svg {...common}>
                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M12 7v5l3 2" />
                </svg>
            );
        case "settings":
            return (
                <svg {...common}>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.3 7 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21v4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                </svg>
            );
        case "scan":
            return (
                <svg {...common}>
                    <path d="M4 8V5a1 1 0 0 1 1-1h3" />
                    <path d="M16 4h3a1 1 0 0 1 1 1v3" />
                    <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
                    <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
                    <path d="M7 12h10" />
                </svg>
            );
        case "user":
            return (
                <svg {...common}>
                    <circle cx="12" cy="8" r="3" />
                    <path d="M5 20c.8-4 3.2-6 7-6s6.2 2 7 6" />
                </svg>
            );
        case "server":
            return (
                <svg {...common}>
                    <rect x="4" y="4" width="16" height="6" rx="2" />
                    <rect x="4" y="14" width="16" height="6" rx="2" />
                    <path d="M8 7h.01" />
                    <path d="M8 17h.01" />
                </svg>
            );
        case "copy":
            return (
                <svg {...common}>
                    <rect x="8" y="8" width="11" height="11" rx="2" />
                    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                </svg>
            );
        case "card":
            return (
                <svg {...common}>
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <path d="M3 9h18" />
                    <path d="M7 15h4" />
                </svg>
            );
        case "sliders":
            return (
                <svg {...common}>
                    <path d="M4 6h7" />
                    <path d="M15 6h5" />
                    <circle cx="13" cy="6" r="2" />
                    <path d="M4 12h3" />
                    <path d="M11 12h9" />
                    <circle cx="9" cy="12" r="2" />
                    <path d="M4 18h9" />
                    <path d="M17 18h3" />
                    <circle cx="15" cy="18" r="2" />
                </svg>
            );
        case "check":
            return (
                <svg {...common}>
                    <path d="m5 12 4 4L19 6" />
                </svg>
            );
        case "lock":
            return (
                <svg {...common}>
                    <rect x="5" y="10" width="14" height="10" rx="2.5" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    <path d="M12 14v2" />
                </svg>
            );
        default:
            return null;
    }
}

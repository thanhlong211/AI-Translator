import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState
} from "react";

import type {
    PropsWithChildren
} from "react";

export type UiThemePreference = "system" | "light" | "dark";
export type ResolvedUiTheme = "light" | "dark";

interface ThemeContextValue {
    theme: UiThemePreference;
    resolvedTheme: ResolvedUiTheme;
    setTheme: (theme: UiThemePreference) => void;
}

const STORAGE_KEY = "aiTranslator.ui.theme.v1";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): UiThemePreference {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") {
            return stored;
        }
    } catch {
        // localStorage can be unavailable in hardened/private renderer contexts.
    }

    return "system";
}

function readSystemTheme(): ResolvedUiTheme {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return "light";
    }

    return window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
}

export function ThemeProvider({ children }: PropsWithChildren) {
    const [theme, setThemeState] = useState<UiThemePreference>(readStoredTheme);
    const [systemTheme, setSystemTheme] = useState<ResolvedUiTheme>(readSystemTheme);

    const resolvedTheme: ResolvedUiTheme =
        theme === "system" ? systemTheme : theme;

    useEffect(() => {
        if (typeof window.matchMedia !== "function") {
            return;
        }

        const media = window.matchMedia(DARK_MEDIA_QUERY);
        const onChange = (event: MediaQueryListEvent) => {
            setSystemTheme(event.matches ? "dark" : "light");
        };

        setSystemTheme(media.matches ? "dark" : "light");
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.dataset.theme = resolvedTheme;
        root.dataset.themePreference = theme;
        root.style.colorScheme = resolvedTheme;

        try {
            window.localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // Preference still works for the current session.
        }
    }, [theme, resolvedTheme]);

    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key !== STORAGE_KEY) {
                return;
            }

            if (event.newValue === "light" || event.newValue === "dark" || event.newValue === "system") {
                setThemeState(event.newValue);
            }
        };

        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const value = useMemo<ThemeContextValue>(() => ({
        theme,
        resolvedTheme,
        setTheme: setThemeState
    }), [theme, resolvedTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used inside ThemeProvider.");
    }
    return context;
}

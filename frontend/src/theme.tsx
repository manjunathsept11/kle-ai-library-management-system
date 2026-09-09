import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";
const KEY = "kle.theme";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      set: setTheme,
      toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    }),
    [theme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}

/* ---------------------------------------------------------------- Toasts */

export interface ToastItem {
  id: number;
  message: string;
  tone: "ok" | "err" | "info";
}
interface ToastCtx {
  push: (message: string, tone?: ToastItem["tone"]) => void;
}
const TCtx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback(
    (message: string, tone: ToastItem["tone"] = "info") => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { id, message, tone }]);
      setTimeout(
        () => setItems((xs) => xs.filter((x) => x.id !== id)),
        tone === "err" ? 6000 : 3800,
      );
    },
    [],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <TCtx.Provider value={value}>
      {children}
      <div className="toast-host">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            <span>
              {t.tone === "ok" ? "✓" : t.tone === "err" ? "⚠" : "ℹ"}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </TCtx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(TCtx);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}

"use client";

import { useRouter } from "next/navigation";
import { Settings, X } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { ACCENT_COOKIE, ACCENTS, THEME_COOKIE, THEMES, type Accent, type Theme } from "@/lib/look";

type LookState = { theme: Theme; accent: Accent; setTheme: (t: Theme) => void; setAccent: (a: Accent) => void };
const LookContext = createContext<LookState | null>(null);

// Kept on this device for a year; the server reads it to render the right colours.
function remember(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

// Wraps the child's screen in the Midnight look with their chosen theme and accent.
export function Look({
  theme: initialTheme,
  accent: initialAccent,
  className = "",
  children,
}: {
  theme: Theme;
  accent: Accent;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [theme, setThemeState] = useState(initialTheme);
  const [accent, setAccentState] = useState(initialAccent);
  const setTheme = (t: Theme) => {
    setThemeState(t);
    remember(THEME_COOKIE, t);
    router.refresh(); // re-renders the status bar colour
  };
  const setAccent = (a: Accent) => {
    setAccentState(a);
    remember(ACCENT_COOKIE, a);
  };

  return (
    <LookContext value={{ theme, accent, setTheme, setAccent }}>
      <div
        data-theme={theme}
        style={{ "--acc": ACCENTS[accent] } as React.CSSProperties}
        className={`midnight ${className}`}
      >
        {children}
      </div>
    </LookContext>
  );
}

const THEME_LABELS: Record<Theme, string> = { auto: "Auto", light: "Light", dark: "Dark" };

// A gear button that opens the "Your look" sheet: theme and accent colour.
export function LookButton() {
  const look = useContext(LookContext)!;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Your look"
        className="grid size-9 shrink-0 place-items-center rounded-full border border-(--mn-line) bg-(--mn-card) text-(--mn-muted) active:scale-95"
      >
        <Settings className="size-4.5" strokeWidth={2} aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-label="Your look"
            onClick={(e) => e.stopPropagation()}
            className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-t-3xl border border-b-0 border-(--mn-line) bg-(--mn-card) px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            <header className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Your look</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid size-8 place-items-center rounded-full text-(--mn-muted)"
              >
                <X className="size-5" aria-hidden />
              </button>
            </header>
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-widest text-(--mn-muted) uppercase">Theme</h3>
              <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 rounded-full border border-(--mn-line) p-0.5">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    role="radio"
                    aria-checked={look.theme === t}
                    onClick={() => look.setTheme(t)}
                    className={`rounded-full py-2 text-sm font-semibold ${
                      look.theme === t ? "bg-(--mn-ink) text-(--mn-bg)" : "text-(--mn-muted)"
                    }`}
                  >
                    {THEME_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-widest text-(--mn-muted) uppercase">Colour</h3>
              <div role="radiogroup" aria-label="Colour" className="flex gap-3">
                {(Object.keys(ACCENTS) as Accent[]).map((a) => (
                  <button
                    key={a}
                    role="radio"
                    aria-checked={look.accent === a}
                    aria-label={a}
                    onClick={() => look.setAccent(a)}
                    style={{ background: ACCENTS[a] }}
                    className={`size-10 rounded-full ${
                      look.accent === a ? "ring-2 ring-(--mn-ink) ring-offset-3 ring-offset-(--mn-card)" : ""
                    }`}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

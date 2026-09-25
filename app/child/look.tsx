"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
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

// The "Your look" card at the bottom of the screen.
export function LookPicker() {
  const look = useContext(LookContext)!;
  return (
    <section className="mx-4 mt-8 flex flex-col gap-3 rounded-[20px] border border-(--mn-line) bg-(--mn-card) p-4">
      <h2 className="text-sm font-semibold text-(--mn-muted)">Your look</h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Theme" className="flex rounded-full border border-(--mn-line) p-0.5">
          {THEMES.map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={look.theme === t}
              onClick={() => look.setTheme(t)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                look.theme === t ? "bg-(--mn-ink) text-(--mn-bg)" : "text-(--mn-muted)"
              }`}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Colour" className="flex gap-1.5">
          {(Object.keys(ACCENTS) as Accent[]).map((a) => (
            <button
              key={a}
              role="radio"
              aria-checked={look.accent === a}
              aria-label={a}
              onClick={() => look.setAccent(a)}
              style={{ background: ACCENTS[a] }}
              className={`size-7 rounded-full ${
                look.accent === a ? "ring-2 ring-(--mn-ink) ring-offset-2 ring-offset-(--mn-card)" : ""
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

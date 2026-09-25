// The child's "Midnight" look: a theme and an accent the teen picks on their own
// device. Both live in cookies so the server renders the right colours first time.

export const THEMES = ["auto", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

// Light enough to read on the dark background; the light theme darkens them for text.
export const ACCENTS = {
  gold: "#FFC54D",
  sky: "#7DD3FC",
  pink: "#F472B6",
  lime: "#A3E635",
  lavender: "#C4B5FD",
} as const;
export type Accent = keyof typeof ACCENTS;

export const THEME_COOKIE = "gw-theme";
export const ACCENT_COOKIE = "gw-accent";

export function parseTheme(value: string | undefined): Theme {
  return THEMES.find((t) => t === value) ?? "auto";
}

export function parseAccent(value: string | undefined): Accent {
  return value && value in ACCENTS ? (value as Accent) : "gold";
}

const BACKGROUND = { dark: "#0A0E1C", light: "#EEF0F7" };

// The browser's theme-color (the iPhone's status bar) for the child's screen.
export function themeColor(theme: Theme) {
  if (theme !== "auto") return BACKGROUND[theme];
  return [
    { media: "(prefers-color-scheme: light)", color: BACKGROUND.light },
    { media: "(prefers-color-scheme: dark)", color: BACKGROUND.dark },
  ];
}

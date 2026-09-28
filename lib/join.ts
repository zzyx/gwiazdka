// Getting a child's phone into Gwiazdki: add the app to the Home Screen, open
// it from there, and type the parent's Join code. The code must go in inside the
// installed app, because on iPhone Safari and the Home Screen app keep separate
// sign-ins: a code typed in Safari would sign in Safari and be used up.

export const CODE_LENGTH = 8;

// What the child typed or pasted, as the code itself: upper case, without
// spaces, dashes or anything else, at most 8 characters.
export function cleanCode(input: string) {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

// A cleaned code as it is shown: XXXX-XXXX once it's past the first four.
export function formatCode(code: string) {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export type Browser = "ios-safari" | "other";

// iPhone Safari gets step-by-step instructions; every other browser one line.
// Chrome, Firefox and Edge on iPhone name themselves in the user agent; an iPad
// asks for the desktop site, so it looks like a Mac with a touch screen.
export function detectBrowser(userAgent: string, maxTouchPoints = 0): Browser {
  const iPhoneOrIPad =
    /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  const otherApp = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent);
  return iPhoneOrIPad && /Safari/.test(userAgent) && !otherApp ? "ios-safari" : "other";
}

export type JoinScreen = "welcome" | "install-ios" | "install-other" | "code";

// Which screen a signed-out visitor sees. Inside the installed app it's always
// the code box, with no welcome; in a browser the code box never shows.
export function joinScreen(page: "home" | "join", installed: boolean, browser: Browser): JoinScreen {
  if (installed) return "code";
  if (page === "home") return "welcome";
  return browser === "ios-safari" ? "install-ios" : "install-other";
}

// "Works once · 14:59 left" on the parent's code sheet.
export function timeLeft(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

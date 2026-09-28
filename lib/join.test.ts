import { describe, expect, it } from "vitest";
import { cleanCode, detectBrowser, formatCode, joinScreen, timeLeft } from "./join";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";

describe("cleanCode", () => {
  it("ignores case, spaces and dashes", () => {
    expect(cleanCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(cleanCode(" ab cd  ef gh ")).toBe("ABCDEFGH");
    expect(cleanCode("AB–CD—EF·GH")).toBe("ABCDEFGH");
  });

  it("keeps at most eight characters", () => {
    expect(cleanCode("ABCD-EFGH-JK")).toBe("ABCDEFGH");
  });

  it("keeps a half-typed code", () => {
    expect(cleanCode("ab")).toBe("AB");
    expect(cleanCode("")).toBe("");
  });
});

describe("formatCode", () => {
  it("adds the dash once past the first four", () => {
    expect(formatCode("ABC")).toBe("ABC");
    expect(formatCode("ABCD")).toBe("ABCD");
    expect(formatCode("ABCDE")).toBe("ABCD-E");
    expect(formatCode("ABCDEFGH")).toBe("ABCD-EFGH");
  });

  it("round-trips a formatted code", () => {
    expect(formatCode(cleanCode(formatCode("ABCDEFGH")))).toBe("ABCD-EFGH");
  });
});

describe("detectBrowser", () => {
  it("knows iPhone Safari", () => {
    expect(detectBrowser(IPHONE_SAFARI)).toBe("ios-safari");
  });

  it("knows an iPad asking for the desktop site", () => {
    expect(detectBrowser(IPAD_DESKTOP, 5)).toBe("ios-safari");
    expect(detectBrowser(IPAD_DESKTOP, 0)).toBe("other");
  });

  it("treats other browsers as other", () => {
    expect(detectBrowser(IPHONE_CHROME)).toBe("other");
    expect(detectBrowser(ANDROID_CHROME)).toBe("other");
  });
});

describe("joinScreen", () => {
  it("goes straight to the code box in the installed app", () => {
    expect(joinScreen("home", true, "ios-safari")).toBe("code");
    expect(joinScreen("join", true, "ios-safari")).toBe("code");
    expect(joinScreen("join", true, "other")).toBe("code");
  });

  it("welcomes a visitor in the browser", () => {
    expect(joinScreen("home", false, "ios-safari")).toBe("welcome");
    expect(joinScreen("home", false, "other")).toBe("welcome");
  });

  it("never shows the code box in the browser", () => {
    expect(joinScreen("join", false, "ios-safari")).toBe("install-ios");
    expect(joinScreen("join", false, "other")).toBe("install-other");
  });
});

describe("timeLeft", () => {
  it("counts down in minutes and seconds", () => {
    expect(timeLeft(15 * 60_000)).toBe("15:00");
    expect(timeLeft(14 * 60_000 + 59_000)).toBe("14:59");
    expect(timeLeft(9_500)).toBe("0:10");
    expect(timeLeft(-1)).toBe("0:00");
  });
});

import { describe, expect, it } from "vitest";
import { parseAccent, parseTheme, themeColor } from "./look";

describe("parseTheme", () => {
  it("keeps a known theme", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });
  it("follows the phone when the cookie is missing or unknown", () => {
    expect(parseTheme(undefined)).toBe("auto");
    expect(parseTheme("pink")).toBe("auto");
  });
});

describe("parseAccent", () => {
  it("keeps a known accent", () => {
    expect(parseAccent("sky")).toBe("sky");
  });
  it("falls back to gold", () => {
    expect(parseAccent(undefined)).toBe("gold");
    expect(parseAccent("#ff0000")).toBe("gold");
  });
});

describe("themeColor", () => {
  it("is one colour for a fixed theme", () => {
    expect(themeColor("dark")).toBe("#0A0E1C");
    expect(themeColor("light")).toBe("#EEF0F7");
  });
  it("follows the phone on auto", () => {
    expect(themeColor("auto")).toEqual([
      { media: "(prefers-color-scheme: light)", color: "#EEF0F7" },
      { media: "(prefers-color-scheme: dark)", color: "#0A0E1C" },
    ]);
  });
});

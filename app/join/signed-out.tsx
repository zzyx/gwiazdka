import type { Viewport } from "next";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, themeColor } from "@/lib/look";
import { sora } from "../child/font";
import { Look } from "../child/look";
import { Onboarding } from "./onboarding";

// Before joining there's no accent of their own yet, so it's gold; the theme
// follows the phone unless this device picked one earlier.
async function theme() {
  const jar = await cookies();
  return parseTheme(jar.get(THEME_COOKIE)?.value);
}

export async function signedOutViewport(): Promise<Viewport> {
  return { themeColor: themeColor(await theme()) };
}

// The welcome, the Home Screen steps and the code box, in the Midnight look.
export async function SignedOut({ page }: { page: "home" | "join" }) {
  return (
    <Look theme={await theme()} accent="gold" className={`${sora.className} flex flex-1 flex-col`}>
      <Onboarding page={page} />
    </Look>
  );
}

import { cookies } from "next/headers";
import { loadBoard } from "@/lib/child-board";
import { CONTRACT_SEEN_COOKIE } from "@/lib/contract-seen";
import { RECAP_HIDDEN_COOKIE } from "@/lib/recap";
import { ACCENT_COOKIE, parseAccent, parseTheme, THEME_COOKIE } from "@/lib/look";
import { createClient } from "@/lib/supabase/server";
import type { Child } from "@/lib/viewer";
import { sora } from "./font";
import { KeepSignedIn } from "./keep-signed-in";
import { Look } from "./look";
import { TodayBoard } from "./today-board";

// The child's Today screen, in the "Midnight" look.
export async function ChildHome({ child, day }: { child: Child; day?: string }) {
  const supabase = await createClient();
  const [board, jar] = await Promise.all([loadBoard(supabase, child.id, day, new Date()), cookies()]);

  return (
    <Look
      theme={parseTheme(jar.get(THEME_COOKIE)?.value)}
      accent={parseAccent(jar.get(ACCENT_COOKIE)?.value)}
      className={`${sora.className} flex flex-1 flex-col`}
    >
      <KeepSignedIn />
      <TodayBoard
        name={child.name}
        board={board}
        contractNew={!!board.contractId && jar.get(CONTRACT_SEEN_COOKIE)?.value !== board.contractId}
        recapHidden={jar.get(RECAP_HIDDEN_COOKIE)?.value}
      />
    </Look>
  );
}

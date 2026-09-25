import { loadBoard } from "@/lib/child-board";
import { createClient } from "@/lib/supabase/server";
import type { Child } from "@/lib/viewer";
import { baloo } from "./font";
import { KeepSignedIn } from "./keep-signed-in";
import { TodayBoard } from "./today-board";

// The child's Today screen: the "Sticker board".
export async function ChildHome({ child, day }: { child: Child; day?: string }) {
  const supabase = await createClient();
  const board = await loadBoard(supabase, child.id, day, new Date());

  return (
    <div className={`${baloo.className} flex flex-1 flex-col bg-[#DCEFFF] text-[#1E2A5A]`}>
      <KeepSignedIn />
      <TodayBoard name={child.name} board={board} />
    </div>
  );
}

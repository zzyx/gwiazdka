"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Makes or undoes the child's Check-off of one Task on one day. The database
// decides whether that is still allowed.
export async function setCheckOff(taskId: string, day: string, done: boolean): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error, count } = done
    ? await supabase.from("check_offs").insert({ task_id: taskId, day }, { count: "exact" })
    : await supabase.from("check_offs").delete({ count: "exact" }).match({ task_id: taskId, day });
  revalidatePath("/");
  return { ok: !error && count === 1 };
}

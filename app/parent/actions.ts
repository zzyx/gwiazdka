"use server";

import { createClient } from "@/lib/supabase/server";

// Issues a single-use Join code for one of the parent's children, valid 15 minutes.
export async function issueJoinCode(childId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_join_code", { p_child_id: childId });
  if (error) throw error;
  return data as string;
}

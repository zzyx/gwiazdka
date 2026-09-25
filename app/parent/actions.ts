"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Issues a single-use Join code for one of the parent's children, valid 15 minutes.
export async function issueJoinCode(childId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_join_code", { p_child_id: childId });
  if (error) throw error;
  return data as string;
}

// Approves or rejects one Task on one day, or changes an earlier decision.
// Approving a Task the child didn't check off approves it straight away.
export async function decide(taskId: string, day: string, approved: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("approvals")
    .upsert({ task_id: taskId, day, approved, decided_at: new Date().toISOString() });
  revalidatePath("/", "layout");
  if (error) throw error;
}

// "Approve all": approves every waiting Check-off of one child's day.
export async function approveAll(taskIds: string[], day: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("approvals")
    .insert(taskIds.map((task_id) => ({ task_id, day, approved: true })));
  revalidatePath("/", "layout");
  if (error) throw error;
}

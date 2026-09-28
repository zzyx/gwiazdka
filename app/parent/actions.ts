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

// "All" and "All done this week" in the History: approves each of these Tasks
// on its day, unless it was decided meanwhile, so a rejection is never overturned.
export async function approveUndecided(cells: { taskId: string; day: string }[]) {
  const supabase = await createClient();
  const { error } = await supabase.from("approvals").upsert(
    cells.map(({ taskId, day }) => ({ task_id: taskId, day, approved: true })),
    { onConflict: "task_id,day", ignoreDuplicates: true },
  );
  revalidatePath("/", "layout");
  if (error) throw error;
}

// Grant or No bonus for one finished week of a child's open Contract, or a
// change of an earlier decision.
export async function decideWeeklyBonus(contractId: string, weekOf: string, granted: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_weekly_bonus", {
    p_contract_id: contractId,
    p_week_of: weekOf,
    p_granted: granted,
  });
  revalidatePath("/", "layout");
  if (error) throw error;
}

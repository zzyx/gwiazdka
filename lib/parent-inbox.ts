import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildChildInbox, type ChildInbox } from "./inbox";
import { warsawToday } from "./today";

export type ChildSection = { id: string; name: string; contractId: string | null; inbox: ChildInbox | null };

// Each of the parent's children with their Inbox, read with the parent's session (RLS).
// A child without an open Contract has no Inbox.
export async function loadInbox(supabase: SupabaseClient, now: Date): Promise<ChildSection[]> {
  const today = warsawToday(now);
  const [children, contracts, tasks, checkOffs, approvals, bonuses] = await Promise.all([
    supabase.from("children").select("id, name").order("name"),
    supabase
      .from("contracts")
      .select("id, child_id, starts_on, ends_on, grosze_per_star, weekly_bonus_stars")
      .is("closed_on", null),
    supabase.from("tasks").select("id, child_id, name, icon, position, active_from, active_until"),
    supabase.from("check_offs").select("task_id, day"),
    supabase.from("approvals").select("task_id, day, approved"),
    supabase.from("weekly_bonuses").select("contract_id, week_of, granted"),
  ]);
  for (const r of [children, contracts, tasks, checkOffs, approvals, bonuses]) if (r.error) throw r.error;

  return children.data!.map((child) => {
    const contract = contracts.data!.find((c) => c.child_id === child.id);
    if (!contract) return { ...child, contractId: null, inbox: null };
    const own = tasks.data!.filter((t) => t.child_id === child.id);
    const ids = new Set(own.map((t) => t.id));
    const inRange = (r: { task_id: string; day: string }) =>
      ids.has(r.task_id) && contract.starts_on <= r.day && r.day <= contract.ends_on;
    return {
      ...child,
      contractId: contract.id,
      inbox: buildChildInbox({
        today,
        contract,
        tasks: own,
        checkOffs: checkOffs.data!.filter(inRange),
        approvals: approvals.data!.filter(inRange),
        bonuses: bonuses.data!.filter((b) => b.contract_id === contract.id),
      }),
    };
  });
}

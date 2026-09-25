import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildChildInbox, type InboxDay } from "./inbox";
import { warsawToday } from "./today";

export type ListedTask = { id: string; name: string; icon: string };

export type OpenContract = {
  id: string;
  starts_on: string;
  ends_on: string;
  grosze_per_star: number;
  weekly_bonus_stars: number;
  stars: number;
  waiting: number;
  // Days with Check-offs still waiting for Approval, newest first.
  waitingDays: InboxDay[];
};

export type PastContract = {
  id: string;
  starts_on: string;
  ends_on: string;
  grosze_per_star: number;
  weekly_bonus_stars: number;
  payout: {
    paid_on: string;
    task_stars: number;
    bonus_stars: number;
    amount_grosze: number;
    not_counted: number;
    planned_ends_on: string;
  } | null;
};

export type ChildContracts = {
  id: string;
  name: string;
  // The child's current Task list, in order.
  tasks: ListedTask[];
  open: OpenContract | null;
  // Newest first.
  past: PastContract[];
};

// Each of the parent's children with their Contracts, read with the parent's session (RLS).
export async function loadContracts(supabase: SupabaseClient, now: Date): Promise<ChildContracts[]> {
  const today = warsawToday(now);
  const [children, contracts, payouts, tasks, checkOffs, approvals] = await Promise.all([
    supabase.from("children").select("id, name").order("name"),
    supabase
      .from("contracts")
      .select("id, child_id, starts_on, ends_on, grosze_per_star, weekly_bonus_stars, closed_on")
      .order("starts_on", { ascending: false }),
    supabase
      .from("payouts")
      .select("contract_id, paid_on, task_stars, bonus_stars, amount_grosze, not_counted, planned_ends_on"),
    supabase.from("tasks").select("id, child_id, name, icon, position, active_from, active_until"),
    supabase.from("check_offs").select("task_id, day"),
    supabase.from("approvals").select("task_id, day, approved"),
  ]);
  for (const r of [children, contracts, payouts, tasks, checkOffs, approvals]) if (r.error) throw r.error;

  return children.data!.map((child) => {
    const own = tasks.data!.filter((t) => t.child_id === child.id);
    const ids = new Set(own.map((t) => t.id));
    const mine = contracts.data!.filter((c) => c.child_id === child.id);
    const openRow = mine.find((c) => c.closed_on === null);

    let open: OpenContract | null = null;
    if (openRow) {
      const inRange = (r: { task_id: string; day: string }) =>
        ids.has(r.task_id) && openRow.starts_on <= r.day && r.day <= openRow.ends_on;
      const inbox = buildChildInbox({
        today,
        contract: openRow,
        tasks: own,
        checkOffs: checkOffs.data!.filter(inRange),
        approvals: approvals.data!.filter(inRange),
      });
      open = {
        id: openRow.id,
        starts_on: openRow.starts_on,
        ends_on: openRow.ends_on,
        grosze_per_star: openRow.grosze_per_star,
        weekly_bonus_stars: openRow.weekly_bonus_stars,
        stars: inbox.stars,
        waiting: inbox.waiting,
        waitingDays: inbox.waitingDays,
      };
    }

    return {
      id: child.id,
      name: child.name,
      tasks: own
        .filter((t) => t.active_until === null)
        .sort((a, b) => a.position - b.position)
        .map(({ id, name, icon }) => ({ id, name, icon })),
      open,
      past: mine
        .filter((c) => c.closed_on !== null)
        .map((c) => ({
          id: c.id,
          starts_on: c.starts_on,
          ends_on: c.ends_on,
          grosze_per_star: c.grosze_per_star,
          weekly_bonus_stars: c.weekly_bonus_stars,
          payout: payouts.data!.find((p) => p.contract_id === c.id) ?? null,
        })),
    };
  });
}

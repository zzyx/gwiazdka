import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { warsawToday } from "./today";

export type ChildContract = {
  today: string;
  // The open Contract, or null between Contracts.
  open: {
    id: string;
    starts_on: string;
    ends_on: string;
    grosze_per_star: number;
    weekly_bonus_stars: number;
    // Stars so far: from approved Tasks, and from granted Weekly bonuses.
    taskStars: number;
    bonusStars: number;
    // How many Tasks the child has on a School day now.
    tasksPerDay: number;
  } | null;
  // The newest Payout, shown when there is no open Contract.
  lastPayout: { ends_on: string; stars: number; amount_grosze: number } | null;
};

// Everything the child's "Your Contract" page shows, read with the child's own session (RLS).
export async function loadChildContract(
  supabase: SupabaseClient,
  childId: string,
  now: Date,
): Promise<ChildContract> {
  const today = warsawToday(now);
  const [contracts, balances, tasks, payouts] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, starts_on, ends_on, grosze_per_star, weekly_bonus_stars, closed_on")
      .eq("child_id", childId)
      .order("starts_on", { ascending: false }),
    supabase.from("star_balances").select("contract_id, task_stars, bonus_stars").eq("child_id", childId),
    supabase
      .from("tasks")
      .select("id")
      .eq("child_id", childId)
      .lte("active_from", today)
      .or(`active_until.is.null,active_until.gt.${today}`),
    supabase.from("payouts").select("contract_id, task_stars, bonus_stars, amount_grosze"),
  ]);
  for (const r of [contracts, balances, tasks, payouts]) if (r.error) throw r.error;

  const open = contracts.data!.find((c) => c.closed_on === null);
  const balance = open && balances.data!.find((b) => b.contract_id === open.id);
  const paid = contracts.data!.flatMap((c) => {
    const p = payouts.data!.find((p) => p.contract_id === c.id);
    return p ? [{ ends_on: c.ends_on as string, stars: p.task_stars + p.bonus_stars, amount_grosze: p.amount_grosze }] : [];
  });

  return {
    today,
    open: open
      ? {
          id: open.id,
          starts_on: open.starts_on,
          ends_on: open.ends_on,
          grosze_per_star: open.grosze_per_star,
          weekly_bonus_stars: open.weekly_bonus_stars,
          taskStars: balance?.task_stars ?? 0,
          bonusStars: balance?.bonus_stars ?? 0,
          tasksPerDay: tasks.data!.length,
        }
      : null,
    lastPayout: paid[0] ?? null,
  };
}

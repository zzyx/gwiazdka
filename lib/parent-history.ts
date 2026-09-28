import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dayPhotoPath, signDayPhotos, type DayPhoto, type DayPhotoRow } from "./day-photos";
import { buildHistoryWeek, type HistoryWeek } from "./history";
import { addDays, warsawToday } from "./today";

export type ChildHistory = {
  children: { id: string; name: string }[];
  child: { id: string; name: string };
  week: HistoryWeek;
  // The child's photos of the shown week, by day.
  photos: Record<string, DayPhoto>;
};

// One week of one child's History, read with the parent's session (RLS). Null
// when the parent has no children yet.
export async function loadHistory(
  supabase: SupabaseClient,
  now: Date,
  childId: string | undefined,
  week: string | undefined,
): Promise<ChildHistory | null> {
  const today = warsawToday(now);
  const children = await supabase.from("children").select("id, name").order("name");
  if (children.error) throw children.error;
  const child = children.data.find((c) => c.id === childId) ?? children.data[0];
  if (!child) return null;

  const [contracts, payouts, tasks] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, starts_on, ends_on, grosze_per_star, weekly_bonus_stars, closed_on")
      .eq("child_id", child.id),
    supabase.from("payouts").select("contract_id, paid_on"),
    supabase.from("tasks").select("id, name, icon, position, active_from, active_until").eq("child_id", child.id),
  ]);
  for (const r of [contracts, payouts, tasks]) if (r.error) throw r.error;
  const taskIds = tasks.data!.map((t) => t.id);
  const contractIds = contracts.data!.map((c) => c.id);

  const [checkOffs, approvals, bonuses] = await Promise.all([
    supabase.from("check_offs").select("task_id, day").in("task_id", taskIds),
    supabase.from("approvals").select("task_id, day, approved").in("task_id", taskIds),
    supabase.from("weekly_bonuses").select("contract_id, week_of, granted").in("contract_id", contractIds),
  ]);
  for (const r of [checkOffs, approvals, bonuses]) if (r.error) throw r.error;

  const built = buildHistoryWeek({
    today,
    week,
    contracts: contracts.data!.map((c) => ({
      ...c,
      paid_on: payouts.data!.find((p) => p.contract_id === c.id)?.paid_on ?? c.closed_on,
    })),
    tasks: tasks.data!,
    checkOffs: checkOffs.data!,
    approvals: approvals.data!,
    bonuses: bonuses.data!,
  });

  const photoRows = await supabase
    .from("day_photos")
    .select("child_id, day, added_at")
    .eq("child_id", child.id)
    .gte("day", built.monday)
    .lte("day", addDays(built.monday, 4));
  if (photoRows.error) throw photoRows.error;
  const signed = await signDayPhotos(supabase, photoRows.data as DayPhotoRow[]);
  const photos: Record<string, DayPhoto> = {};
  for (const r of photoRows.data) {
    const photo = signed.get(dayPhotoPath(child.id, r.day));
    if (photo) photos[r.day] = photo;
  }

  return { children: children.data, child, week: built, photos };
}

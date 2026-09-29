import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildChildBoard, type ChildBoard } from "./board";
import { dayPhotoPath, signDayPhotos, type DayPhoto, type DayPhotoRow } from "./day-photos";
import { warsawToday } from "./today";

export type ChildColumn = {
  id: string;
  name: string;
  contract: { id: string; starts_on: string } | null;
  // Null without an open Contract.
  board: ChildBoard | null;
  // The child's photos in the open Contract, by day.
  photos: Record<string, DayPhoto>;
};

// Each of the parent's children with the Board of their open Contract, read with
// the parent's session (RLS).
export async function loadBoard(supabase: SupabaseClient, now: Date): Promise<ChildColumn[]> {
  const today = warsawToday(now);
  const [children, contracts, tasks, checkOffs, approvals, bonuses, photoRows] = await Promise.all([
    supabase.from("children").select("id, name").order("name"),
    supabase
      .from("contracts")
      .select("id, child_id, starts_on, ends_on, grosze_per_star, weekly_bonus_stars")
      .is("closed_on", null),
    supabase.from("tasks").select("id, child_id, name, icon, position, active_from, active_until"),
    supabase.from("check_offs").select("task_id, day"),
    supabase.from("approvals").select("task_id, day, approved"),
    supabase.from("weekly_bonuses").select("contract_id, week_of, granted"),
    supabase.from("day_photos").select("child_id, day, added_at"),
  ]);
  for (const r of [children, contracts, tasks, checkOffs, approvals, bonuses, photoRows]) if (r.error) throw r.error;
  const signed = await signDayPhotos(supabase, photoRows.data as DayPhotoRow[]);

  return children.data!.map((child) => {
    const contract = contracts.data!.find((c) => c.child_id === child.id);
    if (!contract) return { ...child, contract: null, board: null, photos: {} };
    const own = tasks.data!.filter((t) => t.child_id === child.id);
    const ids = new Set(own.map((t) => t.id));
    const inRange = (r: { task_id: string; day: string }) =>
      ids.has(r.task_id) && contract.starts_on <= r.day && r.day <= contract.ends_on;
    const board = buildChildBoard({
      today,
      contract: { ...contract, closed_on: null, paid_on: null },
      tasks: own,
      checkOffs: checkOffs.data!.filter(inRange),
      approvals: approvals.data!.filter(inRange),
      bonuses: bonuses.data!,
    });
    const photos: Record<string, DayPhoto> = {};
    for (const r of photoRows.data as DayPhotoRow[]) {
      const photo = signed.get(dayPhotoPath(child.id, r.day));
      if (r.child_id === child.id && photo && contract.starts_on <= r.day && r.day <= contract.ends_on) photos[r.day] = photo;
    }
    return { ...child, contract: { id: contract.id, starts_on: contract.starts_on }, board, photos };
  });
}

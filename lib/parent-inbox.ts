import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dayPhotoPath, signDayPhotos, type DayPhotoRow } from "./day-photos";
import { buildChildInbox, type ChildInbox, type InboxDay } from "./inbox";
import { warsawToday } from "./today";

export type ChildSection = { id: string; name: string; contractId: string | null; inbox: ChildInbox | null };

// Each of the parent's children with their Inbox, read with the parent's session (RLS).
// A child without an open Contract has no Inbox.
export async function loadInbox(supabase: SupabaseClient, now: Date): Promise<ChildSection[]> {
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
  const photos = await signDayPhotos(supabase, photoRows.data as DayPhotoRow[]);

  return children.data!.map((child) => {
    const contract = contracts.data!.find((c) => c.child_id === child.id);
    if (!contract) return { ...child, contractId: null, inbox: null };
    const own = tasks.data!.filter((t) => t.child_id === child.id);
    const ids = new Set(own.map((t) => t.id));
    const inRange = (r: { task_id: string; day: string }) =>
      ids.has(r.task_id) && contract.starts_on <= r.day && r.day <= contract.ends_on;
    const inbox = buildChildInbox({
      today,
      contract,
      tasks: own,
      checkOffs: checkOffs.data!.filter(inRange),
      approvals: approvals.data!.filter(inRange),
      bonuses: bonuses.data!.filter((b) => b.contract_id === contract.id),
    });
    // Each day shows the child's photo of it, if there is one.
    const withPhoto = (d: InboxDay): InboxDay => ({ ...d, photo: photos.get(dayPhotoPath(child.id, d.day)) });
    return {
      ...child,
      contractId: contract.id,
      inbox: { ...inbox, waitingDays: inbox.waitingDays.map(withPhoto), otherDays: inbox.otherDays.map(withPhoto) },
    };
  });
}

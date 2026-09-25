import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canChildChange,
  isSchoolDay,
  schoolWeek,
  taskState,
  warsawToday,
  type TaskState,
} from "./today";

export type BoardTask = { id: string; name: string; icon: string; state: TaskState };

export type BoardDay = {
  day: string;
  stars: number;
  waiting: boolean;
  future: boolean;
};

export type Board = {
  today: string;
  // Null when the child has no open Contract: they see Today but can't check off.
  balance: { stars: number; groszePerStar: number } | null;
  week: BoardDay[];
  // The day shown under the week strip, or null for the weekend card.
  selected: { day: string; canChange: boolean; tasks: BoardTask[] } | null;
  // On a weekend: Friday, if it can still be changed, and how many of its Tasks are not done.
  openFriday: { day: string; left: number } | null;
};

type TaskRow = {
  id: string;
  name: string;
  icon: string;
  position: number;
  active_from: string;
  active_until: string | null;
};

const activeOn = (t: TaskRow, day: string) =>
  t.active_from <= day && (t.active_until === null || day < t.active_until);

// Everything the child's Today screen shows, read with the child's own session (RLS).
export async function loadBoard(
  supabase: SupabaseClient,
  childId: string,
  requestedDay: string | undefined,
  now: Date,
): Promise<Board> {
  const today = warsawToday(now);
  const week = schoolWeek(today);

  const [balances, contracts, tasks, checkOffs, approvals] = await Promise.all([
    supabase.from("star_balances").select("stars, grosze_per_star").eq("child_id", childId),
    supabase.from("contracts").select("starts_on, ends_on").eq("child_id", childId).is("closed_on", null),
    supabase.from("tasks").select("id, name, icon, position, active_from, active_until").eq("child_id", childId).order("position"),
    supabase.from("check_offs").select("task_id, day").gte("day", week[0]).lte("day", week[4]),
    supabase.from("approvals").select("task_id, day, approved").gte("day", week[0]).lte("day", week[4]),
  ]);
  for (const r of [balances, contracts, tasks, checkOffs, approvals]) if (r.error) throw r.error;

  const contract = contracts.data![0];
  const inContract = (day: string) =>
    !!contract && contract.starts_on <= day && day <= contract.ends_on;
  const checked = new Set(checkOffs.data!.map((c) => `${c.task_id}/${c.day}`));
  const decided = new Map(approvals.data!.map((a) => [`${a.task_id}/${a.day}`, a.approved as boolean]));

  const tasksOn = (day: string): BoardTask[] =>
    (tasks.data as TaskRow[])
      .filter((t) => activeOn(t, day))
      .map((t) => ({
        id: t.id,
        name: t.name,
        icon: t.icon,
        state: taskState(checked.has(`${t.id}/${day}`), decided.get(`${t.id}/${day}`)),
      }));

  const weekDays: BoardDay[] = week.map((day) => {
    const states = tasksOn(day).map((t) => t.state);
    return {
      day,
      stars: inContract(day) ? states.filter((s) => s === "approved").length : 0,
      waiting: states.includes("checked_off"),
      future: day > today,
    };
  });

  const shown =
    requestedDay && week.includes(requestedDay) && requestedDay <= today
      ? requestedDay
      : isSchoolDay(today)
        ? today
        : null;

  const friday = week[4];
  const openFriday =
    !isSchoolDay(today) && inContract(friday) && canChildChange(friday, now)
      ? { day: friday, left: tasksOn(friday).filter((t) => t.state === "not_done").length }
      : null;

  const balance = balances.data![0];
  return {
    today,
    balance: balance ? { stars: balance.stars, groszePerStar: balance.grosze_per_star } : null,
    week: weekDays,
    selected: shown
      ? { day: shown, canChange: inContract(shown) && canChildChange(shown, now), tasks: tasksOn(shown) }
      : null,
    openFriday,
  };
}

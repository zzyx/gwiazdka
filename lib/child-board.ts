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
import { mondayOf, shownDay, weekLinks } from "./weeks";

export type BoardTask = { id: string; name: string; icon: string; state: TaskState };

// The Contract a day falls in: the open one, one already paid out, or none.
export type DayContract = { paidOn: null } | { paidOn: string } | null;

export type BoardDay = {
  day: string;
  // How many Tasks the day has, and how many of them earned a Star.
  tasks: number;
  stars: number;
  waiting: boolean;
  future: boolean;
  inContract: boolean;
};

export type Board = {
  today: string;
  // The open Contract's id, or null when there is none.
  contractId: string | null;
  // Null when the child has no open Contract: they see Today but can't check off.
  balance: { stars: number; groszePerStar: number } | null;
  // The shown week, its Contract, and where the arrows lead (null = disabled).
  monday: string;
  contract: DayContract;
  prev: string | null;
  next: string | null;
  week: BoardDay[];
  // Stars from the shown week's Tasks, out of how many it could have earned so
  // far, and how many of its School days are in a Contract.
  total: { stars: number; max: number; contractDays: number };
  // The day shown under the week strip, or null for the weekend card.
  selected: { day: string; canChange: boolean; contract: DayContract; tasks: BoardTask[] } | null;
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

type ContractRow = { id: string; starts_on: string; ends_on: string; closed_on: string | null };

const activeOn = (t: TaskRow, day: string) =>
  t.active_from <= day && (t.active_until === null || day < t.active_until);

// Everything the child's Today screen shows for the requested day's week, read
// with the child's own session (RLS).
export async function loadBoard(
  supabase: SupabaseClient,
  childId: string,
  requestedDay: string | undefined,
  now: Date,
): Promise<Board> {
  const today = warsawToday(now);

  const [balances, contracts, payouts, tasks] = await Promise.all([
    supabase.from("star_balances").select("stars, grosze_per_star").eq("child_id", childId),
    supabase.from("contracts").select("id, starts_on, ends_on, closed_on").eq("child_id", childId),
    supabase.from("payouts").select("contract_id, paid_on"),
    supabase.from("tasks").select("id, name, icon, position, active_from, active_until").eq("child_id", childId).order("position"),
  ]);
  for (const r of [balances, contracts, payouts, tasks]) if (r.error) throw r.error;

  // History starts with the child's earliest Contract or Task.
  const firstDay = [
    today,
    ...(contracts.data as ContractRow[]).map((c) => c.starts_on),
    ...(tasks.data as TaskRow[]).map((t) => t.active_from),
  ].reduce((a, b) => (b < a ? b : a));
  const shown = shownDay(requestedDay, today, firstDay);
  const week = schoolWeek(shown ?? today);
  const monday = week[0];

  const [checkOffs, approvals] = await Promise.all([
    supabase.from("check_offs").select("task_id, day").gte("day", week[0]).lte("day", week[4]),
    supabase.from("approvals").select("task_id, day, approved").gte("day", week[0]).lte("day", week[4]),
  ]);
  for (const r of [checkOffs, approvals]) if (r.error) throw r.error;

  const open = (contracts.data as ContractRow[]).find((c) => c.closed_on === null);
  const paidOn = new Map(payouts.data!.map((p) => [p.contract_id as string, p.paid_on as string]));
  const contractOn = (day: string): DayContract => {
    const c = (contracts.data as ContractRow[]).find((c) => c.starts_on <= day && day <= c.ends_on);
    return !c ? null : { paidOn: c.closed_on === null ? null : (paidOn.get(c.id) ?? c.closed_on) };
  };
  const inOpenContract = (day: string) => !!open && open.starts_on <= day && day <= open.ends_on;
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
    const inContract = contractOn(day) !== null;
    return {
      day,
      tasks: states.length,
      stars: inContract ? states.filter((s) => s === "approved").length : 0,
      waiting: states.includes("checked_off"),
      future: day > today,
      inContract,
    };
  });
  const counted = weekDays.filter((d) => d.inContract && !d.future);

  const friday = week[4];
  const openFriday =
    !isSchoolDay(today) && monday === mondayOf(today) && inOpenContract(friday) && canChildChange(friday, now)
      ? { day: friday, left: tasksOn(friday).filter((t) => t.state === "not_done").length }
      : null;

  // The week's Contract: the shown day's, else the latest one the week touches.
  const weekContract = contractOn(shown ?? "") ?? [...week].reverse().map(contractOn).find((c) => c) ?? null;

  const balance = balances.data![0];
  return {
    today,
    contractId: open?.id ?? null,
    balance: balance ? { stars: balance.stars, groszePerStar: balance.grosze_per_star } : null,
    monday,
    contract: weekContract,
    ...weekLinks(monday, shown, today, firstDay),
    week: weekDays,
    total: {
      stars: counted.reduce((n, d) => n + d.stars, 0),
      max: counted.reduce((n, d) => n + d.tasks, 0),
      contractDays: weekDays.filter((d) => d.inContract).length,
    },
    selected: shown
      ? {
          day: shown,
          canChange: inOpenContract(shown) && canChildChange(shown, now),
          contract: contractOn(shown),
          tasks: tasksOn(shown),
        }
      : null,
    openFriday,
  };
}

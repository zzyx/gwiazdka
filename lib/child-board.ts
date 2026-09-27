import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canChildChange,
  dayDone,
  isSchoolDay,
  schoolWeek,
  taskState,
  warsawToday,
  type DayDone,
  type TaskState,
} from "./today";
import { canJudge, mondayOf, recapMonday, shownDay, weekLinks } from "./weeks";

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
  // All done: "part" while some wait for the parent, "full" once all counted.
  done: DayDone;
};

// A week's Weekly bonus as the child sees it: the Contract's size, and Grant,
// No bonus or undecided. A paid-out Contract's undecided week got no bonus.
export type WeekBonus = {
  size: number;
  granted: boolean | null;
  // From Friday the week can be decided; perfect when every Task counted.
  judgeable: boolean;
  perfect: boolean;
};

// The top-of-Today recap of the week just judged.
export type Recap = { monday: string; fromTasks: number; max: number; bonus: WeekBonus };

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
  // The shown week's Weekly bonus, or null when no Contract touches it.
  bonus: WeekBonus | null;
  // Shown only on the current week: from Monday last week, from Friday this week.
  recap: Recap | null;
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

type ContractRow = {
  id: string;
  starts_on: string;
  ends_on: string;
  weekly_bonus_stars: number;
  closed_on: string | null;
};

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

  const [balances, contracts, payouts, tasks, bonuses] = await Promise.all([
    supabase.from("star_balances").select("stars, grosze_per_star").eq("child_id", childId),
    supabase
      .from("contracts")
      .select("id, starts_on, ends_on, weekly_bonus_stars, closed_on")
      .eq("child_id", childId),
    supabase.from("payouts").select("contract_id, paid_on"),
    supabase.from("tasks").select("id, name, icon, position, active_from, active_until").eq("child_id", childId).order("position"),
    supabase.from("weekly_bonuses").select("contract_id, week_of, granted"),
  ]);
  for (const r of [balances, contracts, payouts, tasks, bonuses]) if (r.error) throw r.error;

  // History starts with the child's earliest Contract or Task.
  const firstDay = [
    today,
    ...(contracts.data as ContractRow[]).map((c) => c.starts_on),
    ...(tasks.data as TaskRow[]).map((t) => t.active_from),
  ].reduce((a, b) => (b < a ? b : a));
  const shown = shownDay(requestedDay, today, firstDay);
  const week = schoolWeek(shown ?? today);
  const monday = week[0];
  const thisWeek = monday === mondayOf(today);
  // The current week also shows the recap, which may cover last week.
  const from = thisWeek ? recapMonday(today) : monday;

  const [checkOffs, approvals] = await Promise.all([
    supabase.from("check_offs").select("task_id, day").gte("day", from).lte("day", week[4]),
    supabase.from("approvals").select("task_id, day, approved").gte("day", from).lte("day", week[4]),
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

  const daysOf = (monday: string): BoardDay[] =>
    schoolWeek(monday).map((day) => {
      const states = tasksOn(day).map((t) => t.state);
      const inContract = contractOn(day) !== null;
      const future = day > today;
      return {
        day,
        tasks: states.length,
        stars: inContract ? states.filter((s) => s === "approved").length : 0,
        waiting: states.includes("checked_off"),
        future,
        inContract,
        done: dayDone(states, inContract, future),
      };
    });
  // Stars from a week's Tasks, out of how many its days so far could earn.
  const totalOf = (days: BoardDay[]) => {
    const counted = days.filter((d) => d.inContract && !d.future);
    return {
      stars: counted.reduce((n, d) => n + d.stars, 0),
      max: counted.reduce((n, d) => n + d.tasks, 0),
      contractDays: days.filter((d) => d.inContract).length,
    };
  };
  // The week belongs to the latest Contract it touches.
  const bonusOf = (monday: string, { stars, max }: { stars: number; max: number }): WeekBonus | null => {
    const days = schoolWeek(monday).reverse();
    const c = (contracts.data as ContractRow[]).find((c) => days.some((d) => c.starts_on <= d && d <= c.ends_on));
    if (!c) return null;
    const decision = bonuses.data!.find((b) => b.contract_id === c.id && b.week_of === monday);
    const judgeable = canJudge(monday, today);
    return {
      size: c.weekly_bonus_stars,
      granted: decision ? (decision.granted as boolean) : c.closed_on === null ? null : false,
      judgeable,
      perfect: judgeable && max > 0 && stars === max,
    };
  };

  const weekDays = daysOf(monday);
  const total = totalOf(weekDays);

  const friday = week[4];
  const openFriday =
    !isSchoolDay(today) && monday === mondayOf(today) && inOpenContract(friday) && canChildChange(friday, now)
      ? { day: friday, left: tasksOn(friday).filter((t) => t.state === "not_done").length }
      : null;

  // The week's Contract: the shown day's, else the latest one the week touches.
  const weekContract = contractOn(shown ?? "") ?? [...week].reverse().map(contractOn).find((c) => c) ?? null;

  const recapOf = (monday: string): Recap | null => {
    const { stars, max } = totalOf(daysOf(monday));
    const bonus = bonusOf(monday, { stars, max });
    if (!bonus || !bonus.judgeable || bonus.size === 0) return null;
    return { monday, fromTasks: stars, max, bonus };
  };

  const balance = balances.data![0];
  return {
    today,
    contractId: open?.id ?? null,
    balance: balance ? { stars: balance.stars, groszePerStar: balance.grosze_per_star } : null,
    monday,
    contract: weekContract,
    ...weekLinks(monday, shown, today, firstDay),
    week: weekDays,
    total,
    bonus: bonusOf(monday, total),
    recap: thisWeek ? recapOf(recapMonday(today)) : null,
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

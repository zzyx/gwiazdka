// The parent's History: one week of a child's Tasks as a grid, Tasks down and
// Monday to Friday across, over every Contract the child has had. Pure, so it
// can be tested without a database.
import { buildChildInbox, buildDay, isActive, type TaskRow } from "./inbox";
import { addDays, type TaskState } from "./today";
import { canJudge, mondayOf } from "./weeks";

export type HistoryContract = {
  id: string;
  starts_on: string;
  ends_on: string;
  grosze_per_star: number;
  weekly_bonus_stars: number;
  // Null while open; a closed Contract is paid out and frozen.
  closed_on: string | null;
  paid_on: string | null;
};

// How a day of the week can be used: "open" days of the open Contract can be
// changed, "paid" days of a paid-out Contract are read-only, and days outside a
// Contract or still to come have nothing to show.
export type HistoryDayKind = "open" | "paid" | "out" | "future";

export type HistoryDay = {
  day: string;
  kind: HistoryDayKind;
  // Nothing checked off or decided on a past day of a Contract.
  empty: boolean;
  // One per Task of the week, in order; null where the Task wasn't active that
  // day or the day has no Contract.
  cells: (TaskState | null)[];
};

export type HistoryWeek = {
  monday: string;
  // The weeks the ‹ and › arrows lead to; null at the first or this week.
  prev: string | null;
  next: string | null;
  // The Contracts the week's days belong to, oldest first.
  contracts: HistoryContract[];
  tasks: { id: string; name: string; icon: string }[];
  days: HistoryDay[];
  // The Weekly bonus of the week's latest Contract, shown only; null when it has none.
  bonus: { size: number; granted: boolean | null; judgeable: boolean } | null;
  // The open Contract's empty days, oldest first, for the Inbox badge and the banner.
  emptyDays: string[];
};

type Input = {
  today: string;
  // The week asked for, by any of its days; unset or out of range shows this week.
  week?: string;
  contracts: HistoryContract[];
  tasks: TaskRow[];
  checkOffs: { task_id: string; day: string }[];
  approvals: { task_id: string; day: string; approved: boolean }[];
  bonuses: { contract_id: string; week_of: string; granted: boolean }[];
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// The weeks History can show: from the week of the child's first Contract to this week.
export function weekBounds(contracts: { starts_on: string }[], today: string) {
  const last = mondayOf(today);
  const starts = contracts.map((c) => c.starts_on).sort();
  const first = starts.length && mondayOf(starts[0]) < last ? mondayOf(starts[0]) : last;
  return { first, last };
}

export function shownMonday(requested: string | undefined, first: string, last: string): string {
  if (!requested || !ISO_DAY.test(requested) || Number.isNaN(Date.parse(requested))) return last;
  const monday = mondayOf(requested);
  return monday < first ? first : monday > last ? last : monday;
}

export function buildHistoryWeek({ today, week, contracts, tasks, checkOffs, approvals, bonuses }: Input): HistoryWeek {
  const { first, last } = weekBounds(contracts, today);
  const monday = shownMonday(week, first, last);
  const dates = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));

  const checked = new Set(checkOffs.map((c) => `${c.task_id}/${c.day}`));
  const decided = new Map(approvals.map((a) => [`${a.task_id}/${a.day}`, a.approved]));
  const ordered = [...tasks].sort((a, b) => a.position - b.position);
  const shown = ordered.filter((t) => dates.some((d) => isActive(t, d)));
  const contractOf = (day: string) => contracts.find((c) => c.starts_on <= day && day <= c.ends_on) ?? null;

  const days = dates.map((day): HistoryDay => {
    const contract = contractOf(day);
    const none = { day, empty: false, cells: shown.map(() => null) };
    if (day > today) return { ...none, kind: "future" };
    if (!contract) return { ...none, kind: "out" };
    const built = buildDay(day, today, shown, checked, decided);
    const states = new Map(built.rows.map((r) => [r.taskId, r.state]));
    return {
      day,
      kind: contract.closed_on === null ? "open" : "paid",
      empty: built.empty,
      cells: shown.map((t) => states.get(t.id) ?? null),
    };
  });

  const inWeek = contracts
    .filter((c) => c.starts_on <= dates[4] && dates[0] <= c.ends_on)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const latest = inWeek.at(-1);
  const bonus =
    latest && latest.weekly_bonus_stars > 0
      ? {
          size: latest.weekly_bonus_stars,
          granted: bonuses.find((b) => b.contract_id === latest.id && b.week_of === monday)?.granted ?? null,
          judgeable: canJudge(monday, today),
        }
      : null;

  const open = contracts.find((c) => c.closed_on === null);
  const emptyDays = open
    ? buildChildInbox({ today, contract: open, tasks, checkOffs, approvals, bonuses: [] }).emptyDays
    : [];

  return {
    monday,
    prev: monday > first ? addDays(monday, -7) : null,
    next: monday < last ? addDays(monday, 7) : null,
    contracts: inWeek,
    tasks: shown.map(({ id, name, icon }) => ({ id, name, icon })),
    days,
    bonus,
    emptyDays,
  };
}

// A day's Stars and how many it could earn; undecided counts the Tasks "All" would approve.
export function dayCount(day: HistoryDay) {
  const cells = day.cells.filter((c) => c !== null);
  return {
    stars: cells.filter((c) => c === "approved").length,
    max: cells.length,
    undecided: day.kind === "open" ? cells.filter((c) => c === "not_done" || c === "checked_off").length : 0,
  };
}

// What a tap on a cell sets: empty or waiting becomes approved, approved becomes
// rejected, rejected becomes approved. A decision is never taken back.
export const tapped = (state: TaskState): boolean => state !== "approved";

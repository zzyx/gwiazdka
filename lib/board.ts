// The parent's Board: one column per child with a summary of their open
// Contract and its weeks, newest first, each drawn as a History week grid.
// Pure, so it can be tested without a database.
import { buildChildInbox, type TaskRow } from "./inbox";
import { buildHistoryWeek, dayCount, type HistoryContract, type HistoryDay, type HistoryWeek } from "./history";
import { addDays } from "./today";
import { mondayOf } from "./weeks";

export type BoardWeek = HistoryWeek & {
  // This week and last week start open; older weeks fold to one line.
  open: boolean;
  // Stars from the week's Tasks, out of how many its days could earn.
  stars: number;
  max: number;
  waiting: number;
};

export type ChildBoard = {
  // The balance: Stars from Tasks plus granted Weekly bonuses.
  stars: number;
  groszePerStar: number;
  weeklyBonus: number;
  waiting: number;
  thisWeek: { stars: number; max: number };
  // Finished weeks whose Weekly bonus is still undecided.
  bonusesToDecide: number;
  // The Contract's empty days, oldest first.
  emptyDays: string[];
  weeks: BoardWeek[];
};

type Input = {
  today: string;
  contract: HistoryContract;
  tasks: TaskRow[];
  checkOffs: { task_id: string; day: string }[];
  approvals: { task_id: string; day: string; approved: boolean }[];
  bonuses: { contract_id: string; week_of: string; granted: boolean }[];
};

export function buildChildBoard({ today, contract, tasks, checkOffs, approvals, bonuses }: Input): ChildBoard {
  const own = bonuses.filter((b) => b.contract_id === contract.id);
  const inbox = buildChildInbox({ today, contract, tasks, checkOffs, approvals, bonuses: own });
  const lastWeek = addDays(mondayOf(today), -7);

  const weeks = inbox.weeks.map((w): BoardWeek => {
    const week = buildHistoryWeek({ today, week: w.monday, contracts: [contract], tasks, checkOffs, approvals, bonuses: own });
    const counts = week.days.map(dayBar);
    return {
      ...week,
      open: w.monday >= lastWeek,
      stars: counts.reduce((sum, c) => sum + c.stars, 0),
      max: counts.reduce((sum, c) => sum + c.max, 0),
      waiting: counts.reduce((sum, c) => sum + c.waiting, 0),
    };
  });

  const current = weeks.find((w) => w.monday === mondayOf(today));
  return {
    stars: inbox.stars,
    groszePerStar: inbox.groszePerStar,
    weeklyBonus: inbox.weeklyBonus,
    waiting: inbox.waiting,
    thisWeek: { stars: current?.stars ?? 0, max: current?.max ?? 0 },
    bonusesToDecide: weeks.filter((w) => w.bonus?.judgeable && w.bonus.granted === null).length,
    emptyDays: inbox.emptyDays,
    weeks,
  };
}

// One day of a folded week: its Stars and waiting Check-offs out of its Tasks.
export function dayBar(day: HistoryDay) {
  const { stars, max } = dayCount(day);
  return { stars, waiting: day.cells.filter((c) => c === "checked_off").length, max };
}

// A child's tab gets a dot while something needs the parent.
export const needsLook = (board: Pick<ChildBoard, "waiting" | "bonusesToDecide">) =>
  board.waiting > 0 || board.bonusesToDecide > 0;

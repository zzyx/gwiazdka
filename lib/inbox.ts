// The parent's "Inbox by child": what waits for Approval, day by day, inside
// each child's open Contract. Pure, so it can be tested without a database.
import { addDays, isSchoolDay, taskState, type TaskState } from "./today";
import { canJudge, mondayOf } from "./weeks";

export type InboxRow = { taskId: string; name: string; icon: string; state: TaskState };

export type InboxDay = { day: string; rows: InboxRow[]; waiting: number; stars: number };

// One week of the Contract as the parent judges it for the Weekly bonus.
export type InboxWeek = {
  monday: string;
  // Monday to Friday; null for a day outside the Contract or still to come.
  days: (InboxDay | null)[];
  // Stars from the week's Tasks, out of how many its days could earn.
  fromTasks: number;
  max: number;
  waiting: number;
  // From Friday on the week can be decided; perfect when every Task counted.
  judgeable: boolean;
  perfect: boolean;
  // Grant, No bonus, or undecided.
  granted: boolean | null;
};

export type ChildInbox = {
  // The balance: Stars from Tasks plus granted Weekly bonuses.
  stars: number;
  taskStars: number;
  bonusStars: number;
  weeklyBonus: number;
  groszePerStar: number;
  waiting: number;
  // Days with Check-offs waiting, newest first; shown as cards.
  waitingDays: InboxDay[];
  // Every other School day of the Contract up to today, newest first; folded.
  otherDays: InboxDay[];
  // Every week of the Contract up to this one, newest first.
  weeks: InboxWeek[];
};

type Input = {
  today: string;
  contract: { starts_on: string; ends_on: string; grosze_per_star: number; weekly_bonus_stars: number };
  tasks: {
    id: string;
    name: string;
    icon: string;
    position: number;
    active_from: string;
    active_until: string | null;
  }[];
  checkOffs: { task_id: string; day: string }[];
  approvals: { task_id: string; day: string; approved: boolean }[];
  // The Contract's Weekly bonus decisions.
  bonuses: { week_of: string; granted: boolean }[];
};

export function buildChildInbox({ today, contract, tasks, checkOffs, approvals, bonuses }: Input): ChildInbox {
  const checked = new Set(checkOffs.map((c) => `${c.task_id}/${c.day}`));
  const decided = new Map(approvals.map((a) => [`${a.task_id}/${a.day}`, a.approved]));
  const ordered = [...tasks].sort((a, b) => a.position - b.position);

  const days: InboxDay[] = [];
  const last = contract.ends_on < today ? contract.ends_on : today;
  for (let day = last; day >= contract.starts_on; day = addDays(day, -1)) {
    if (!isSchoolDay(day)) continue;
    const rows = ordered
      .filter((t) => t.active_from <= day && (t.active_until === null || day < t.active_until))
      .map((t) => ({
        taskId: t.id,
        name: t.name,
        icon: t.icon,
        state: taskState(checked.has(`${t.id}/${day}`), decided.get(`${t.id}/${day}`)),
      }));
    days.push({
      day,
      rows,
      waiting: rows.filter((r) => r.state === "checked_off").length,
      stars: rows.filter((r) => r.state === "approved").length,
    });
  }

  const byDay = new Map(days.map((d) => [d.day, d]));
  const decisions = new Map(bonuses.map((b) => [b.week_of, b.granted]));
  const weeks: InboxWeek[] = [];
  for (let monday = mondayOf(last); monday >= mondayOf(contract.starts_on); monday = addDays(monday, -7)) {
    const week = [0, 1, 2, 3, 4].map((i) => byDay.get(addDays(monday, i)) ?? null);
    const counted = week.filter((d) => d !== null);
    const fromTasks = counted.reduce((sum, d) => sum + d.stars, 0);
    const max = counted.reduce((sum, d) => sum + d.rows.length, 0);
    const judgeable = canJudge(monday, today);
    weeks.push({
      monday,
      days: week,
      fromTasks,
      max,
      waiting: counted.reduce((sum, d) => sum + d.waiting, 0),
      judgeable,
      perfect: judgeable && max > 0 && fromTasks === max,
      granted: decisions.get(monday) ?? null,
    });
  }

  const taskStars = days.reduce((sum, d) => sum + d.stars, 0);
  const bonusStars = weeks.filter((w) => w.granted).length * contract.weekly_bonus_stars;
  return {
    stars: taskStars + bonusStars,
    taskStars,
    bonusStars,
    weeklyBonus: contract.weekly_bonus_stars,
    groszePerStar: contract.grosze_per_star,
    waiting: days.reduce((sum, d) => sum + d.waiting, 0),
    waitingDays: days.filter((d) => d.waiting > 0),
    otherDays: days.filter((d) => d.waiting === 0),
    weeks,
  };
}

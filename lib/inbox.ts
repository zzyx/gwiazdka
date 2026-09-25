// The parent's "Inbox by child": what waits for Approval, day by day, inside
// each child's open Contract. Pure, so it can be tested without a database.
import { addDays, isSchoolDay, taskState, type TaskState } from "./today";

export type InboxRow = { taskId: string; name: string; icon: string; state: TaskState };

export type InboxDay = { day: string; rows: InboxRow[]; waiting: number; stars: number };

export type ChildInbox = {
  stars: number;
  groszePerStar: number;
  waiting: number;
  // Days with Check-offs waiting, newest first; shown as cards.
  waitingDays: InboxDay[];
  // Every other School day of the Contract up to today, newest first; folded.
  otherDays: InboxDay[];
};

type Input = {
  today: string;
  contract: { starts_on: string; ends_on: string; grosze_per_star: number };
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
};

export function buildChildInbox({ today, contract, tasks, checkOffs, approvals }: Input): ChildInbox {
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

  return {
    stars: days.reduce((sum, d) => sum + d.stars, 0),
    groszePerStar: contract.grosze_per_star,
    waiting: days.reduce((sum, d) => sum + d.waiting, 0),
    waitingDays: days.filter((d) => d.waiting > 0),
    otherDays: days.filter((d) => d.waiting === 0),
  };
}

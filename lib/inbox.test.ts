import { describe, expect, it } from "vitest";
import { buildChildInbox } from "./inbox";

const tasks = [
  { id: "teeth", name: "Brush teeth", icon: "tooth", position: 1, active_from: "2026-09-01", active_until: null },
  { id: "bag", name: "Pack school bag", icon: "backpack", position: 2, active_from: "2026-09-01", active_until: null },
  { id: "bed", name: "Make the bed", icon: "bed", position: 3, active_from: "2026-09-23", active_until: null },
];
const contract = { starts_on: "2026-09-21", ends_on: "2027-01-31", grosze_per_star: 50 };

// Wednesday 23 September 2026.
const inbox = buildChildInbox({
  today: "2026-09-23",
  contract,
  tasks,
  checkOffs: [
    { task_id: "teeth", day: "2026-09-22" },
    { task_id: "bag", day: "2026-09-22" },
    { task_id: "teeth", day: "2026-09-21" },
    { task_id: "teeth", day: "2026-09-23" },
  ],
  approvals: [
    { task_id: "bag", day: "2026-09-22", approved: true },
    { task_id: "teeth", day: "2026-09-21", approved: true },
    { task_id: "bag", day: "2026-09-21", approved: false },
  ],
});

describe("buildChildInbox", () => {
  it("counts the Check-offs waiting for Approval", () => {
    expect(inbox.waiting).toBe(2);
  });

  it("counts Stars from approved Tasks in the Contract", () => {
    expect(inbox.stars).toBe(2);
    expect(inbox.groszePerStar).toBe(50);
  });

  it("puts days with waiting Check-offs first, newest first", () => {
    expect(inbox.waitingDays.map((d) => d.day)).toEqual(["2026-09-23", "2026-09-22"]);
  });

  it("lists every Task of the day with its state", () => {
    const tuesday = inbox.waitingDays[1];
    expect(tuesday.rows.map((r) => [r.taskId, r.state])).toEqual([
      ["teeth", "checked_off"],
      ["bag", "approved"],
    ]);
    expect(tuesday.waiting).toBe(1);
    expect(tuesday.stars).toBe(1);
  });

  it("shows a Task only from the day it was added", () => {
    expect(inbox.waitingDays[0].rows.map((r) => r.taskId)).toEqual(["teeth", "bag", "bed"]);
  });

  it("folds the other School days of the Contract, newest first", () => {
    expect(inbox.otherDays.map((d) => [d.day, d.stars, d.rows.length])).toEqual([["2026-09-21", 1, 2]]);
  });
});

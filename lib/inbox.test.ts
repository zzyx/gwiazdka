import { describe, expect, it } from "vitest";
import { buildChildInbox } from "./inbox";

const tasks = [
  { id: "teeth", name: "Brush teeth", icon: "tooth", position: 1, active_from: "2026-09-01", active_until: null },
  { id: "bag", name: "Pack school bag", icon: "backpack", position: 2, active_from: "2026-09-01", active_until: null },
  { id: "bed", name: "Make the bed", icon: "bed", position: 3, active_from: "2026-09-23", active_until: null },
];
const contract = { starts_on: "2026-09-21", ends_on: "2027-01-31", grosze_per_star: 50, weekly_bonus_stars: 3 };

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
  bonuses: [],
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

});

describe("buildChildInbox weeks", () => {
  // Kuba's Contract starts on Wednesday 9 September; today is Monday 21 September.
  const kuba = (bonuses: { week_of: string; granted: boolean }[], today = "2026-09-21") =>
    buildChildInbox({
      today,
      contract: { starts_on: "2026-09-09", ends_on: "2027-01-31", grosze_per_star: 50, weekly_bonus_stars: 3 },
      tasks: [tasks[0]],
      checkOffs: [{ task_id: "teeth", day: "2026-09-18" }],
      approvals: ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-09"].map((day) => ({
        task_id: "teeth",
        day,
        approved: true,
      })),
      bonuses,
    });

  it("lists every week of the Contract up to this one, newest first", () => {
    expect(kuba([]).weeks.map((w) => w.monday)).toEqual(["2026-09-21", "2026-09-14", "2026-09-07"]);
  });

  it("leaves out days before the Contract and days still to come", () => {
    const [current, , first] = kuba([]).weeks;
    expect(first.days.map((d) => d?.day ?? null)).toEqual([null, null, "2026-09-09", "2026-09-10", "2026-09-11"]);
    expect(first.max).toBe(3);
    expect(current.days.filter((d) => d !== null)).toHaveLength(1);
  });

  it("counts a week's Stars and waiting Check-offs; a finished week can be judged", () => {
    const week = kuba([]).weeks[1];
    expect([week.fromTasks, week.max, week.waiting]).toEqual([4, 5, 1]);
    expect(week.judgeable).toBe(true);
    expect(week.perfect).toBe(false);
    expect(kuba([]).weeks[0].judgeable).toBe(false);
  });

  it("marks a perfect week only once it can be judged", () => {
    // Monday to Thursday approved; on Thursday the week can't be judged yet.
    const approvals = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17"].map((day) => ({
      task_id: "teeth",
      day,
      approved: true,
    }));
    const on = (today: string, extra: typeof approvals = []) =>
      buildChildInbox({
        today,
        contract: { starts_on: "2026-09-14", ends_on: "2027-01-31", grosze_per_star: 50, weekly_bonus_stars: 3 },
        tasks: [tasks[0]],
        checkOffs: [],
        approvals: [...approvals, ...extra],
        bonuses: [],
      }).weeks[0];
    expect(on("2026-09-17").perfect).toBe(false);
    expect(on("2026-09-18").perfect).toBe(false);
    expect(on("2026-09-18", [{ task_id: "teeth", day: "2026-09-18", approved: true }]).perfect).toBe(true);
  });

  it("lists the empty past days, oldest first, but never today", () => {
    expect(kuba([]).emptyDays).toEqual(["2026-09-10", "2026-09-11"]);
  });

  it("adds granted weeks at the Contract's Weekly bonus to the balance", () => {
    const inbox = kuba([
      { week_of: "2026-09-14", granted: true },
      { week_of: "2026-09-07", granted: false },
    ]);
    expect([inbox.taskStars, inbox.bonusStars, inbox.stars]).toEqual([5, 3, 8]);
    expect(inbox.weeks.map((w) => w.granted)).toEqual([null, true, false]);
  });
});

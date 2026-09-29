import { describe, expect, it } from "vitest";
import { buildChildBoard, dayBar, needsLook } from "./board";
import type { HistoryContract } from "./history";

const tasks = [
  { id: "teeth", name: "Brush teeth", icon: "tooth", position: 1, active_from: "2026-09-09", active_until: null },
  { id: "bag", name: "Pack school bag", icon: "backpack", position: 2, active_from: "2026-09-09", active_until: null },
];

// Kuba's Contract started on Wednesday 9 September, before it was set up.
// Today is Wednesday 30 September.
const contract: HistoryContract = {
  id: "open",
  starts_on: "2026-09-09",
  ends_on: "2027-01-31",
  grosze_per_star: 50,
  weekly_bonus_stars: 3,
  closed_on: null,
  paid_on: null,
};

const kuba = (today = "2026-09-30") =>
  buildChildBoard({
    today,
    contract,
    tasks,
    checkOffs: [
      { task_id: "teeth", day: "2026-09-30" },
      { task_id: "bag", day: "2026-09-29" },
      { task_id: "teeth", day: "2026-09-24" },
    ],
    approvals: [
      { task_id: "teeth", day: "2026-09-29", approved: true },
      { task_id: "teeth", day: "2026-09-21", approved: true },
      { task_id: "bag", day: "2026-09-21", approved: true },
      { task_id: "teeth", day: "2026-09-22", approved: false },
      { task_id: "teeth", day: "2026-09-15", approved: true },
    ],
    bonuses: [
      { contract_id: "open", week_of: "2026-09-14", granted: true },
      { contract_id: "other", week_of: "2026-09-21", granted: true },
    ],
  });

describe("a child's Board", () => {
  it("lists the Contract's weeks newest first, this week and last week open", () => {
    const board = kuba();
    expect(board.weeks.map((w) => [w.monday, w.open])).toEqual([
      ["2026-09-28", true],
      ["2026-09-21", true],
      ["2026-09-14", false],
      ["2026-09-07", false],
    ]);
  });

  it("draws each week as History does, days before the Contract left out", () => {
    const first = kuba().weeks.at(-1)!;
    expect(first.days.map((d) => d.kind)).toEqual(["out", "out", "open", "open", "open"]);
    expect(first.tasks.map((t) => t.id)).toEqual(["teeth", "bag"]);
    const now = kuba().weeks[0];
    expect(now.days.map((d) => d.kind)).toEqual(["open", "open", "open", "future", "future"]);
  });

  it("counts each week's Stars, waiting Check-offs and Weekly bonus", () => {
    const [thisWeek, lastWeek, third] = kuba().weeks;
    expect(thisWeek).toMatchObject({ stars: 1, max: 6, waiting: 2, bonus: { size: 3, granted: null, judgeable: false } });
    expect(lastWeek).toMatchObject({ stars: 2, max: 10, waiting: 1, bonus: { granted: null, judgeable: true } });
    expect(third).toMatchObject({ stars: 1, bonus: { granted: true, judgeable: true } });
  });

  it("sums up the balance, what waits and the bonuses still to decide", () => {
    const board = kuba();
    // 4 Stars from Tasks and one granted +3 bonus.
    expect(board).toMatchObject({ stars: 7, groszePerStar: 50, weeklyBonus: 3, waiting: 3 });
    expect(board.thisWeek).toEqual({ stars: 1, max: 6 });
    // Last week and the first week are finished and undecided.
    expect(board.bonusesToDecide).toBe(2);
    // Past School days with nothing checked off or decided, oldest first.
    expect(board.emptyDays).toEqual([
      "2026-09-09", "2026-09-10", "2026-09-11",
      "2026-09-14", "2026-09-16", "2026-09-17", "2026-09-18",
      "2026-09-23", "2026-09-25", "2026-09-28",
    ]);
  });

  it("has no bonuses to decide when the Contract has no Weekly bonus", () => {
    const board = buildChildBoard({
      today: "2026-09-30",
      contract: { ...contract, weekly_bonus_stars: 0 },
      tasks,
      checkOffs: [],
      approvals: [],
      bonuses: [],
    });
    expect(board.bonusesToDecide).toBe(0);
    expect(board.weeks[0].bonus).toBeNull();
  });

  it("opens only this week in a Contract's first week", () => {
    const board = buildChildBoard({ today: "2026-09-10", contract, tasks, checkOffs: [], approvals: [], bonuses: [] });
    expect(board.weeks.map((w) => [w.monday, w.open])).toEqual([["2026-09-07", true]]);
  });
});

describe("a folded week's day bar", () => {
  it("counts Stars and waiting Check-offs out of the day's Tasks", () => {
    const [, lastWeek] = kuba().weeks;
    expect(lastWeek.days.map(dayBar)).toEqual([
      { stars: 2, waiting: 0, max: 2 },
      { stars: 0, waiting: 0, max: 2 },
      { stars: 0, waiting: 0, max: 2 },
      { stars: 0, waiting: 1, max: 2 },
      { stars: 0, waiting: 0, max: 2 },
    ]);
  });
});

describe("the dot on a child's tab", () => {
  it("shows while Check-offs wait or a Weekly bonus is to decide", () => {
    expect(needsLook({ waiting: 1, bonusesToDecide: 0 })).toBe(true);
    expect(needsLook({ waiting: 0, bonusesToDecide: 2 })).toBe(true);
    expect(needsLook({ waiting: 0, bonusesToDecide: 0 })).toBe(false);
  });
});

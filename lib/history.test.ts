import { describe, expect, it } from "vitest";
import { buildHistoryWeek, dayCount, shownMonday, tapped, weekBounds, type HistoryContract } from "./history";

const tasks = [
  { id: "teeth", name: "Brush teeth", icon: "tooth", position: 1, active_from: "2026-09-09", active_until: null },
  { id: "bag", name: "Pack school bag", icon: "backpack", position: 2, active_from: "2026-09-09", active_until: null },
  { id: "bed", name: "Make the bed", icon: "bed", position: 3, active_from: "2026-09-23", active_until: null },
];

// Kuba's Contract started on Wednesday 9 September, before it was set up; his
// June Contract is paid out. Today is Wednesday 23 September.
const open: HistoryContract = {
  id: "open",
  starts_on: "2026-09-09",
  ends_on: "2027-01-31",
  grosze_per_star: 50,
  weekly_bonus_stars: 3,
  closed_on: null,
  paid_on: null,
};
const paid: HistoryContract = {
  id: "june",
  starts_on: "2026-06-01",
  ends_on: "2026-06-30",
  grosze_per_star: 50,
  weekly_bonus_stars: 0,
  closed_on: "2026-06-30",
  paid_on: "2026-07-01",
};
const june = [
  { id: "june-teeth", name: "Brush teeth", icon: "tooth", position: 1, active_from: "2026-06-01", active_until: "2026-07-01" },
];

const kuba = (week?: string, extra: { task_id: string; day: string; approved: boolean }[] = []) =>
  buildHistoryWeek({
    today: "2026-09-23",
    week,
    contracts: [open, paid],
    tasks: [...june, ...tasks],
    checkOffs: [
      { task_id: "teeth", day: "2026-09-22" },
      { task_id: "teeth", day: "2026-09-14" },
    ],
    approvals: [
      { task_id: "teeth", day: "2026-09-21", approved: true },
      { task_id: "bag", day: "2026-09-21", approved: false },
      { task_id: "june-teeth", day: "2026-06-30", approved: true },
      ...extra,
    ],
    bonuses: [{ contract_id: "open", week_of: "2026-09-14", granted: true }],
  });

describe("weeks History can show", () => {
  it("runs from the week of the first Contract to this week", () => {
    expect(weekBounds([open, paid], "2026-09-23")).toEqual({ first: "2026-06-01", last: "2026-09-21" });
    expect(weekBounds([], "2026-09-23")).toEqual({ first: "2026-09-21", last: "2026-09-21" });
  });

  it("shows this week unless a valid week in range is asked for", () => {
    expect(shownMonday(undefined, "2026-06-01", "2026-09-21")).toBe("2026-09-21");
    expect(shownMonday("nonsense", "2026-06-01", "2026-09-21")).toBe("2026-09-21");
    expect(shownMonday("2026-09-10", "2026-06-01", "2026-09-21")).toBe("2026-09-07");
    expect(shownMonday("2026-10-05", "2026-06-01", "2026-09-21")).toBe("2026-09-21");
    expect(shownMonday("2025-01-06", "2026-06-01", "2026-09-21")).toBe("2026-06-01");
  });

  it("links the arrows to the neighbouring weeks, never past this week", () => {
    expect([kuba().prev, kuba().next]).toEqual(["2026-09-14", null]);
    expect([kuba("2026-06-01").prev, kuba("2026-06-01").next]).toEqual([null, "2026-06-08"]);
  });
});

describe("buildHistoryWeek", () => {
  it("lists the Tasks active in the week, in order", () => {
    expect(kuba().tasks.map((t) => t.id)).toEqual(["teeth", "bag", "bed"]);
    expect(kuba("2026-06-29").tasks.map((t) => t.id)).toEqual(["june-teeth"]);
  });

  it("shows each Task's state per day; a Task not yet active has no cell", () => {
    const [mon, tue, wed] = kuba().days;
    expect(mon.cells).toEqual(["approved", "rejected", null]);
    expect(tue.cells).toEqual(["checked_off", "not_done", null]);
    expect(wed.cells).toEqual(["not_done", "not_done", "not_done"]);
  });

  it("marks today's week: days to come can't be used", () => {
    expect(kuba().days.map((d) => d.kind)).toEqual(["open", "open", "open", "future", "future"]);
    expect(kuba().days[3].cells).toEqual([null, null, null]);
  });

  it("leaves out days before the first Contract", () => {
    const week = kuba("2026-09-07");
    expect(week.days.map((d) => d.kind)).toEqual(["out", "out", "open", "open", "open"]);
    expect(week.days[0].cells).toEqual([null, null]);
  });

  it("marks wholly empty past days, but not today or a day with anything on it", () => {
    expect(kuba("2026-09-07").days.map((d) => d.empty)).toEqual([false, false, true, true, true]);
    expect(kuba().days.map((d) => d.empty)).toEqual([false, false, false, false, false]);
  });

  it("lists the open Contract's empty days, oldest first", () => {
    // 9 to 11 September, then 15 to 18: the 14th has a Check-off.
    expect(kuba().emptyDays).toEqual([
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
    ]);
    const filled = ["2026-09-09", "2026-09-10", "2026-09-11"].map((day) => ({ task_id: "bag", day, approved: true }));
    expect(kuba(undefined, filled).emptyDays).toEqual(["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"]);
  });

  it("shows a paid-out Contract's weeks read-only", () => {
    const week = kuba("2026-06-29");
    expect(week.days.map((d) => d.kind)).toEqual(["paid", "paid", "out", "out", "out"]);
    expect(week.contracts.map((c) => c.id)).toEqual(["june"]);
    expect(dayCount(week.days[1])).toEqual({ stars: 1, max: 1, undecided: 0 });
    expect(week.bonus).toBeNull();
  });

  it("names no Contract for a week between Contracts", () => {
    expect(kuba("2026-08-03").contracts).toEqual([]);
  });

  it("shows the week's Weekly bonus decision", () => {
    expect(kuba("2026-09-14").bonus).toEqual({ size: 3, granted: true, judgeable: true });
    expect(kuba("2026-09-07").bonus).toEqual({ size: 3, granted: null, judgeable: true });
    expect(kuba().bonus).toEqual({ size: 3, granted: null, judgeable: false });
  });
});

describe("dayCount", () => {
  it("counts Stars and the undecided Tasks that All would approve, never a rejected one", () => {
    const [mon, tue] = kuba().days;
    expect(dayCount(mon)).toEqual({ stars: 1, max: 2, undecided: 0 });
    expect(dayCount(tue)).toEqual({ stars: 0, max: 2, undecided: 2 });
  });
});

describe("tapped", () => {
  it("cycles a cell: empty or waiting to approved, approved to rejected, rejected to approved", () => {
    expect(["not_done", "checked_off", "approved", "rejected"].map((s) => tapped(s as never))).toEqual([
      true,
      true,
      false,
      true,
    ]);
  });
});

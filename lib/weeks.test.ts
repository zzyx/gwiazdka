import { describe, expect, it } from "vitest";
import { canJudge, dayMonth, recapMonday, shownDay, weekLinks, weekRange, weekTitle } from "./weeks";

// Wednesday 23 September 2026; history starts Tuesday 1 September.
const today = "2026-09-23";
const firstDay = "2026-09-01";

describe("weekRange", () => {
  it("names a week inside one month once", () => {
    expect(weekRange("2026-06-01")).toBe("1–5 Jun");
  });
  it("names both months across a month end", () => {
    expect(weekRange("2026-08-31")).toBe("31 Aug – 4 Sep");
  });
});

describe("weekTitle", () => {
  it("is This week, Last week, then dates", () => {
    expect(weekTitle("2026-09-21", today)).toBe("This week");
    expect(weekTitle("2026-09-14", today)).toBe("Last week");
    expect(weekTitle("2026-09-07", today)).toBe("7–11 Sep");
  });
  it("on a weekend counts the week just ended as this week", () => {
    expect(weekTitle("2026-09-21", "2026-09-27")).toBe("This week");
  });
});

describe("dayMonth", () => {
  it("is the day and the full month", () => {
    expect(dayMonth("2026-06-03")).toBe("3 June");
  });
});

describe("shownDay", () => {
  it("shows a past School day that was asked for", () => {
    expect(shownDay("2026-09-02", today, firstDay)).toBe("2026-09-02");
  });
  it("allows the first history week from its Monday", () => {
    expect(shownDay("2026-08-31", today, firstDay)).toBe("2026-08-31");
  });
  it("falls back to today before history, in the future, on a weekend or for junk", () => {
    for (const day of ["2026-08-28", "2026-09-24", "2026-09-19", "2026-02-31x", undefined])
      expect(shownDay(day, today, firstDay)).toBe(today);
  });
  it("falls back to the weekend card on a weekend", () => {
    expect(shownDay(undefined, "2026-09-27", firstDay)).toBeNull();
  });
});

describe("weekLinks", () => {
  it("keeps the weekday one week away", () => {
    expect(weekLinks("2026-09-07", "2026-09-09", today, firstDay)).toEqual({
      prev: "/?day=2026-09-02",
      next: "/?day=2026-09-16",
    });
  });
  it("returns to the plain Today screen when stepping into this week", () => {
    expect(weekLinks("2026-09-14", "2026-09-14", today, firstDay).next).toBe("/");
  });
  it("stops at this week and at the first week with history", () => {
    expect(weekLinks("2026-09-21", today, today, firstDay).next).toBeNull();
    expect(weekLinks("2026-08-31", "2026-09-02", today, firstDay).prev).toBeNull();
  });
  it("steps back to Friday from the weekend card", () => {
    expect(weekLinks("2026-09-21", null, "2026-09-27", firstDay).prev).toBe("/?day=2026-09-18");
  });
});

describe("canJudge", () => {
  it("lets a week be decided from its Friday", () => {
    expect(canJudge("2026-09-21", "2026-09-24")).toBe(false);
    expect(canJudge("2026-09-21", "2026-09-25")).toBe(true);
    expect(canJudge("2026-09-14", "2026-09-21")).toBe(true);
  });
});

describe("recapMonday", () => {
  it("covers last week from Monday and this week from Friday through the weekend", () => {
    expect(recapMonday("2026-09-21")).toBe("2026-09-14");
    expect(recapMonday("2026-09-24")).toBe("2026-09-14");
    expect(recapMonday("2026-09-25")).toBe("2026-09-21");
    expect(recapMonday("2026-09-27")).toBe("2026-09-21");
  });
});

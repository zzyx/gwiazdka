import { describe, expect, it } from "vitest";
import {
  canChildChange,
  dayDone,
  formatPln,
  schoolWeek,
  starsWord,
  taskState,
  warsawToday,
} from "./today";

// Wednesday 23 September 2026, 10:00 in Warsaw (08:00 UTC).
const wednesdayMorning = new Date("2026-09-23T08:00:00Z");

describe("warsawToday", () => {
  it("is the calendar date in Warsaw", () => {
    expect(warsawToday(wednesdayMorning)).toBe("2026-09-23");
  });
  it("has already moved on in Warsaw at 23:30 UTC", () => {
    expect(warsawToday(new Date("2026-09-23T22:30:00Z"))).toBe("2026-09-24");
  });
});

describe("schoolWeek", () => {
  it("is Monday to Friday of the week the day is in", () => {
    expect(schoolWeek("2026-09-23")).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
    ]);
  });
  it("on a weekend is the week that just ended", () => {
    expect(schoolWeek("2026-09-27")[4]).toBe("2026-09-25");
  });
});

describe("canChildChange", () => {
  it("allows today", () => {
    expect(canChildChange("2026-09-23", wednesdayMorning)).toBe(true);
  });
  it("allows yesterday until 22:00 today in Warsaw", () => {
    expect(canChildChange("2026-09-22", new Date("2026-09-23T19:59:00Z"))).toBe(true);
    expect(canChildChange("2026-09-22", new Date("2026-09-23T20:00:00Z"))).toBe(false);
  });
  it("does not allow the day before yesterday", () => {
    expect(canChildChange("2026-09-21", wednesdayMorning)).toBe(false);
  });
  it("does not allow a day that has not come yet", () => {
    expect(canChildChange("2026-09-24", wednesdayMorning)).toBe(false);
  });
  it("allows Friday on Saturday before 22:00, but never the weekend itself", () => {
    const saturdayMorning = new Date("2026-09-26T08:15:00Z");
    expect(canChildChange("2026-09-25", saturdayMorning)).toBe(true);
    expect(canChildChange("2026-09-26", saturdayMorning)).toBe(false);
  });
});

describe("taskState", () => {
  it("follows the Check-off and the Approval", () => {
    expect(taskState(false, undefined)).toBe("not_done");
    expect(taskState(true, undefined)).toBe("checked_off");
    expect(taskState(true, true)).toBe("approved");
    expect(taskState(false, true)).toBe("approved");
    expect(taskState(true, false)).toBe("rejected");
  });
});

describe("starsWord", () => {
  it("uses Polish plurals of gwiazdka", () => {
    expect(starsWord(1)).toBe("gwiazdka");
    expect(starsWord(2)).toBe("gwiazdki");
    expect(starsWord(4)).toBe("gwiazdki");
    expect(starsWord(5)).toBe("gwiazdek");
    expect(starsWord(0)).toBe("gwiazdek");
    expect(starsWord(12)).toBe("gwiazdek");
    expect(starsWord(22)).toBe("gwiazdki");
    expect(starsWord(21)).toBe("gwiazdek");
  });
});

describe("formatPln", () => {
  it("shows grosze as złoty with two decimals", () => {
    expect(formatPln(2050)).toBe("20.50 zł");
    expect(formatPln(0)).toBe("0.00 zł");
  });
});

describe("dayDone", () => {
  it("is full when every Task is counted", () => {
    expect(dayDone(["approved", "approved"], true, false)).toBe("full");
  });
  it("is part when every Task is checked off or counted and some wait", () => {
    expect(dayDone(["approved", "checked_off"], true, false)).toBe("part");
    expect(dayDone(["checked_off", "checked_off"], true, false)).toBe("part");
  });
  it("is plain with a Not counted Task", () => {
    expect(dayDone(["approved", "rejected"], true, false)).toBeNull();
  });
  it("is plain with a Task left undone", () => {
    expect(dayDone(["approved", "checked_off", "not_done"], true, false)).toBeNull();
  });
  it("is plain outside a Contract", () => {
    expect(dayDone(["approved", "approved"], false, false)).toBeNull();
  });
  it("is plain on a future day", () => {
    expect(dayDone(["checked_off"], true, true)).toBeNull();
  });
  it("is plain on a day with no Tasks", () => {
    expect(dayDone([], true, false)).toBeNull();
  });
});

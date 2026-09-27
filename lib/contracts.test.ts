import { describe, expect, it } from "vitest";
import {
  contractTimeline,
  mostItCanPay,
  nextSchoolDay,
  openContractState,
  parseRate,
  progress,
  semesterOf,
  suggestedDates,
} from "./contracts";

const contract = { starts_on: "2026-09-01", ends_on: "2027-01-29" };

describe("openContractState", () => {
  it("is soon before the start, running between the dates, ended after the end", () => {
    expect(openContractState(contract, "2026-08-31")).toBe("soon");
    expect(openContractState(contract, "2026-09-01")).toBe("running");
    expect(openContractState(contract, "2027-01-29")).toBe("running");
    expect(openContractState(contract, "2027-02-01")).toBe("ended");
  });
});

describe("progress", () => {
  it("counts School days up to and including today", () => {
    // 1–4 Sep is Tue–Fri, then Mon 7 Sep.
    expect(progress({ starts_on: "2026-09-01", ends_on: "2026-09-11" }, "2026-09-07")).toEqual({
      all: 9,
      done: 5,
      left: 4,
    });
  });
});

describe("nextSchoolDay", () => {
  it("skips the weekend", () => {
    expect(nextSchoolDay("2026-09-24")).toBe("2026-09-25");
    expect(nextSchoolDay("2026-09-25")).toBe("2026-09-28");
  });
});

describe("semesterOf", () => {
  it("finds the semester a day is in, or the next one in the summer", () => {
    expect(semesterOf("2026-09-23")).toEqual({ starts_on: "2026-09-01", ends_on: "2027-01-31" });
    expect(semesterOf("2027-01-10")).toEqual({ starts_on: "2026-09-01", ends_on: "2027-01-31" });
    expect(semesterOf("2027-03-10")).toEqual({ starts_on: "2027-02-01", ends_on: "2027-06-30" });
    expect(semesterOf("2027-07-15")).toEqual({ starts_on: "2027-09-01", ends_on: "2028-01-31" });
  });
});

describe("suggestedDates", () => {
  it("suggests the current semester, even though it started in the past", () => {
    expect(suggestedDates("2026-09-23", null)).toEqual({ starts_on: "2026-09-01", ends_on: "2027-01-31" });
    expect(suggestedDates("2026-09-23", "2026-06-26")).toEqual({ starts_on: "2026-09-01", ends_on: "2027-01-31" });
  });

  it("starts the next Contract on the School day after the previous one", () => {
    expect(suggestedDates("2026-10-16", "2026-10-16")).toEqual({ starts_on: "2026-10-19", ends_on: "2027-01-31" });
  });
});

describe("parseRate", () => {
  it("reads złoty with a dot or a comma as grosze", () => {
    expect(parseRate("0.50")).toBe(50);
    expect(parseRate("0,5")).toBe(50);
    expect(parseRate(" 2 ")).toBe(200);
  });

  it("rejects anything that isn't a positive amount", () => {
    expect(parseRate("0")).toBeNull();
    expect(parseRate("abc")).toBeNull();
    expect(parseRate("0.505")).toBeNull();
  });
});

describe("mostItCanPay", () => {
  it("counts every Task on every School day plus one Weekly bonus per week", () => {
    // Two weeks: Mon 21 Sep to Fri 2 Oct.
    expect(mostItCanPay({ starts_on: "2026-09-21", ends_on: "2026-10-02" }, 3, 2)).toEqual({
      schoolDays: 10,
      weeks: 2,
      stars: 34,
    });
  });
});

describe("contractTimeline", () => {
  // Tue 1 Sep to Tue 29 Sep: 21 School days.
  const c = { starts_on: "2026-09-01", ends_on: "2026-09-29" };

  it("counts what's left after today and the share of School days gone", () => {
    expect(contractTimeline(c, "2026-09-07")).toEqual({
      state: "running",
      all: 21,
      done: 5,
      left: 16,
      percent: 24,
      endsSoon: false,
    });
  });

  it("ends soon with 3 School days or fewer left", () => {
    // Thu 24 Sep: Fri, Mon and Tue are left.
    expect(contractTimeline(c, "2026-09-24")).toMatchObject({ left: 3, endsSoon: true });
    expect(contractTimeline(c, "2026-09-23")).toMatchObject({ left: 4, endsSoon: false });
    // The weekend before the last two days.
    expect(contractTimeline(c, "2026-09-26")).toMatchObject({ left: 2, endsSoon: true });
  });

  it("is full and no longer ending soon once the end date has passed", () => {
    expect(contractTimeline(c, "2026-10-01")).toEqual({
      state: "ended",
      all: 21,
      done: 21,
      left: 0,
      percent: 100,
      endsSoon: false,
    });
  });

  it("is empty before the start", () => {
    expect(contractTimeline(c, "2026-08-28")).toMatchObject({ state: "soon", done: 0, left: 21, percent: 0, endsSoon: false });
  });
});

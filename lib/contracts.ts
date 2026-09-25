// The rules the Contract screens show before the database checks them:
// a Contract's state, its progress through School days, the suggested dates
// for a new one, and the most it can pay. Pure, so it can be tested without a
// database. Days are ISO dates ("2026-09-23").
import { addDays, isoWeekday, isSchoolDay } from "./today";

export type ContractDates = { starts_on: string; ends_on: string };

// "soon": hasn't started; "running": between its dates; "ended": past its end
// date but not paid out yet.
export type OpenContractState = "soon" | "running" | "ended";

export function openContractState(c: ContractDates, today: string): OpenContractState {
  if (today < c.starts_on) return "soon";
  if (today > c.ends_on) return "ended";
  return "running";
}

export function schoolDaysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (isSchoolDay(d)) days.push(d);
  return days;
}

// How far through its School days a Contract is, today included.
export function progress(c: ContractDates, today: string) {
  const all = schoolDaysBetween(c.starts_on, c.ends_on);
  const done = all.filter((d) => d <= today).length;
  return { all: all.length, done, left: all.length - done };
}

export function nextSchoolDay(day: string): string {
  let d = addDays(day, 1);
  while (!isSchoolDay(d)) d = addDays(d, 1);
  return d;
}

// The Polish school semester a day falls in, or the next one in the summer
// break: 1 September to 31 January, and 1 February to 30 June.
export function semesterOf(day: string): { starts_on: string; ends_on: string } {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  if (month === 1) return { starts_on: `${year - 1}-09-01`, ends_on: `${year}-01-31` };
  if (month <= 6) return { starts_on: `${year}-02-01`, ends_on: `${year}-06-30` };
  return { starts_on: `${year}-09-01`, ends_on: `${year + 1}-01-31` };
}

// Dates suggested for a new Contract: the current semester, or right after the
// previous Contract when there was one (the day after it, if that is later).
export function suggestedDates(today: string, previousEnd: string | null): ContractDates {
  const semester = semesterOf(today);
  if (previousEnd && previousEnd >= semester.starts_on) {
    const starts_on = nextSchoolDay(previousEnd);
    return { starts_on, ends_on: semesterOf(starts_on).ends_on };
  }
  return semester;
}

// "0.50", "0,5" or "2" złoty → grosze; null when it isn't a positive amount.
export function parseRate(text: string): number | null {
  const m = text.trim().replace(",", ".").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const grosze = Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
  return grosze > 0 ? grosze : null;
}

// The most a Contract can pay if every Task and every Weekly bonus is earned.
export function mostItCanPay(c: ContractDates, tasksPerDay: number, weeklyBonus: number) {
  const days = schoolDaysBetween(c.starts_on, c.ends_on);
  const weeks = new Set(days.map((d) => addDays(d, 1 - isoWeekday(d)))).size;
  return { schoolDays: days.length, weeks, stars: days.length * tasksPerDay + weeks * weeklyBonus };
}

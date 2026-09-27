// Browsing the child's past weeks: which week a day belongs to, where the arrows
// lead, and how weeks are named. Days are ISO dates, weeks are named by Monday.
import { addDays, isoWeekday, isSchoolDay, schoolWeek } from "./today";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const dayNum = (day: string) => Number(day.slice(8, 10));
const monthIdx = (day: string) => Number(day.slice(5, 7)) - 1;

export const mondayOf = (day: string) => schoolWeek(day)[0];

// "3 June".
export const dayMonth = (day: string) => `${dayNum(day)} ${MONTHS[monthIdx(day)]}`;

// Monday to Friday as "1–5 Jun", or "31 Aug – 4 Sep" across two months.
export function weekRange(monday: string): string {
  const friday = addDays(monday, 4);
  return monthIdx(monday) === monthIdx(friday)
    ? `${dayNum(monday)}–${dayNum(friday)} ${MONTHS_SHORT[monthIdx(friday)]}`
    : `${dayNum(monday)} ${MONTHS_SHORT[monthIdx(monday)]} – ${dayNum(friday)} ${MONTHS_SHORT[monthIdx(friday)]}`;
}

// "This week", "Last week", or the week's dates.
export function weekTitle(monday: string, today: string): string {
  const thisMonday = mondayOf(today);
  if (monday === thisMonday) return "This week";
  if (monday === addDays(thisMonday, -7)) return "Last week";
  return weekRange(monday);
}

// The day the child asked to see, if they may: a School day that has come, no
// earlier than the week of their first history. Otherwise the current week is shown.
export function shownDay(requested: string | undefined, today: string, firstDay: string): string | null {
  if (
    requested &&
    /^\d{4}-\d{2}-\d{2}$/.test(requested) &&
    !Number.isNaN(Date.parse(requested)) &&
    isSchoolDay(requested) &&
    requested <= today &&
    mondayOf(requested) >= mondayOf(firstDay)
  )
    return requested;
  return isSchoolDay(today) ? today : null;
}

// Where the ‹ and › arrows lead from the shown week: the same weekday one week
// away (Friday when the weekend card is shown), or the plain Today screen when
// that lands in the current week. Null when there is nowhere to go.
export function weekLinks(
  monday: string,
  selected: string | null,
  today: string,
  firstDay: string,
): { prev: string | null; next: string | null } {
  const thisMonday = mondayOf(today);
  const index = selected ? Math.min(isoWeekday(selected), 5) - 1 : 4;
  const href = (m: string) => (m === thisMonday ? "/" : `/?day=${addDays(m, index)}`);
  return {
    prev: monday > mondayOf(firstDay) ? href(addDays(monday, -7)) : null,
    next: monday < thisMonday ? href(addDays(monday, 7)) : null,
  };
}

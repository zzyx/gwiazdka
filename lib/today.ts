// The rules of a child's day, mirroring what the database enforces.
// Days are ISO dates ("2026-09-23"); "today" and the deadline are in Warsaw time.

export type TaskState = "not_done" | "checked_off" | "approved" | "rejected";

const warsaw = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// "YYYY-MM-DDTHH:mm" in Warsaw, so instants can be compared as strings.
function warsawLocal(now: Date): string {
  const p = Object.fromEntries(warsaw.formatToParts(now).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function warsawToday(now: Date): string {
  return warsawLocal(now).slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 1 = Monday … 7 = Sunday.
export function isoWeekday(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay() || 7;
}

export function isSchoolDay(day: string): boolean {
  return isoWeekday(day) <= 5;
}

// Monday to Friday of the week the day is in; on a weekend, the week just ended.
export function schoolWeek(day: string): string[] {
  const monday = addDays(day, 1 - isoWeekday(day));
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

// A child can make or undo a Check-off on a School day that has come, until
// 22:00 the next calendar day.
export function canChildChange(day: string, now: Date): boolean {
  return (
    isSchoolDay(day) &&
    day <= warsawToday(now) &&
    warsawLocal(now) < `${addDays(day, 1)}T22:00`
  );
}

export function taskState(checkedOff: boolean, approved: boolean | undefined): TaskState {
  if (approved === true) return "approved";
  if (approved === false) return "rejected";
  return checkedOff ? "checked_off" : "not_done";
}

// A Star is shown as "gwiazdka", with Polish plurals.
export function starsWord(n: number): string {
  if (n === 1) return "gwiazdka";
  const last = n % 10;
  const lastTwo = n % 100;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? "gwiazdki" : "gwiazdek";
}

export function formatPln(grosze: number): string {
  return `${(grosze / 100).toFixed(2)} zł`;
}

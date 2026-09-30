"use client";

import { Fragment, useOptimistic, useTransition, type ReactNode } from "react";
import type { DayPhoto } from "@/lib/day-photos";
import { dayCount, tapped, type HistoryDay, type HistoryWeek } from "@/lib/history";
import { taskEmoji } from "@/lib/task-icons";
import type { TaskState } from "@/lib/today";
import { approveUndecided, decide } from "./actions";
import { PhotoThumb } from "./day-photo";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayName = (day: string, i: number) => `${WEEKDAYS[i]} ${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

const CELL: Record<TaskState, [string, string]> = {
  approved: ["border-[#86EFAC] bg-[#DCFCE7] text-[#15803D]", "✓"],
  rejected: ["border-[#FCA5A5] bg-[#FEE2E2] text-[#B91C1C]", "✕"],
  checked_off: ["border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]", "•"],
  not_done: ["border-[#E5E7EB] bg-white", ""],
};
const OFF = "border-[#F3F4F6] bg-[repeating-linear-gradient(45deg,#F3F4F6_0_4px,#fff_4px_8px)]";

type Change = Record<string, TaskState>;

// The week grid: Tasks down, Monday to Friday across. Taps show at once and
// are saved in the background; the server's answer then replaces them.
export function HistoryGrid({
  childName,
  week,
  photos,
  today,
  bonus,
  allDone = true,
  bare = false,
}: {
  childName: string;
  week: HistoryWeek;
  photos: Record<string, DayPhoto>;
  today: string;
  // The Home decides the Weekly bonus in the footer; History only shows it.
  bonus?: ReactNode;
  // "All done this week", left out of the Home's current week.
  allDone?: boolean;
  // Inside a card that is already drawn.
  bare?: boolean;
}) {
  const [, start] = useTransition();
  const [changes, change] = useOptimistic<Change, Change>({}, (now, next) => ({ ...now, ...next }));

  const days: HistoryDay[] = week.days.map((d) => ({
    ...d,
    cells: d.cells.map((s, i) => (s === null ? null : (changes[`${week.tasks[i].id}/${d.day}`] ?? s))),
  }));
  const counts = days.map(dayCount);
  const undecided = (d: HistoryDay) =>
    d.kind === "open"
      ? d.cells.flatMap((s, i) => (s === "not_done" || s === "checked_off" ? [{ taskId: week.tasks[i].id, day: d.day }] : []))
      : [];

  const tap = (taskId: string, day: string, state: TaskState) => {
    const approved = tapped(state);
    start(async () => {
      change({ [`${taskId}/${day}`]: approved ? "approved" : "rejected" });
      await decide(taskId, day, approved);
    });
  };
  const approveAll = (cells: { taskId: string; day: string }[]) =>
    start(async () => {
      change(Object.fromEntries(cells.map((c) => [`${c.taskId}/${c.day}`, "approved" as const])));
      await approveUndecided(cells);
    });

  const weekUndecided = days.flatMap(undecided);
  const got = counts.reduce((sum, c) => sum + c.stars, 0);
  const max = counts.reduce((sum, c) => sum + c.max, 0);
  const hasPhotos = days.some((d) => photos[d.day]);

  return (
    <article className={bare ? "border-t border-[#E5E7EB]" : "overflow-hidden rounded-xl bg-white shadow-sm"}>
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(5,44px)] items-center gap-x-1 gap-y-1.5 py-3 pr-2.5 pl-3">
        <div />
        {days.map((d, i) => (
          <div key={d.day} className="text-center text-[11px] leading-tight font-bold tracking-wide text-[#6B7280] uppercase">
            {WEEKDAYS[i]}
            <b
              className={`mx-auto block w-6.5 text-sm tracking-normal ${d.day === today ? "rounded-full bg-[#1F2430] text-white" : "text-[#1F2430]"}`}
            >
              {Number(d.day.slice(8, 10))}
            </b>
          </div>
        ))}

        <div className="text-xs font-semibold text-[#6B7280]">
          {days.some((d) => d.kind === "open") ? "Tap a cell to set it" : ""}
        </div>
        {days.map((d, i) => {
          const cells = undecided(d);
          return (
            <button
              key={d.day}
              onClick={() => approveAll(cells)}
              disabled={cells.length === 0}
              aria-label={`Approve all of ${dayName(d.day, i)}`}
              className="rounded-md bg-[#EFF6FF] py-1 text-center text-xs font-bold text-[#2563EB] disabled:invisible"
            >
              All
            </button>
          );
        })}

        {hasPhotos && (
          <>
            <div className="text-xs font-semibold text-[#6B7280]">Photo</div>
            {days.map((d, i) => {
              const photo = photos[d.day];
              const waitingIds = d.cells.flatMap((s, j) => (s === "checked_off" ? [week.tasks[j].id] : []));
              return photo ? (
                <PhotoThumb key={d.day} childName={childName} day={d.day} photo={photo} waitingIds={waitingIds} className="mx-auto" />
              ) : (
                <div key={d.day} aria-label={`${dayName(d.day, i)}: no photo`} />
              );
            })}
          </>
        )}

        {week.tasks.map((t, ti) => (
          <Fragment key={t.id}>
            <div className="flex min-w-0 items-center gap-1.5 text-[13px] leading-tight">
              <span aria-hidden>{taskEmoji(t.icon)}</span>
              <span className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]">{t.name}</span>
            </div>
            {days.map((d, i) => {
              const state = d.cells[ti];
              const name = `${t.name}, ${dayName(d.day, i)}`;
              if (state === null)
                return <button key={d.day} disabled aria-label={`${name}: nothing to set`} className={`mx-auto size-10 rounded-[10px] border-[1.5px] ${OFF}`} />;
              const [cls, mark] = CELL[state];
              const dashed = state === "not_done" && d.empty && d.cells.every((s) => s === null || s === "not_done");
              return (
                <button
                  key={d.day}
                  disabled={d.kind !== "open"}
                  onClick={() => tap(t.id, d.day, state)}
                  aria-label={`${name}: ${state.replace("_", " ")}`}
                  className={`mx-auto grid size-10 place-items-center rounded-[10px] border-[1.5px] text-base font-extrabold ${cls} ${dashed ? "border-dashed border-[#93C5FD]" : ""}`}
                >
                  {mark}
                </button>
              );
            })}
          </Fragment>
        ))}

        <div className="text-xs font-semibold text-[#6B7280]">★ per day</div>
        {counts.map((c, i) => (
          <div key={days[i].day} className="text-center text-xs font-bold text-[#6B7280] tabular-nums">
            {c.max ? `${c.stars}/${c.max}` : ""}
          </div>
        ))}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[#E5E7EB] px-4 py-3 text-sm">
        <p className="text-[#6B7280]">
          From Tasks <b className="text-[#1F2430]">{got}/{max} ★</b>
          {week.bonus && !bonus && (
            <>
              <br />
              Weekly bonus: {bonusLine(week)}
            </>
          )}
        </p>
        {week.bonus?.judgeable && max > 0 && got === max && (
          <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-xs font-bold text-[#15803D]">Perfect week</span>
        )}
        <span className="flex-1" />
        {allDone && weekUndecided.length > 0 && (
          <button
            onClick={() => approveAll(weekUndecided)}
            className="rounded-lg bg-[#2563EB] px-3 py-2 text-sm font-bold whitespace-nowrap text-white active:bg-[#1D4ED8]"
          >
            All done{bonus ? "" : " this week"} ({weekUndecided.length})
          </button>
        )}
        {bonus && <span className="flex">{bonus}</span>}
      </footer>
    </article>
  );
}

// Shown only: the Weekly bonus is decided on the Home.
function bonusLine({ bonus, contracts }: HistoryWeek) {
  if (!bonus) return "";
  if (bonus.granted === true) return `granted +${bonus.size} ★`;
  if (bonus.granted === false || contracts.at(-1)?.closed_on) return "no bonus";
  return bonus.judgeable ? "not decided yet" : "from Friday";
}

"use client";

import { useState, useTransition } from "react";
import type { InboxDay, InboxWeek } from "@/lib/inbox";
import { addDays } from "@/lib/today";
import { weekRange } from "@/lib/weeks";
import { decideWeeklyBonus } from "./actions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

type Props = { contractId: string; size: number; today: string };

// The week cards atop a child's Inbox section: one for every finished week
// still to decide, oldest first, and a one-line receipt for the latest one once
// decided. The receipt stays until the next week can be decided.
export function WeekCards({ weeks, ...props }: Props & { weeks: InboxWeek[] }) {
  const latest = weeks.find((w) => w.judgeable);
  const pending = weeks.filter((w) => w.judgeable && w.granted === null).reverse();
  return (
    <>
      {latest && latest.granted !== null && <Receipt key={latest.monday} week={latest} {...props} />}
      {pending.map((w) => (
        <WeekCard key={w.monday} week={w} {...props} />
      ))}
    </>
  );
}

function WeekCard({ week, contractId, size, today, onDone }: Props & { week: InboxWeek; onDone?: () => void }) {
  const [pending, start] = useTransition();
  const decide = (granted: boolean) =>
    start(async () => {
      await decideWeeklyBonus(contractId, week.monday, granted);
      onDone?.();
    });
  const friday = addDays(week.monday, 4);
  return (
    <article className="flex flex-col gap-3 rounded-xl bg-white px-4 py-3.5 shadow-sm">
      <div>
        <h3 className="font-bold">Week of {weekRange(week.monday)}</h3>
        <p className="text-xs text-[#6B7280]">Weekly bonus in this Contract: +{size} ★</p>
      </div>
      <div className="flex items-end gap-1.5">
        {week.days.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1 text-[11px] text-[#6B7280]">
            <DayBar day={d} className="h-9 rounded-md" />
            {WEEKDAYS[i]}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <b className="text-lg">{week.fromTasks}</b>
        <span className="text-[#6B7280]">of {week.max} ★ from Tasks</span>
        {week.perfect && <PerfectBadge />}
      </div>
      {week.waiting > 0 && (
        <p className="text-xs leading-snug text-[#6B7280]">
          {week.waiting} Check-off{week.waiting > 1 ? "s" : ""} still waiting. You can decide now or after approving{" "}
          {week.waiting > 1 ? "them" : "it"}.
        </p>
      )}
      {today === friday && (
        <p className="text-xs leading-snug text-[#6B7280]">Friday&apos;s Tasks can still be checked off until 22:00 tomorrow.</p>
      )}
      <div className="flex justify-end gap-2">
        <button
          disabled={pending}
          onClick={() => decide(false)}
          className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm font-bold text-[#374151] disabled:opacity-50"
        >
          No bonus
        </button>
        <button
          disabled={pending}
          onClick={() => decide(true)}
          className="rounded-lg bg-[#2563EB] px-3 py-2 text-sm font-bold text-white active:bg-[#1D4ED8] disabled:opacity-50"
        >
          Grant +{size} ★
        </button>
      </div>
    </article>
  );
}

// A decided week folded to one line; Change reopens its card.
function Receipt({ week, ...props }: Props & { week: InboxWeek }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <WeekCard week={week} {...props} onDone={() => setEditing(false)} />;
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white px-4 py-2.5 text-sm shadow-sm">
      <div className="min-w-0 flex-1">
        Week of {weekRange(week.monday)}
        <small className="block text-xs text-[#6B7280]">
          {week.fromTasks} of {week.max} ★ from Tasks
        </small>
      </div>
      <Chip granted={week.granted} size={props.size} onClick={() => setEditing(true)} />
      <button onClick={() => setEditing(true)} className="text-sm text-[#2563EB]">
        Change
      </button>
    </div>
  );
}

// Every week of the open Contract, newest first, with its bonus. An undecided
// finished week can be decided inline, and tapping a bonus changes it.
export function AllWeeks({ weeks, ...props }: Props & { weeks: InboxWeek[] }) {
  return (
    <details className="rounded-xl bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-2.5 text-sm text-[#2563EB]">All weeks and bonuses</summary>
      <div className="flex flex-col divide-y divide-[#F0F1F3] border-t border-[#E5E7EB]">
        {weeks.map((w) => (
          <WeekRow key={w.monday} week={w} {...props} />
        ))}
      </div>
      <p className="px-4 py-2.5 text-xs text-[#6B7280]">Tap a bonus to change it while the Contract is open.</p>
    </details>
  );
}

function WeekRow({ week, contractId, size, today }: Props & { week: InboxWeek }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const decide = (granted: boolean) =>
    start(async () => {
      await decideWeeklyBonus(contractId, week.monday, granted);
      setEditing(false);
    });
  const hot = week.judgeable && week.granted === null;
  const thisWeek = week.monday <= today && today <= addDays(week.monday, 6);
  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 ${hot ? "bg-[#FFFBEB]" : ""}`}>
      <div className="w-21 flex-none">
        <b className="block text-sm">{thisWeek ? "This week" : weekRange(week.monday)}</b>
        <small className="text-xs text-[#6B7280]">
          {week.fromTasks}/{week.max} ★{week.perfect ? " · perfect" : ""}
        </small>
      </div>
      <div className="flex h-5.5 min-w-10 flex-1 items-end gap-0.75">
        {week.days.map((d, i) => (
          <DayBar key={i} day={d} className="h-full flex-1 rounded-[3px]" />
        ))}
      </div>
      <div className="flex min-w-21 flex-none justify-end gap-1">
        {hot || editing ? (
          <>
            <button
              disabled={pending}
              onClick={() => decide(false)}
              className="rounded-lg border border-[#D1D5DB] px-2 py-1 text-[13px] font-bold text-[#374151] disabled:opacity-50"
            >
              No
            </button>
            <button
              disabled={pending}
              onClick={() => decide(true)}
              className="rounded-lg bg-[#2563EB] px-2 py-1 text-[13px] font-bold text-white disabled:opacity-50"
            >
              +{size}
            </button>
          </>
        ) : week.judgeable ? (
          <Chip granted={week.granted} size={size} onClick={() => setEditing(true)} />
        ) : (
          <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[13px] font-bold whitespace-nowrap text-[#6B7280]">
            after Fri
          </span>
        )}
      </div>
    </div>
  );
}

function Chip({ granted, size, onClick }: { granted: boolean | null; size: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold whitespace-nowrap ${
        granted ? "bg-[#DBEAFE] text-[#1D4ED8]" : "bg-[#F3F4F6] text-[#6B7280]"
      }`}
    >
      {granted ? `+${size} bonus` : "No bonus"}
    </button>
  );
}

function PerfectBadge() {
  return <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-xs font-bold text-[#15803D]">Perfect week</span>;
}

// One day's counted Tasks as a filled bar, with waiting Check-offs stacked on
// top in amber. A day outside the Contract or still to come is dashed.
function DayBar({ day, className }: { day: InboxDay | null; className: string }) {
  if (!day || day.rows.length === 0)
    return <i className={`block w-full border border-dashed border-[#D1D5DB] ${className}`} />;
  const pct = (n: number) => `${(n / day.rows.length) * 100}%`;
  return (
    <i className={`relative block w-full overflow-hidden bg-[#E5E7EB] ${className}`}>
      <span className="absolute inset-x-0 bottom-0 bg-[#2563EB]" style={{ height: pct(day.stars) }} />
      <span className="absolute inset-x-0 bg-[#FCD34D]" style={{ bottom: pct(day.stars), height: pct(day.waiting) }} />
    </i>
  );
}

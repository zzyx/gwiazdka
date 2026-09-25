"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import type { Board, BoardTask } from "@/lib/child-board";
import { taskEmoji } from "@/lib/task-icons";
import { addDays, formatPln, starsWord, type TaskState } from "@/lib/today";
import { setCheckOff } from "./actions";
import { Star } from "./star";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const weekday = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
const shortDate = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
const longDate = (day: string) =>
  `${WEEKDAYS_LONG[weekday(day)]} ${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

export function TodayBoard({ name, board }: { name: string; board: Board }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-8">
      <header className="flex items-center justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div>
          <h1 className="text-[26px] leading-none font-extrabold">Hi {name}!</h1>
          <p className="mt-1 text-sm font-semibold text-[#4B5A8C]">{longDate(board.today)}</p>
        </div>
        {board.balance && <Balance {...board.balance} />}
      </header>
      <WeekStrip board={board} />
      {board.selected ? (
        <DayTasks board={board} selected={board.selected} />
      ) : (
        <Weekend openFriday={board.openFriday} />
      )}
    </main>
  );
}

// Tapping swaps the Star count for its PLN value, and back.
function Balance({ stars, groszePerStar }: { stars: number; groszePerStar: number }) {
  const [pln, setPln] = useState(false);
  return (
    <button
      onClick={() => setPln(!pln)}
      aria-label={pln ? "Show gwiazdki" : "Show money"}
      className="flex min-w-27 flex-col items-center rounded-[22px] bg-[#FFC93C] px-4 pt-2 pb-1.5 shadow-[0_4px_0_#D99A00] active:translate-y-0.5"
    >
      {pln ? (
        <>
          <span className="text-[26px] leading-none font-extrabold">{formatPln(stars * groszePerStar)}</span>
          <small className="text-xs font-semibold">
            {stars} {starsWord(stars)}
          </small>
        </>
      ) : (
        <>
          <span className="flex items-center gap-1.5 text-[30px] leading-none font-extrabold">
            <Star className="size-7" fill="#fff" />
            {stars}
          </span>
          <small className="text-xs font-semibold">{starsWord(stars)}</small>
        </>
      )}
    </button>
  );
}

function WeekStrip({ board }: { board: Board }) {
  return (
    <nav className="grid grid-cols-5 gap-1.5 px-3.5 pb-3.5">
      {board.week.map((d) => {
        const selected = board.selected?.day === d.day;
        const content = (
          <>
            {d.waiting && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#FF8A3D]" aria-label="waiting" />}
            <b className="text-[13px]">{WEEKDAYS[weekday(d.day)]}</b>
            <i className={`text-[11px] not-italic ${selected ? "text-[#C5D0FF]" : "text-[#4B5A8C]"}`}>{shortDate(d.day)}</i>
            <span className="mt-0.5 flex items-center gap-0.5 text-[13px] font-bold">
              {d.future ? " " : (<><Star className="size-3.5" />{d.stars}</>)}
            </span>
          </>
        );
        const cls = `relative flex flex-col items-center rounded-[14px] pt-1.5 pb-1 leading-tight ${
          selected ? "bg-[#1E2A5A] text-white shadow-[0_3px_0_#0E163A]" : "bg-white shadow-[0_3px_0_#B9D6F2]"
        } ${d.day === board.today ? "outline-3 outline-[#1E2A5A]" : ""} ${d.future ? "opacity-45" : ""}`;
        return d.future ? (
          <div key={d.day} className={cls}>{content}</div>
        ) : (
          <Link key={d.day} href={`/?day=${d.day}`} replace scroll={false} className={cls}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

function DayTasks({ board, selected }: { board: Board; selected: NonNullable<Board["selected"]> }) {
  const [tasks, setOptimistic] = useOptimistic(
    selected.tasks,
    (current: BoardTask[], change: { id: string; state: TaskState }) =>
      current.map((t) => (t.id === change.id ? { ...t, state: change.state } : t)),
  );
  const [popped, setPopped] = useState<string>();
  const [, startTransition] = useTransition();
  const isToday = selected.day === board.today;
  const done = tasks.filter((t) => t.state !== "not_done" && t.state !== "rejected").length;

  function toggle(task: BoardTask) {
    const checking = task.state === "not_done";
    setPopped(checking ? task.id : undefined);
    startTransition(async () => {
      setOptimistic({ id: task.id, state: checking ? "checked_off" : "not_done" });
      await setCheckOff(task.id, selected.day, checking);
    });
  }

  return (
    <>
      <h2 className="flex items-baseline justify-between px-5 pb-2 text-xl font-extrabold">
        {isToday ? "Today" : WEEKDAYS_LONG[weekday(selected.day)]}
        <small className="text-sm font-semibold text-[#4B5A8C]">
          {done} of {tasks.length} done
        </small>
      </h2>
      {!board.balance ? (
        <Note grey>Waiting for a new contract. Ask your parent!</Note>
      ) : !selected.canChange ? (
        <Note grey>This day can&apos;t be changed any more.</Note>
      ) : !isToday ? (
        <Note>
          {selected.day === addDays(board.today, -1) ? "Yesterday" : WEEKDAYS_LONG[weekday(selected.day)]} is still open
          until 22:00.
        </Note>
      ) : null}
      <div className="grid grid-cols-2 gap-3 px-4">
        {tasks.map((t) => (
          <Tile
            key={t.id}
            task={t}
            popped={popped === t.id && t.state === "checked_off"}
            onTap={selected.canChange && (t.state === "not_done" || t.state === "checked_off") ? () => toggle(t) : undefined}
          />
        ))}
      </div>
    </>
  );
}

const TILE: Record<TaskState, { box: string; corner?: string; label: string }> = {
  not_done: { box: "bg-white border-dashed border-[#9FB7D9]", label: "Not done yet" },
  checked_off: { box: "bg-[#FFE9A8] border-[#E3A600]", corner: "bg-[#E3A600]", label: "Waiting for a check" },
  approved: { box: "bg-[#C8F2D8] border-[#2E9E5E]", corner: "bg-[#2E9E5E]", label: "Counted" },
  rejected: { box: "bg-[#E4E8EF] border-[#C3CAD6] text-[#6B7590]", label: "Not counted" },
};

function Tile({ task, popped, onTap }: { task: BoardTask; popped: boolean; onTap?: () => void }) {
  const look = TILE[task.state];
  return (
    <button
      onClick={onTap}
      disabled={!onTap}
      aria-pressed={task.state !== "not_done"}
      className={`relative flex min-h-32 flex-col gap-1.5 rounded-[20px] border-3 px-3 pt-3.5 pb-3 text-left transition-transform active:scale-[.97] disabled:active:scale-100 ${look.box} ${popped ? "animate-[pop_.35s]" : ""}`}
    >
      {look.corner && (
        <span className={`absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full text-base font-extrabold text-white ${look.corner}`}>
          {task.state === "approved" ? "✓" : "⏳"}
        </span>
      )}
      <span className={`text-[38px] leading-none ${task.state === "rejected" ? "opacity-50 grayscale" : ""}`}>
        {taskEmoji(task.icon)}
      </span>
      <span className="text-[17px] leading-tight font-bold">{task.name}</span>
      <span className="mt-auto flex items-center gap-1 text-[13px] font-bold">
        {task.state === "approved" && (<><Star className="size-4.5" />+1 ·{" "}</>)}
        {look.label}
      </span>
      {popped && (
        <span className="pointer-events-none absolute top-[30%] left-1/2 animate-[rise_.7s_forwards] text-3xl">⭐</span>
      )}
    </button>
  );
}

function Weekend({ openFriday }: { openFriday: Board["openFriday"] }) {
  return (
    <>
      <div className="mx-4 my-2 flex flex-col items-center gap-2.5 rounded-3xl bg-white px-5 py-7 text-center">
        <div className="text-6xl leading-none">☀️</div>
        <h2 className="text-[26px] font-extrabold">No school today!</h2>
        <p className="font-semibold text-[#4B5A8C]">Enjoy the weekend.</p>
      </div>
      {openFriday && (
        <Note>
          Friday is still open until 22:00.{" "}
          {openFriday.left > 0 ? `${openFriday.left} left.` : ""}
          <Link
            href={`/?day=${openFriday.day}`}
            replace
            className="mt-2 block w-fit rounded-2xl bg-[#1E2A5A] px-4 py-2.5 font-bold text-white shadow-[0_3px_0_#0E163A]"
          >
            Open Friday
          </Link>
        </Note>
      )}
    </>
  );
}

function Note({ children, grey = false }: { children: React.ReactNode; grey?: boolean }) {
  return (
    <div
      className={`mx-4 mb-3 rounded-[14px] border-2 border-dashed px-3.5 py-2.5 text-[15px] leading-snug font-semibold ${
        grey ? "border-[#AAB6CC] bg-[#EDF2F8] text-[#4B5A8C]" : "border-[#E3A600] bg-[#FFF1C2]"
      }`}
    >
      {children}
    </div>
  );
}

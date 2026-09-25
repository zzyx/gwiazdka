"use client";

import { Check, Clock, Moon, X } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import type { Board, BoardTask } from "@/lib/child-board";
import { addDays, formatPln, starsWord, type TaskState } from "@/lib/today";
import { setCheckOff } from "./actions";
import { LookButton } from "./look";
import { Star } from "./star";
import { TaskIcon } from "./task-icon";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const weekday = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
const longDate = (day: string) =>
  `${WEEKDAYS_LONG[weekday(day)]} ${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

export function TodayBoard({ name, board }: { name: string; board: Board }) {
  const shown = board.selected?.tasks ?? [];
  const approved = shown.filter((t) => t.state === "approved").length;
  const ring = shown.length ? Math.round((approved / shown.length) * 100) : 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-10">
      <header className="flex items-center gap-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-(--mn-muted)">{longDate(board.today)}</p>
          <h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight">Hey, {name}</h1>
        </div>
        <LookButton />
        {board.balance && <Balance {...board.balance} ring={ring} />}
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

// Tapping swaps the Star count for its PLN value, and back. The ring fills with the
// share of the shown day's Tasks that are approved.
function Balance({ stars, groszePerStar, ring }: { stars: number; groszePerStar: number; ring: number }) {
  const [pln, setPln] = useState(false);
  return (
    <button
      onClick={() => setPln(!pln)}
      aria-label={pln ? "Show gwiazdki" : "Show money"}
      style={{ "--p": ring } as React.CSSProperties}
      className="mn-ring relative flex size-24 shrink-0 flex-col items-center justify-center rounded-full border border-(--mn-line) bg-(--mn-card) active:scale-95"
    >
      {pln ? (
        <>
          <span className="text-lg leading-none font-extrabold text-(--mn-acc-ink) tabular-nums">
            {formatPln(stars * groszePerStar)}
          </span>
          <small className="mt-1 text-[10px] text-(--mn-muted)">
            {stars} {starsWord(stars)}
          </small>
        </>
      ) : (
        <>
          <span className="flex items-center gap-1 text-[26px] leading-none font-extrabold text-(--mn-acc-ink) tabular-nums">
            <Star className="size-5" />
            {stars}
          </span>
          <small className="mt-1 text-[10px] text-(--mn-muted)">{starsWord(stars)}</small>
        </>
      )}
    </button>
  );
}

function WeekStrip({ board }: { board: Board }) {
  return (
    <nav className="flex gap-1.5 px-4 pb-5">
      {board.week.map((d) => {
        const selected = board.selected?.day === d.day;
        const content = (
          <>
            {d.waiting && (
              <span
                className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-(--mn-bg) bg-(--mn-wait) box-content"
                aria-label="waiting"
              />
            )}
            <b className={`text-[11px] font-semibold tracking-widest uppercase ${selected ? "opacity-60" : "text-(--mn-muted)"}`}>
              {WEEKDAYS[weekday(d.day)]}
            </b>
            <span className="text-base font-bold tabular-nums">{Number(d.day.slice(8, 10))}</span>
            <span className="flex h-1.5 gap-0.5" aria-label={d.future ? undefined : `${d.stars} ${starsWord(d.stars)}`}>
              {Array.from({ length: d.tasks }, (_, i) => (
                <i
                  key={i}
                  className={`size-1.5 rounded-full ${
                    !d.future && i < d.stars ? "bg-(--acc)" : selected ? "bg-(--mn-muted)/50" : "bg-(--mn-line)"
                  }`}
                />
              ))}
            </span>
          </>
        );
        const cls = `relative flex flex-1 flex-col items-center gap-1.5 rounded-2xl border py-2.5 ${
          selected
            ? "border-(--mn-ink) bg-(--mn-ink) text-(--mn-bg)"
            : d.day === board.today
              ? "border-(--mn-acc-ink) bg-(--mn-card)"
              : "border-(--mn-line) bg-(--mn-card)"
        } ${d.future ? "opacity-35" : ""}`;
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
      <h2 className="flex items-center justify-between px-5 pb-3 text-lg font-bold">
        {isToday ? "Today" : WEEKDAYS_LONG[weekday(selected.day)]}
        <small className="rounded-full border border-(--mn-line) bg-(--mn-card) px-2.5 py-1 text-xs font-normal text-(--mn-muted) tabular-nums">
          {done} / {tasks.length} done
        </small>
      </h2>
      {!board.balance ? (
        <Note grey>Waiting for a new contract. Ask your parent.</Note>
      ) : !selected.canChange ? (
        <Note grey>This day can&apos;t be changed any more.</Note>
      ) : !isToday ? (
        <Note>
          {selected.day === addDays(board.today, -1) ? "Yesterday" : WEEKDAYS_LONG[weekday(selected.day)]} is still open
          until 22:00.
        </Note>
      ) : null}
      <div className="grid grid-cols-2 gap-2.5 px-4">
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

const TILE: Record<TaskState, { box: string; accent: string; badge: string; label: string }> = {
  not_done: {
    box: "border-(--mn-line) bg-(--mn-card)",
    accent: "text-(--mn-muted)",
    badge: "border-(--mn-line)",
    label: "Not done yet",
  },
  checked_off: {
    box: "border-(--mn-wait)/60 bg-(--mn-wait)/10",
    accent: "text-(--mn-wait)",
    badge: "border-(--mn-wait) bg-(--mn-wait) text-(--mn-bg)",
    label: "Waiting for a check",
  },
  approved: {
    box: "border-(--acc)/55 bg-(--acc)/10",
    accent: "text-(--mn-acc-ink)",
    badge: "border-(--acc) bg-(--acc) text-[#1A1405]",
    label: "Counted",
  },
  rejected: {
    box: "border-(--mn-line) bg-(--mn-card) opacity-55",
    accent: "text-(--mn-muted)",
    badge: "border-(--mn-line) text-(--mn-muted)",
    label: "Not counted",
  },
};

function Tile({ task, popped, onTap }: { task: BoardTask; popped: boolean; onTap?: () => void }) {
  const look = TILE[task.state];
  return (
    <button
      onClick={onTap}
      disabled={!onTap}
      aria-pressed={task.state !== "not_done"}
      className={`relative flex min-h-31 flex-col gap-3.5 rounded-[20px] border p-3.5 text-left transition-transform active:scale-[.97] disabled:active:scale-100 ${look.box} ${popped ? "animate-[glow_.6s]" : ""}`}
    >
      <TaskIcon icon={task.icon} className={`size-5.5 text-[22px] ${look.accent}`} />
      <span className={`absolute top-3 right-3 grid size-6 place-items-center rounded-full border-[1.5px] ${look.badge}`}>
        {task.state === "approved" ? (
          <Check className="size-3.5" strokeWidth={3} />
        ) : task.state === "checked_off" ? (
          <Clock className="size-3.5" strokeWidth={2.5} />
        ) : task.state === "rejected" ? (
          <X className="size-3.5" strokeWidth={2.5} />
        ) : null}
      </span>
      <span className={`text-[15px] leading-tight font-semibold ${task.state === "rejected" ? "line-through" : ""}`}>
        {task.name}
      </span>
      <span className={`mt-auto flex items-center gap-1 text-xs ${look.accent}`}>
        {task.state === "approved" && (<><Star className="size-3.5" />+1 ·{" "}</>)}
        {look.label}
      </span>
      {popped && (
        <Star className="pointer-events-none absolute top-3.5 right-4 size-6 animate-[rise_.7s_forwards] text-(--acc)" />
      )}
    </button>
  );
}

function Weekend({ openFriday }: { openFriday: Board["openFriday"] }) {
  return (
    <>
      <div className="mx-4 mb-3 flex flex-col items-center gap-2 rounded-3xl border border-(--mn-line) bg-(--mn-card) px-5 py-8 text-center">
        <Moon className="mb-1 size-10 text-(--mn-acc-ink)" strokeWidth={1.8} aria-hidden />
        <h2 className="text-[22px] font-bold">No school today</h2>
        <p className="text-(--mn-muted)">Enjoy the weekend.</p>
      </div>
      {openFriday && (
        <Note>
          Friday is still open until 22:00.{" "}
          {openFriday.left > 0 ? `${openFriday.left} left.` : ""}
          <Link
            href={`/?day=${openFriday.day}`}
            replace
            className="mt-2.5 block w-fit rounded-xl bg-(--acc) px-4 py-2.5 font-bold text-[#1A1405]"
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
      className={`mx-4 mb-3 rounded-2xl border px-3.5 py-3 text-sm leading-snug ${
        grey ? "border-(--mn-line) bg-(--mn-card) text-(--mn-muted)" : "border-(--mn-wait)/40 bg-(--mn-wait)/12"
      }`}
    >
      {children}
    </div>
  );
}

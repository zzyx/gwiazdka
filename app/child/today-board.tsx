"use client";

import { type LucideIcon, Check, ChevronLeft, ChevronRight, Clock, FileText, Moon, Sun, Undo2, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import type { Board, BoardTask, Recap, WeekBonus } from "@/lib/child-board";
import { RECAP_HIDDEN_COOKIE } from "@/lib/recap";
import { addDays, formatPln, starsWord, type TaskState } from "@/lib/today";
import { dayMonth, mondayOf, weekRange, weekTitle } from "@/lib/weeks";
import { setCheckOff } from "./actions";
import { LookButton } from "./look";
import { Star } from "./star";
import { TaskIcon } from "./task-icon";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const weekday = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
const longDate = (day: string) => `${WEEKDAYS_LONG[weekday(day)]} ${dayMonth(day)}`;

export function TodayBoard({
  name,
  board,
  contractNew,
  recapHidden,
}: {
  name: string;
  board: Board;
  contractNew: boolean;
  recapHidden?: string;
}) {
  const shown = board.selected?.tasks ?? [];
  const approved = shown.filter((t) => t.state === "approved").length;
  const ring = shown.length ? Math.round((approved / shown.length) * 100) : 0;
  const thisWeek = board.monday === mondayOf(board.today);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))]">
      <header className="flex items-center gap-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-(--mn-muted)">{longDate(board.today)}</p>
          <h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight">Hey, {name}</h1>
        </div>
        <ContractButton isNew={contractNew} />
        <LookButton />
        {board.balance && <Balance {...board.balance} ring={ring} />}
      </header>
      {board.recap && board.recap.monday !== recapHidden && (
        <RecapCard key={board.recap.monday} recap={board.recap} today={board.today} />
      )}
      <WeekBar board={board} />
      <WeekStrip board={board} />
      {board.selected ? (
        <DayTasks key={board.selected.day} board={board} selected={board.selected} />
      ) : (
        <Weekend openFriday={board.openFriday} />
      )}
      <WeekTotal board={board} />
      {!thisWeek && (
        <Link
          href="/"
          replace
          scroll={false}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-(--mn-ink) px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap text-(--mn-bg) shadow-[0_6px_18px_rgba(0,0,0,.35)] active:scale-95"
        >
          <Undo2 className="size-4" aria-hidden />
          Back to today
        </Link>
      )}
    </main>
  );
}

// Opens the "Your Contract" page. A dot marks a Contract the child hasn't looked at yet.
function ContractButton({ isNew }: { isNew: boolean }) {
  return (
    <Link
      href="/contract"
      aria-label={isNew ? "Your Contract (new)" : "Your Contract"}
      className="relative grid size-9 shrink-0 place-items-center rounded-full border border-(--mn-line) bg-(--mn-card) text-(--mn-muted) active:scale-95"
    >
      <FileText className="size-4.5" strokeWidth={2} aria-hidden />
      {isNew && (
        <span className="absolute -top-0.5 -right-0.5 box-content size-2 rounded-full border-2 border-(--mn-bg) bg-(--acc)" />
      )}
    </Link>
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

// ‹ and › step a week back or forward, with the week's name between them.
function WeekBar({ board }: { board: Board }) {
  const lastWeek = addDays(mondayOf(board.today), -7);
  const context =
    board.monday >= lastWeek
      ? weekRange(board.monday)
      : !board.contract
        ? "No Contract"
        : board.contract.paidOn
          ? `Paid out ${dayMonth(board.contract.paidOn)}`
          : "This Contract";
  return (
    <div className="flex items-center gap-2 px-4 pb-2.5">
      <Arrow href={board.prev} label="Previous week">
        <ChevronLeft className="size-4.5" aria-hidden />
      </Arrow>
      <div className="flex min-w-0 flex-1 flex-col items-center text-center">
        <b className="text-[15px] font-bold">{weekTitle(board.monday, board.today)}</b>
        <small className="max-w-full truncate text-xs text-(--mn-muted)">{context}</small>
      </div>
      <Arrow href={board.next} label="Next week">
        <ChevronRight className="size-4.5" aria-hidden />
      </Arrow>
    </div>
  );
}

function Arrow({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const cls =
    "grid size-9 shrink-0 place-items-center rounded-full border border-(--mn-line) bg-(--mn-card) text-(--mn-ink)";
  return href ? (
    <Link href={href} replace scroll={false} aria-label={label} className={`${cls} active:scale-95`}>
      {children}
    </Link>
  ) : (
    <span aria-label={label} aria-disabled className={`${cls} opacity-30`}>
      {children}
    </span>
  );
}

// A sideways swipe on the strip moves a week like the arrows: right goes back in time.
function useWeekSwipe(board: Board) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      start.current = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      const href = dx > 0 ? board.prev : board.next;
      if (href) router.replace(href, { scroll: false });
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}

function WeekStrip({ board }: { board: Board }) {
  const swipe = useWeekSwipe(board);
  return (
    <nav {...swipe} className="flex touch-pan-y gap-1.5 px-4 pb-5">
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
        } ${d.future ? "opacity-35" : !d.inContract ? "opacity-55" : ""}`;
        return d.future ? (
          <div key={d.day} className={cls}>{content}</div>
        ) : (
          <Link key={d.day} href={`/?day=${d.day}`} replace scroll={false} draggable={false} className={cls}>
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
  const isYesterday = selected.day === addDays(board.today, -1);
  const past = selected.day < board.today;
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
      <h2 className="flex items-center justify-between gap-3 px-5 pb-3 text-lg font-bold">
        <span className="min-w-0 truncate">
          {isToday ? "Today" : isYesterday ? "Yesterday" : WEEKDAYS_LONG[weekday(selected.day)]}
          {!isToday && !isYesterday && (
            <small className="ml-1.5 text-[13px] font-medium text-(--mn-muted)">{dayMonth(selected.day)}</small>
          )}
        </span>
        <small className="shrink-0 rounded-full border border-(--mn-line) bg-(--mn-card) px-2.5 py-1 text-xs font-normal text-(--mn-muted) tabular-nums">
          {selected.contract ? `${done} / ${tasks.length} done` : "–"}
        </small>
      </h2>
      {!selected.contract ? (
        isToday ? (
          <Note grey>Waiting for a new Contract. Ask your parent.</Note>
        ) : (
          <Note grey icon={Sun}>No Contract that week, so nothing counted.</Note>
        )
      ) : selected.contract.paidOn ? (
        <Note grey icon={Wallet}>From your last Contract, paid out on {dayMonth(selected.contract.paidOn)}.</Note>
      ) : isToday ? null : selected.canChange ? (
        <Note>You can still change this day until 22:00 today.</Note>
      ) : (
        <Note grey>This day can&apos;t be changed any more.</Note>
      )}
      <div className="grid grid-cols-2 gap-2.5 px-4">
        {tasks.map((t) => (
          <Tile
            key={t.id}
            task={t}
            label={!selected.contract ? "No Contract" : past && !selected.canChange && t.state === "not_done" ? "Not done" : undefined}
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

// A label overrides the state's own: "Not done" on a past day, "No Contract"
// outside one (the tile then shows no state at all).
function Tile({ task, label, popped, onTap }: { task: BoardTask; label?: string; popped: boolean; onTap?: () => void }) {
  const off = label === "No Contract";
  const look = off ? { ...TILE.not_done, box: `${TILE.not_done.box} opacity-45` } : TILE[task.state];
  return (
    <button
      onClick={onTap}
      disabled={!onTap}
      aria-pressed={task.state !== "not_done"}
      className={`relative flex min-h-31 flex-col gap-3.5 rounded-[20px] border p-3.5 text-left transition-transform active:scale-[.97] disabled:active:scale-100 ${look.box} ${popped ? "animate-[glow_.6s]" : ""}`}
    >
      <TaskIcon icon={task.icon} className={`size-5.5 text-[22px] ${look.accent}`} />
      <span className={`absolute top-3 right-3 grid size-6 place-items-center rounded-full border-[1.5px] ${look.badge}`}>
        {off ? null : task.state === "approved" ? (
          <Check className="size-3.5" strokeWidth={3} />
        ) : task.state === "checked_off" ? (
          <Clock className="size-3.5" strokeWidth={2.5} />
        ) : task.state === "rejected" ? (
          <X className="size-3.5" strokeWidth={2.5} />
        ) : null}
      </span>
      <span className={`text-[15px] leading-tight font-semibold ${!off && task.state === "rejected" ? "line-through" : ""}`}>
        {task.name}
      </span>
      <span className={`mt-auto flex items-center gap-1 text-xs ${look.accent}`}>
        {!off && task.state === "approved" && (<><Star className="size-3.5" />+1 ·{" "}</>)}
        {label ?? look.label}
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

function Note({ children, grey = false, icon: Icon }: { children: React.ReactNode; grey?: boolean; icon?: LucideIcon }) {
  return (
    <div
      className={`mx-4 mb-3 flex items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-sm leading-snug ${
        grey ? "border-(--mn-line) bg-(--mn-card) text-(--mn-muted)" : "border-(--mn-wait)/40 bg-(--mn-wait)/12"
      }`}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// The shown week's Stars: from its Tasks, plus the Weekly bonus once granted.
function WeekTotal({ board }: { board: Board }) {
  const thisWeek = board.monday === mondayOf(board.today);
  const { stars, max, contractDays } = board.total;
  const { bonus } = board;
  const title = thisWeek
    ? bonus?.judgeable
      ? "This week"
      : "This week so far"
    : board.monday === addDays(mondayOf(board.today), -7)
      ? "Last week"
      : `Week of ${dayMonth(board.monday)}`;
  const bonusStars = bonus?.granted ? bonus.size : 0;
  return (
    <section className="mx-4 mt-5 flex flex-col gap-3 rounded-[20px] border border-(--mn-line) bg-(--mn-card) p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
          {title}
          {bonus?.perfect && <PerfectTag />}
        </h3>
        <b className="flex items-center gap-1 text-[22px] font-extrabold text-(--mn-acc-ink) tabular-nums">
          <Star className="size-4.5" />
          {stars + bonusStars}
        </b>
      </div>
      {contractDays === 0 ? (
        <p className="text-[13px] leading-snug text-(--mn-muted)">
          No Contract, so no gwiazdki this week. They only count inside a Contract.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Count label="From Tasks">
              <Star className="size-3.5" />
              {stars}
              <em className="text-xs font-medium text-(--mn-muted) not-italic">of {max}</em>
            </Count>
            <BonusCount bonus={bonus} />
          </div>
          {contractDays < 5 && (
            <p className="text-[13px] leading-snug text-(--mn-muted)">
              Only {contractDays} of the 5 days {thisWeek ? "are" : "were"} in a Contract.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function BonusCount({ bonus }: { bonus: WeekBonus | null }) {
  const note = (text: string) => <em className="text-xs font-medium text-(--mn-muted) not-italic">{text}</em>;
  if (bonus?.granted)
    return (
      <Count label="Weekly bonus" lit>
        <Star className="size-3.5" />+{bonus.size}
      </Count>
    );
  return (
    <Count label="Weekly bonus">
      {!bonus || bonus.size === 0 ? (
        <>0{note("none in this Contract")}</>
      ) : bonus.granted === false ? (
        <>0{note("not this week")}</>
      ) : bonus.judgeable ? (
        <>–{note("your parent decides soon")}</>
      ) : (
        <>–{note("decided after Friday")}</>
      )}
    </Count>
  );
}

function PerfectTag() {
  return (
    <span className="rounded-md border border-(--acc)/50 px-1.5 py-px text-[10px] font-bold tracking-wider text-(--mn-acc-ink) uppercase">
      Perfect week
    </span>
  );
}

// The week just judged, at the top of Today: its Stars and the Weekly bonus.
// The × hides it on this device until the next week's recap.
function RecapCard({ recap, today }: { recap: Recap; today: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const { fromTasks, max, bonus } = recap;
  const hide = () => {
    document.cookie = `${RECAP_HIDDEN_COOKIE}=${recap.monday}; path=/; max-age=31536000; samesite=lax`;
    setHidden(true);
  };
  const big = (n: number) => (
    <b className="flex items-center gap-1 text-2xl font-extrabold text-(--mn-acc-ink)">
      <Star className="size-5" />
      {n}
    </b>
  );
  const small = (text: string) => <span className="text-sm text-(--mn-muted)">{text}</span>;
  return (
    <section
      className={`relative mx-4 mb-3.5 flex flex-col gap-2.5 rounded-[20px] border p-4 ${
        bonus.granted
          ? "border-(--acc)/40 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--acc)_18%,var(--mn-card)),var(--mn-card)_70%)]"
          : "border-(--mn-line) bg-(--mn-card)"
      }`}
    >
      <button
        onClick={hide}
        aria-label="Hide"
        className="absolute top-2.5 right-2.5 grid size-7.5 place-items-center rounded-full text-(--mn-muted)"
      >
        <X className="size-4" aria-hidden />
      </button>
      <small className="flex flex-wrap items-center gap-2 pr-8 text-xs font-semibold tracking-wider text-(--mn-muted) uppercase">
        {recap.monday === mondayOf(today) ? "This week" : "Last week"} · {weekRange(recap.monday)}
        {bonus.perfect && bonus.granted !== null && <PerfectTag />}
      </small>
      <div className="flex flex-wrap items-baseline gap-2 tabular-nums">
        {bonus.granted ? (
          <>
            {big(fromTasks)}
            {small(`+ ${bonus.size} bonus =`)}
            {big(fromTasks + bonus.size)}
          </>
        ) : bonus.granted === false ? (
          <>
            {big(fromTasks)}
            {small("no Weekly bonus this time")}
          </>
        ) : (
          <>
            {big(fromTasks)}
            {small(`from Tasks${bonus.perfect ? " · every one counted" : ""}`)}
          </>
        )}
      </div>
      <p className="pr-6 text-[13px] leading-snug text-(--mn-muted)">
        {bonus.granted
          ? bonus.perfect
            ? "Every Task counted. Solid week."
            : "Weekly bonus granted. Nice."
          : bonus.granted === false
            ? `${fromTasks} of ${max} counted. Next week's another shot.`
            : `Your parent hasn't decided the Weekly bonus (+${bonus.size}) yet.`}
      </p>
    </section>
  );
}

function Count({ label, lit = false, children }: { label: string; lit?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`flex flex-col gap-0.5 rounded-2xl px-3 py-2.5 ${
        lit ? "bg-(--acc)/16 outline outline-(--acc)/45" : "bg-(--mn-line)/45"
      }`}
    >
      <small className="text-[11px] font-semibold tracking-wider text-(--mn-muted) uppercase">{label}</small>
      <b className={`flex flex-wrap items-center gap-1 text-base tabular-nums ${lit ? "text-(--mn-acc-ink)" : ""}`}>
        {children}
      </b>
    </div>
  );
}

import Link from "next/link";
import { dayBar, needsLook, type BoardWeek, type ChildBoard } from "@/lib/board";
import type { ChildColumn } from "@/lib/parent-board";
import { formatPln, warsawToday } from "@/lib/today";
import { mondayOf, weekRange, weekTitle } from "@/lib/weeks";
import { signOut } from "../sign-in/actions";
import { getBoard, joinPageUrl } from "./board-data";
import { BoardTabs } from "./board-tabs";
import { HistoryGrid } from "./history-grid";
import { JoinCodeButton } from "./join-code-button";
import { JoinQr } from "./join-qr";
import { Avatar, CHILD_COLORS, PageHeader, ParentShell } from "./shell";
import { BonusChip, BonusControl } from "./week-bonus";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
const historyHref = (childId: string, week?: string) =>
  `/history?child=${encodeURIComponent(childId)}${week ? `&week=${week}` : ""}`;

// The parent's Home (layout A, Board, of the parent home prototype): a column
// per child with a summary and the open Contract's weeks, newest first.
export async function ParentHome() {
  const columns = await getBoard();
  const today = warsawToday(new Date());
  const waiting = columns.reduce((sum, c) => sum + (c.board?.waiting ?? 0), 0);
  const joinUrl = await joinPageUrl();
  const connect = (c: ChildColumn) => (
    <JoinCodeButton
      childId={c.id}
      name={c.name}
      joinUrl={joinUrl}
      qr={<JoinQr url={joinUrl} />}
      label="Connect phone"
      className="font-semibold text-[#2563EB] disabled:opacity-50"
    />
  );

  return (
    <ParentShell section="home">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] lg:px-6">
        <PageHeader title="Home" waiting={waiting} />
        {columns.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-[#6B7280]">No children yet.</p>
        ) : (
          <BoardTabs
            tabs={columns.map((c) => ({ id: c.id, name: c.name, dot: !!c.board && needsLook(c.board) }))}
            columns={columns.map((c, i) => (
              <Column key={c.id} column={c} color={CHILD_COLORS[i % CHILD_COLORS.length]} today={today} connect={connect(c)} />
            ))}
          />
        )}
        <Legend />
        <div className="flex items-center justify-between px-0.5 text-[13px] text-[#6B7280]">
          <Link href="/history" className="underline">
            Older weeks and paid-out Contracts are in History
          </Link>
          <form action={signOut} className="lg:hidden">
            <button className="underline">Sign out</button>
          </form>
        </div>
      </main>
    </ParentShell>
  );
}

function Column({
  column,
  color,
  today,
  connect,
}: {
  column: ChildColumn;
  color: string;
  today: string;
  connect: React.ReactNode;
}) {
  const { board, contract } = column;
  if (!board || !contract)
    return (
      <section className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-3 shadow-sm">
        <Avatar name={column.name} color={color} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-bold">{column.name}</h2>
          <div className="text-xs text-[#6B7280]">
            No open Contract ·{" "}
            <Link href={`/contracts?child=${encodeURIComponent(column.id)}&sheet=create`} className="font-semibold text-[#2563EB]">
              Create one
            </Link>{" "}
            · {connect}
          </div>
        </div>
      </section>
    );

  return (
    <div className="flex flex-col gap-2.5">
      <Summary column={column} board={board} startsOn={contract.starts_on} color={color} connect={connect} />
      {board.weeks.map((w) => (
        <Week key={w.monday} column={column} contractId={contract.id} week={w} size={board.weeklyBonus} today={today} />
      ))}
    </div>
  );
}

function Summary({
  column,
  board,
  startsOn,
  color,
  connect,
}: {
  column: ChildColumn;
  board: ChildBoard;
  startsOn: string;
  color: string;
  connect: React.ReactNode;
}) {
  const first = board.emptyDays[0];
  const empty = board.emptyDays.length;
  return (
    <section className="rounded-xl bg-white shadow-sm">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <Avatar name={column.name} color={color} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-bold">{column.name}</h2>
          <div className="text-xs text-[#6B7280]">
            Contract from {short(startsOn)} · {connect}
          </div>
        </div>
        <p className="text-right leading-tight">
          <b className="text-xl tabular-nums">{board.stars} ★</b>
          <small className="block text-xs text-[#6B7280]">{formatPln(board.stars * board.groszePerStar)}</small>
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
        <Stat warn={board.waiting > 0}>
          <b>{board.waiting}</b> waiting
        </Stat>
        <Stat>
          This week <b>{board.thisWeek.stars}/{board.thisWeek.max}</b> ★
        </Stat>
        {board.weeklyBonus > 0 && (
          <Stat>
            Bonus <b>+{board.weeklyBonus}</b>/week
          </Stat>
        )}
        {board.bonusesToDecide > 0 && (
          <Stat warn>
            <b>{board.bonusesToDecide}</b> bonus{board.bonusesToDecide > 1 ? "es" : ""} to decide
          </Stat>
        )}
      </div>
      {first && (
        <div className="mx-3.5 mb-3 flex items-center gap-2.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-2 text-[12.5px] leading-snug text-[#1E3A8A]">
          <p className="flex-1">
            <b>
              {empty} empty School day{empty > 1 ? "s" : ""}
            </b>
            , the first in {weekRange(mondayOf(first))}. Fill in what {column.name} did.
          </p>
          <Link
            href={historyHref(column.id, mondayOf(first))}
            className="rounded-lg bg-[#2563EB] px-2.5 py-1.5 text-[13px] font-bold text-white active:bg-[#1D4ED8]"
          >
            Go
          </Link>
        </div>
      )}
    </section>
  );
}

function Stat({ warn = false, children }: { warn?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-lg px-2 py-1 text-xs tabular-nums ${warn ? "bg-[#FEF3C7] text-[#92400E] [&_b]:text-[#92400E]" : "bg-[#F0F1F3] text-[#6B7280] [&_b]:text-[#1F2430]"}`}
    >
      {children}
    </span>
  );
}

// A week of the Board: open, the History grid with the Weekly bonus in its
// footer; folded, one line with a bar per day that opens on tap.
function Week({
  column,
  contractId,
  week,
  size,
  today,
}: {
  column: ChildColumn;
  contractId: string;
  week: BoardWeek;
  size: number;
  today: string;
}) {
  const title = weekTitle(week.monday, today);
  const thisWeek = week.monday === mondayOf(today);
  return (
    <details open={week.open} className="group overflow-hidden rounded-xl bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 hover:bg-[#FBFBFD] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 leading-tight group-open:block">
          <b className="block text-sm">{title}</b>
          <small className="text-xs text-[#6B7280]">
            {title === weekRange(week.monday) ? "" : weekRange(week.monday)}
            {week.waiting > 0 && (
              <span className="hidden group-open:inline">
                {title === weekRange(week.monday) ? "" : " · "}
                <span className="font-bold text-[#92400E]">{week.waiting} waiting</span>
              </span>
            )}
          </small>
        </span>
        <span className="flex items-center gap-2.5 group-open:hidden">
          <DayBars week={week} />
          <span className="text-[12.5px] font-bold whitespace-nowrap tabular-nums">
            {week.stars}/{week.max} ★
          </span>
          {week.waiting > 0 && (
            <span className="rounded-full bg-[#FEF3C7] px-2 text-xs font-bold text-[#92400E]" aria-label={`${week.waiting} waiting`}>
              {week.waiting}
            </span>
          )}
          {week.bonus && <BonusChip size={size} granted={week.bonus.granted} judgeable={week.bonus.judgeable} />}
        </span>
        <span className="text-[#6B7280] group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <HistoryGrid
        bare
        childName={column.name}
        week={week}
        photos={column.photos}
        today={today}
        allDone={!thisWeek}
        bonus={
          week.bonus && (
            <BonusControl
              contractId={contractId}
              monday={week.monday}
              size={size}
              granted={week.bonus.granted}
              judgeable={week.bonus.judgeable}
            />
          )
        }
      />
    </details>
  );
}

// Each School day's approved Tasks as a filled bar, waiting Check-offs stacked
// on top in amber; a day outside the Contract or still to come is dashed.
function DayBars({ week }: { week: BoardWeek }) {
  return (
    <span className="flex h-5.5 w-20 items-stretch gap-0.75 sm:w-28" aria-hidden>
      {week.days.map((d) => {
        const { stars, waiting, max } = dayBar(d);
        if (!max) return <i key={d.day} className="flex-1 rounded-[3px] border border-dashed border-[#D1D5DB]" />;
        const pct = (n: number) => `${(n / max) * 100}%`;
        return (
          <i key={d.day} className="relative flex-1 overflow-hidden rounded-[3px] bg-[#E5E7EB]">
            <span className="absolute inset-x-0 bottom-0 bg-[#2563EB]" style={{ height: pct(stars) }} />
            <span className="absolute inset-x-0 bg-[#FCD34D]" style={{ bottom: pct(stars), height: pct(waiting) }} />
          </i>
        );
      })}
    </span>
  );
}

function Legend() {
  const keys: [string, string][] = [
    ["border-[#86EFAC] bg-[#DCFCE7]", "approved"],
    ["border-[#FCA5A5] bg-[#FEE2E2]", "rejected"],
    ["border-[#2563EB] bg-[#EFF6FF]", "waiting"],
    ["border-[#E5E7EB] bg-white", "not done"],
    ["border-dashed border-[#93C5FD] bg-white", "empty day"],
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-0.5 text-xs text-[#6B7280]">
      {keys.map(([cls, name]) => (
        <span key={name} className="flex items-center gap-1.5">
          <i className={`inline-block size-3 rounded-[3px] border ${cls}`} />
          {name}
        </span>
      ))}
    </div>
  );
}

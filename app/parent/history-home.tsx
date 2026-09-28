import Link from "next/link";
import type { HistoryContract } from "@/lib/history";
import { loadHistory } from "@/lib/parent-history";
import { createClient } from "@/lib/supabase/server";
import { warsawToday } from "@/lib/today";
import { mondayOf, weekRange } from "@/lib/weeks";
import { figtree } from "./font";
import { HistoryGrid } from "./history-grid";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

const href = (childId: string, week?: string) =>
  `/history?child=${encodeURIComponent(childId)}${week ? `&week=${week}` : ""}`;

const contractLine = (c: HistoryContract) =>
  c.closed_on === null ? `Contract ${short(c.starts_on)} – ${short(c.ends_on)}` : `Paid out ${short(c.paid_on ?? c.closed_on)} · read-only`;

// The parent's History (layout B of the history prototype): one child's week as
// a grid of Tasks by day, for fixing past days and filling in empty ones.
export async function HistoryHome({ childId, week }: { childId?: string; week?: string }) {
  const supabase = await createClient();
  const now = new Date();
  const today = warsawToday(now);
  const history = await loadHistory(supabase, now, childId, week);

  return (
    <main className={`${figtree.className} mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 bg-[#F6F7F9] p-4 pt-[max(1rem,env(safe-area-inset-top))] text-[#1F2430]`}>
      <header className="flex items-center justify-between">
        <Link href="/" className="font-semibold text-[#2563EB]">
          ‹ Inbox
        </Link>
        <h1 className="text-xl font-bold">History</h1>
      </header>
      {!history ? (
        <p className="rounded-xl bg-white p-4 text-sm text-[#6B7280]">No children yet.</p>
      ) : (
        <HistoryWeekView {...history} today={today} />
      )}
    </main>
  );
}

function HistoryWeekView({
  children,
  child,
  week,
  photos,
  today,
}: NonNullable<Awaited<ReturnType<typeof loadHistory>>> & { today: string }) {
  const firstEmpty = week.emptyDays[0];
  const emptyHere = week.emptyDays.some((d) => mondayOf(d) === week.monday);
  return (
    <>
      <nav className="flex gap-2 overflow-x-auto">
        {children.map((c) => (
          <Link
            key={c.id}
            href={href(c.id, week.monday === mondayOf(today) ? undefined : week.monday)}
            aria-current={c.id === child.id ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold whitespace-nowrap ${c.id === child.id ? "border-[#1F2430] bg-[#1F2430] text-white" : "border-[#E5E7EB] bg-white"}`}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Arrow to={week.prev && href(child.id, week.prev)} label="Previous week">
          ‹
        </Arrow>
        <div className="flex-1 text-center">
          <b className="block">{week.monday === mondayOf(today) ? "This week" : weekRange(week.monday)}</b>
          <small className="text-xs text-[#6B7280]">
            {week.contracts.length ? week.contracts.map(contractLine).join(" · ") : "No Contract this week"}
          </small>
        </div>
        <Arrow to={week.next && href(child.id, week.next)} label="Next week">
          ›
        </Arrow>
      </div>
      {firstEmpty && !emptyHere && (
        <div className="flex items-center gap-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-3 text-[13px] leading-snug text-[#1E3A8A]">
          <p className="flex-1">
            <b className="block text-sm">
              {week.emptyDays.length} School day{week.emptyDays.length > 1 ? "s" : ""} still empty
            </b>
            Nothing is checked off or decided there yet. Fill in what {child.name} did.
          </p>
          <Link
            href={href(child.id, mondayOf(firstEmpty))}
            className="rounded-lg bg-[#2563EB] px-3 py-2 text-sm font-bold text-white active:bg-[#1D4ED8]"
          >
            Go
          </Link>
        </div>
      )}
      {week.days.some((d) => d.kind === "paid") && (
        <p className="rounded-lg bg-[#F3F4F6] px-3.5 py-2.5 text-[13px] text-[#4B5563]">
          🔒 A paid-out Contract&apos;s days can&apos;t change.
        </p>
      )}
      <HistoryGrid
        key={`${child.id}/${week.monday}`}
        childName={child.name}
        week={week}
        photos={photos}
        today={today}
      />
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-0.5 text-xs text-[#6B7280]">
        <Key className="border-[#86EFAC] bg-[#DCFCE7]">✓ approved</Key>
        <Key className="border-[#FCA5A5] bg-[#FEE2E2]">✕ rejected</Key>
        <Key className="border-[#2563EB] bg-[#EFF6FF]">• checked off, waiting</Key>
        <Key className="border-[#E5E7EB] bg-white">not done</Key>
        <Key className="border-dashed border-[#93C5FD] bg-white">empty day</Key>
      </div>
    </>
  );
}

function Arrow({ to, label, children }: { to: string | null; label: string; children: string }) {
  const cls = "grid size-9 place-items-center rounded-full border border-[#E5E7EB] bg-white text-lg text-[#374151]";
  return to ? (
    <Link href={to} aria-label={label} className={cls}>
      {children}
    </Link>
  ) : (
    <span aria-hidden className={`${cls} opacity-35`}>
      {children}
    </span>
  );
}

function Key({ className, children }: { className: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={`inline-block size-3 rounded-[3px] border ${className}`} />
      {children}
    </span>
  );
}

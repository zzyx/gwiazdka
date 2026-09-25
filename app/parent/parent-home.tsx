import type { InboxDay, InboxRow } from "@/lib/inbox";
import { loadInbox, type ChildSection } from "@/lib/parent-inbox";
import { createClient } from "@/lib/supabase/server";
import { taskEmoji } from "@/lib/task-icons";
import { formatPln } from "@/lib/today";
import { signOut } from "../sign-in/actions";
import { approveAll, decide } from "./actions";
import { figtree } from "./font";
import { JoinCodeButton } from "./join-code-button";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayLabel = (day: string) =>
  `${WEEKDAYS[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]} ${day.slice(8, 10)}.${day.slice(5, 7)}`;

// Folded days shown before "Earlier days": about the last two weeks.
const RECENT_DAYS = 10;

// The parent's "Inbox by child".
export async function ParentHome() {
  const supabase = await createClient();
  const sections = await loadInbox(supabase, new Date());
  const waiting = sections.reduce((sum, s) => sum + (s.inbox?.waiting ?? 0), 0);

  return (
    <main className={`${figtree.className} mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 bg-[#F6F7F9] p-4 pt-[max(1rem,env(safe-area-inset-top))] text-[#1F2430]`}>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${waiting ? "bg-[#2563EB] text-white" : "bg-[#E5E7EB] text-[#6B7280]"}`}
          aria-label={`${waiting} waiting`}
        >
          {waiting} waiting
        </span>
      </header>
      {sections.map((s) => (
        <ChildInboxSection key={s.id} section={s} />
      ))}
      <form action={signOut} className="mt-auto">
        <button className="text-sm text-[#6B7280] underline">Sign out</button>
      </form>
    </main>
  );
}

function ChildInboxSection({ section }: { section: ChildSection }) {
  const { inbox } = section;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{section.name}</h2>
        {inbox && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">
              {inbox.stars} ★ · {formatPln(inbox.stars * inbox.groszePerStar)}
            </span>
            {inbox.waiting > 0 && (
              <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 font-bold text-[#92400E]">
                {inbox.waiting} waiting
              </span>
            )}
          </div>
        )}
      </div>
      {!inbox ? (
        <p className="rounded-xl bg-white p-4 text-sm text-[#6B7280]">No open contract.</p>
      ) : (
        <>
          {inbox.waitingDays.length === 0 && (
            <p className="rounded-xl bg-white p-4 text-sm text-[#6B7280]">Nothing is waiting for you.</p>
          )}
          {inbox.waitingDays.map((d) => (
            <DayCard key={d.day} day={d} />
          ))}
          {inbox.otherDays.length > 0 && (
            <div className="flex flex-col divide-y divide-[#E5E7EB] rounded-xl bg-white">
              {inbox.otherDays.slice(0, RECENT_DAYS).map((d) => (
                <FoldedDay key={d.day} day={d} />
              ))}
              {inbox.otherDays.length > RECENT_DAYS && (
                <details>
                  <summary className="cursor-pointer list-none px-4 py-2.5 text-sm text-[#2563EB]">
                    Earlier days ({inbox.otherDays.length - RECENT_DAYS})
                  </summary>
                  <div className="flex flex-col divide-y divide-[#E5E7EB] border-t border-[#E5E7EB]">
                    {inbox.otherDays.slice(RECENT_DAYS).map((d) => (
                      <FoldedDay key={d.day} day={d} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </>
      )}
      <JoinCodeButton childId={section.id} />
    </section>
  );
}

// A day with nothing waiting, folded to one line; tapping it opens its Tasks.
function FoldedDay({ day }: { day: InboxDay }) {
  return (
    <details>
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm">
        <span>{dayLabel(day.day)}</span>
        <span className="text-[#6B7280]">
          {day.stars}/{day.rows.length} ★
        </span>
      </summary>
      <DayRows day={day} />
    </details>
  );
}

function DayCard({ day }: { day: InboxDay }) {
  const waitingIds = day.rows.filter((r) => r.state === "checked_off").map((r) => r.taskId);
  return (
    <article className="overflow-hidden rounded-xl bg-white shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] px-4 py-3">
        <div>
          <h3 className="font-bold">{dayLabel(day.day)}</h3>
          <p className="text-xs text-[#6B7280]">
            {day.waiting} waiting · {day.stars} ★ so far
          </p>
        </div>
        <form action={approveAll.bind(null, waitingIds, day.day)}>
          <button className="rounded-lg bg-[#2563EB] px-3 py-2 text-sm font-bold text-white active:bg-[#1D4ED8]">
            Approve all ({day.waiting})
          </button>
        </form>
      </header>
      <DayRows day={day} />
    </article>
  );
}

function DayRows({ day }: { day: InboxDay }) {
  return (
    <ul className="divide-y divide-[#F0F1F3]">
      {day.rows.map((r) => (
        <li key={r.taskId} className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-2xl" aria-hidden>
            {taskEmoji(r.icon)}
          </span>
          <span className={`flex-1 ${r.state === "rejected" ? "text-[#9CA3AF] line-through" : ""}`}>{r.name}</span>
          <RowActions row={r} day={day.day} />
        </li>
      ))}
    </ul>
  );
}

function RowActions({ row, day }: { row: InboxRow; day: string }) {
  const set = (approved: boolean) => decide.bind(null, row.taskId, day, approved);
  switch (row.state) {
    case "checked_off":
      return (
        <div className="flex gap-2">
          <form action={set(false)}>
            <button aria-label={`Reject ${row.name}`} className="size-10 rounded-lg bg-[#FEE2E2] text-lg font-bold text-[#B91C1C]">
              ✕
            </button>
          </form>
          <form action={set(true)}>
            <button aria-label={`Approve ${row.name}`} className="size-10 rounded-lg bg-[#DCFCE7] text-lg font-bold text-[#15803D]">
              ✓
            </button>
          </form>
        </div>
      );
    case "not_done":
      return (
        <form action={set(true)}>
          <button className="rounded-lg border border-[#D1D5DB] px-2.5 py-1.5 text-sm text-[#374151]">Done, approve</button>
        </form>
      );
    case "approved":
      return (
        <form action={set(false)} className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-[#15803D]">✓ ★</span>
          <button className="text-[#6B7280] underline">Reject</button>
        </form>
      );
    case "rejected":
      return (
        <form action={set(true)} className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-[#B91C1C]">✕</span>
          <button className="text-[#6B7280] underline">Approve</button>
        </form>
      );
  }
}

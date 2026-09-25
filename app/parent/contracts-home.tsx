import Link from "next/link";
import type { ReactNode } from "react";
import { openContractState, progress, suggestedDates } from "@/lib/contracts";
import { loadContracts, type ChildContracts, type OpenContract } from "@/lib/parent-contracts";
import { createClient } from "@/lib/supabase/server";
import { taskEmoji } from "@/lib/task-icons";
import { formatPln, starsWord, warsawToday } from "@/lib/today";
import { approveAll } from "./actions";
import { closeContract, createContract, updateContract } from "./contract-actions";
import { ContractForm } from "./contract-form";
import { figtree } from "./font";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const short = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
const long = (day: string) => `${short(day)} ${day.slice(0, 4)}`;
const withWeekday = (day: string) =>
  `${WEEKDAYS[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]} ${short(day)}`;
const range = (a: string, b: string) => (a.slice(0, 4) === b.slice(0, 4) ? `${short(a)} – ${long(b)}` : `${long(a)} – ${long(b)}`);
const stars = (n: number) => `${n} ${starsWord(n)}`;
const rateText = (grosze: number) => `${formatPln(grosze)} per gwiazdka`;

export type Sheet = "create" | "edit" | "close" | "pay" | "paid";

const href = (childId: string, sheet?: Sheet, extra = "") =>
  `/contracts?child=${encodeURIComponent(childId)}${sheet ? `&sheet=${sheet}` : ""}${extra}`;

// The parent's Contracts: one tab per child with the Contract card, past
// Contracts below, and Create, Edit, Close & pay out and Start next contract
// as bottom sheets (layout A of the contract and payout prototype).
export async function ContractsHome({
  childId,
  sheet,
  paidContractId,
}: {
  childId?: string;
  sheet?: Sheet;
  paidContractId?: string;
}) {
  const supabase = await createClient();
  const now = new Date();
  const today = warsawToday(now);
  const children = await loadContracts(supabase, now);
  const child = children.find((c) => c.id === childId) ?? children[0];

  return (
    <main className={`${figtree.className} mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 bg-[#F6F7F9] p-4 pt-[max(1rem,env(safe-area-inset-top))] text-[#1F2430]`}>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contracts</h1>
        <Link href="/" className="text-sm text-[#2563EB]">
          Inbox
        </Link>
      </header>
      {!child ? (
        <p className="rounded-xl bg-white p-4 text-sm text-[#6B7280]">No children yet.</p>
      ) : (
        <>
          <nav className="flex gap-2 overflow-x-auto">
            {children.map((c) => (
              <Link
                key={c.id}
                href={href(c.id)}
                aria-current={c.id === child.id ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${c.id === child.id ? "bg-[#1F2430] text-white" : "bg-white text-[#1F2430]"}`}
              >
                {c.name}
                <span className={`size-2 rounded-full ${dotColor(c, today)}`} aria-hidden />
              </Link>
            ))}
          </nav>
          {child.open ? <ContractCard child={child} open={child.open} today={today} /> : <NoContract child={child} />}
          <PastContracts child={child} />
          {sheet && <SheetFor child={child} sheet={sheet} today={today} paidContractId={paidContractId} />}
        </>
      )}
    </main>
  );
}

function dotColor(c: ChildContracts, today: string) {
  if (!c.open) return "bg-[#98A2B3]";
  return openContractState(c.open, today) === "ended" ? "bg-[#F2A93B]" : "bg-[#16A34A]";
}

function StatePill({ open, today }: { open: OpenContract; today: string }) {
  const state = openContractState(open, today);
  const [cls, text] =
    state === "soon"
      ? ["bg-[#EFF6FF] text-[#1D4ED8]", `Starts ${short(open.starts_on)}`]
      : state === "ended"
        ? ["bg-[#FEF3C7] text-[#92400E]", `Ended ${short(open.ends_on)} · not paid out`]
        : ["bg-[#DCFCE7] text-[#15803D]", "● Open"];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{text}</span>;
}

function ContractCard({ child, open, today }: { child: ChildContracts; open: OpenContract; today: string }) {
  const p = progress(open, today);
  const state = openContractState(open, today);
  const pct = p.all ? Math.round((p.done / p.all) * 100) : 0;
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-sm">
        <StatePill open={open} today={today} />
        <span className="text-[#6B7280]">{range(open.starts_on, open.ends_on)}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <b className="text-4xl">{open.stars}</b>
        <span>{starsWord(open.stars)}</span>
        <span className="ml-auto text-xl font-bold">{formatPln(open.stars * open.grosze_per_star)}</span>
      </div>
      <p className="-mt-2 text-xs text-[#6B7280]">{open.stars} from Tasks · 0 from Weekly bonuses</p>
      <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
        <div className="h-full bg-[#2563EB]" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-[#6B7280]">
        <span>
          School day {p.done} of {p.all}
        </span>
        <span>{p.left ? `${p.left} to go` : "Finished"}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-[#6B7280]">Rate</dt>
        <dd className="text-right">{rateText(open.grosze_per_star)}</dd>
        <dt className="text-[#6B7280]">Weekly bonus</dt>
        <dd className="text-right">{stars(open.weekly_bonus_stars)}</dd>
        <dt className="text-[#6B7280]">Tasks</dt>
        <dd className="text-right">
          {child.tasks.map((t) => taskEmoji(t.icon)).join(" ")} · {child.tasks.length} a day
        </dd>
      </dl>
      {open.waiting > 0 && (
        <p className="rounded-lg bg-[#FEF3C7] p-2.5 text-sm text-[#92400E]">
          ⏳ {open.waiting} {open.waiting === 1 ? "Task" : "Tasks"} on {open.waitingDays.length}{" "}
          {open.waitingDays.length === 1 ? "day" : "days"} still wait for approval.
        </p>
      )}
      <div className="flex gap-2">
        <Link href={href(child.id, "edit")} className="flex-1 rounded-xl border border-[#D1D5DB] p-3 text-center font-semibold">
          Edit
        </Link>
        {state !== "soon" && (
          <Link href={href(child.id, "close")} className="flex-1 rounded-xl bg-[#2563EB] p-3 text-center font-bold text-white">
            Close &amp; pay out
          </Link>
        )}
      </div>
    </section>
  );
}

function NoContract({ child }: { child: ChildContracts }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">No open Contract</h2>
      <p className="text-sm text-[#6B7280]">
        {child.name} can open Today but can&apos;t check anything off until a new Contract starts.
      </p>
      <Link href={href(child.id, "create")} className="rounded-xl bg-[#2563EB] p-3 text-center font-bold text-white">
        Create a Contract
      </Link>
    </section>
  );
}

function PastContracts({ child }: { child: ChildContracts }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-[#6B7280]">Past Contracts</h2>
      <div className="flex flex-col divide-y divide-[#F2F3F6] rounded-2xl bg-white">
        {child.past.length === 0 && <p className="p-4 text-sm text-[#6B7280]">None yet.</p>}
        {child.past.map((c) => {
          const paid = c.payout;
          const total = paid ? paid.task_stars + paid.bonus_stars : 0;
          return (
            <details key={c.id}>
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                <span className="flex flex-1 flex-col">
                  <b>{range(c.starts_on, c.ends_on)}</b>
                  <small className="text-[#6B7280]">{paid ? `${stars(total)} · paid ${long(paid.paid_on)}` : "Closed"}</small>
                </span>
                {paid && <span className="font-bold">{formatPln(paid.amount_grosze)}</span>}
                <span className="text-[#6B7280]" aria-hidden>
                  ▾
                </span>
              </summary>
              {paid ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 bg-[#FAFBFC] px-4 pb-3 pt-1 text-sm">
                  <dt className="text-[#6B7280]">Stars from Tasks</dt>
                  <dd className="text-right">{paid.task_stars}</dd>
                  <dt className="text-[#6B7280]">Weekly bonuses</dt>
                  <dd className="text-right">{paid.bonus_stars}</dd>
                  <dt className="text-[#6B7280]">Total</dt>
                  <dd className="text-right">{stars(total)}</dd>
                  <dt className="text-[#6B7280]">Rate</dt>
                  <dd className="text-right">{rateText(c.grosze_per_star)}</dd>
                  <dt className="text-[#6B7280]">Payout</dt>
                  <dd className="text-right">
                    {formatPln(paid.amount_grosze)} on {long(paid.paid_on)}
                  </dd>
                  {paid.not_counted > 0 && (
                    <>
                      <dt className="text-[#6B7280]">Not counted</dt>
                      <dd className="text-right">{paid.not_counted} pending at closing</dd>
                    </>
                  )}
                  {paid.planned_ends_on !== c.ends_on && (
                    <>
                      <dt className="text-[#6B7280]">Closed early</dt>
                      <dd className="text-right">planned until {long(paid.planned_ends_on)}</dd>
                    </>
                  )}
                  <dd className="col-span-2 pt-1 text-xs text-[#6B7280]">Frozen: days and bonuses can&apos;t be changed.</dd>
                </dl>
              ) : (
                <p className="px-4 pb-3 text-sm text-[#6B7280]">Closed before the app recorded Payouts.</p>
              )}
            </details>
          );
        })}
      </div>
    </section>
  );
}

// A bottom sheet over the page; tapping outside it closes it.
function BottomSheet({ closeHref, children }: { closeHref: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end">
      <Link href={closeHref} aria-label="Close" className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative mx-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-[#D1D5DB]" aria-hidden />
        {children}
      </div>
    </div>
  );
}

function SheetFor({
  child,
  sheet,
  today,
  paidContractId,
}: {
  child: ChildContracts;
  sheet: Sheet;
  today: string;
  paidContractId?: string;
}) {
  const back = href(child.id);
  const open = child.open;
  const last = child.past[0];

  if (sheet === "create" && !open) {
    const dates = suggestedDates(today, last?.ends_on ?? null);
    const isNext = Boolean(last);
    return (
      <BottomSheet closeHref={back}>
        <h2 className="text-xl font-bold">{isNext ? "Start next Contract" : "New Contract"}</h2>
        <p className="mb-4 text-sm text-[#6B7280]">
          {child.name}
          {isNext ? " · starts from 0 gwiazdek, nothing carried over" : ""}
        </p>
        <ContractForm
          action={createContract.bind(null, child.id)}
          cancelHref={back}
          submitLabel="Start Contract"
          tasks={child.tasks}
          starts_on={dates.starts_on}
          ends_on={dates.ends_on}
          rate={last ? (last.grosze_per_star / 100).toFixed(2) : undefined}
          bonus={last ? String(last.weekly_bonus_stars) : undefined}
          today={today}
        />
      </BottomSheet>
    );
  }

  if (sheet === "edit" && open) {
    return (
      <BottomSheet closeHref={back}>
        <h2 className="mb-4 text-xl font-bold">Edit Contract</h2>
        <ContractForm
          action={updateContract.bind(null, child.id, open.id)}
          cancelHref={back}
          submitLabel="Save"
          tasks={child.tasks}
          starts_on={open.starts_on}
          ends_on={open.ends_on}
          fixed={{
            grosze_per_star: open.grosze_per_star,
            weekly_bonus_stars: open.weekly_bonus_stars,
            startLocked: open.starts_on <= today,
          }}
          today={today}
        />
      </BottomSheet>
    );
  }

  if (sheet === "close" && open && openContractState(open, today) !== "soon") {
    const waiting = open.waitingDays;
    return (
      <BottomSheet closeHref={back}>
        <h2 className="text-xl font-bold">{waiting.length ? "Some days still wait for approval" : "All days approved"}</h2>
        <p className="mb-4 text-sm text-[#6B7280]">
          {waiting.length ? "Approve them now, or close anyway and they count as 0." : "Nothing is waiting any more."}
        </p>
        {waiting.length === 0 && <p className="mb-4 rounded-lg bg-[#DCFCE7] p-3 text-sm text-[#15803D]">✓ Nothing is waiting for approval.</p>}
        <ul className="mb-4 flex flex-col divide-y divide-[#F2F3F6]">
          {waiting.map((d) => {
            const ids = d.rows.filter((r) => r.state === "checked_off").map((r) => r.taskId);
            return (
              <li key={d.day} className="flex items-center gap-3 py-2.5">
                <span className="flex flex-1 flex-col">
                  <b>{withWeekday(d.day)}</b>
                  <small className="text-[#6B7280]">
                    {d.waiting} waiting{" "}
                    {d.rows
                      .filter((r) => r.state === "checked_off")
                      .map((r) => taskEmoji(r.icon))
                      .join("")}
                  </small>
                </span>
                <form action={approveAll.bind(null, ids, d.day)}>
                  <button className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-semibold">Approve {d.waiting}</button>
                </form>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2">
          <Link
            href={href(child.id, "pay")}
            className={`rounded-xl p-3 text-center font-bold ${waiting.length ? "border border-[#D1D5DB]" : "bg-[#2563EB] text-white"}`}
          >
            {waiting.length ? `Close anyway (${open.waiting} count as 0)` : "Continue"}
          </Link>
          <Link href={back} className="p-2 text-center text-sm text-[#6B7280]">
            Cancel
          </Link>
        </div>
      </BottomSheet>
    );
  }

  if (sheet === "pay" && open && openContractState(open, today) !== "soon") {
    const amount = open.stars * open.grosze_per_star;
    const early = today < open.ends_on;
    return (
      <BottomSheet closeHref={back}>
        <h2 className="text-xl font-bold">Close &amp; pay out</h2>
        <p className="mb-4 text-sm text-[#6B7280]">
          {child.name} · {range(open.starts_on, early ? today : open.ends_on)}
        </p>
        <div className="mb-4 flex flex-col items-center">
          <b className="text-4xl">{formatPln(amount)}</b>
          <span className="text-sm text-[#6B7280]">
            {stars(open.stars)} × {formatPln(open.grosze_per_star)}
          </span>
        </div>
        <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[#6B7280]">From Tasks</dt>
          <dd className="text-right">{open.stars}</dd>
          <dt className="text-[#6B7280]">Weekly bonuses</dt>
          <dd className="text-right">0</dd>
          {open.waiting > 0 && (
            <>
              <dt className="text-[#6B7280]">Pending, not counted</dt>
              <dd className="text-right">{open.waiting}</dd>
            </>
          )}
          <dt className="text-[#6B7280]">Closing date</dt>
          <dd className="text-right">{withWeekday(today)}</dd>
        </dl>
        {early && (
          <p className="mb-4 rounded-lg bg-[#FEF3C7] p-2.5 text-sm text-[#92400E]">
            Closing early: planned until {long(open.ends_on)}, {progress(open, today).left} School days left. The end date
            becomes {withWeekday(today)}.
          </p>
        )}
        <p className="mb-4 text-sm text-[#6B7280]">
          After closing, this Contract is frozen and {child.name} starts again from 0.
        </p>
        <form action={closeContract.bind(null, child.id, open.id)} className="flex flex-col gap-2">
          <button className="rounded-xl bg-[#16A34A] p-3 font-bold text-white">Close &amp; pay out {formatPln(amount)}</button>
          <Link href={back} className="p-2 text-center text-sm text-[#6B7280]">
            Cancel
          </Link>
        </form>
      </BottomSheet>
    );
  }

  const paid = child.past.find((c) => c.id === paidContractId);
  if (sheet === "paid" && paid?.payout && !open) {
    const next = suggestedDates(today, paid.ends_on);
    return (
      <BottomSheet closeHref={back}>
        <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-[#DCFCE7] text-3xl text-[#15803D]">✓</div>
        <h2 className="text-center text-xl font-bold">
          Paid {formatPln(paid.payout.amount_grosze)} to {child.name}
        </h2>
        <p className="mb-4 text-center text-sm text-[#6B7280]">Contract closed on {long(paid.payout.paid_on)} and frozen.</p>
        <p className="mb-4 rounded-lg bg-[#EFF6FF] p-3 text-sm">
          Next Contract: from {withWeekday(next.starts_on)} to {short(next.ends_on)}, {rateText(paid.grosze_per_star)}, Weekly bonus {stars(paid.weekly_bonus_stars)}.
        </p>
        <div className="flex flex-col gap-2">
          <Link href={href(child.id, "create")} className="rounded-xl bg-[#2563EB] p-3 text-center font-bold text-white">
            Start next Contract
          </Link>
          <Link href={back} className="p-2 text-center text-sm text-[#6B7280]">
            Not now
          </Link>
        </div>
      </BottomSheet>
    );
  }

  return null;
}

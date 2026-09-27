import { ArrowLeft, Check, Clock, Coins, FileText, Gift, Hourglass, UserCheck, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ChildContract } from "@/lib/child-contract";
import { contractTimeline } from "@/lib/contracts";
import { formatPln, starsWord } from "@/lib/today";
import { MarkContractSeen } from "./contract-seen";
import { Star } from "./star";

const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const weekday = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
const dayMonth = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
const shortDate = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1].slice(0, 3)}`;
const schoolDays = (n: number) => `${n} School ${n === 1 ? "day" : "days"}`;

export function ContractView({ contract }: { contract: ChildContract }) {
  const open = contract.open;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-10">
      <header className="flex items-center gap-3 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
        <Link
          href="/"
          aria-label="Back"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-(--mn-line) bg-(--mn-card) text-(--mn-muted) active:scale-95"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-lg font-bold">Your Contract</h1>
        {open && (
          <span className="rounded-full border border-(--mn-line) bg-(--mn-card) px-2.5 py-1 text-xs text-(--mn-muted) tabular-nums">
            {shortDate(open.starts_on)} – {shortDate(open.ends_on)}
          </span>
        )}
      </header>
      {open ? (
        <OpenContract open={open} today={contract.today} />
      ) : (
        <NoContract lastPayout={contract.lastPayout} />
      )}
    </main>
  );
}

function OpenContract({ open, today }: { open: NonNullable<ChildContract["open"]>; today: string }) {
  const time = contractTimeline(open, today);
  const stars = open.taskStars + open.bonusStars;
  const worth = formatPln(stars * open.grosze_per_star);
  const rate = formatPln(open.grosze_per_star);
  const bonus = open.weekly_bonus_stars;

  return (
    <div className="flex flex-col gap-3 px-4">
      <MarkContractSeen contractId={open.id} />
      {time.endsSoon ? (
        <Note>
          <b>{schoolDays(time.left)} to go.</b> The Payout is on {WEEKDAYS_LONG[weekday(open.ends_on)]}{" "}
          {dayMonth(open.ends_on)}: {worth} so far.
        </Note>
      ) : time.state === "ended" ? (
        <Note>
          <b>Your Contract ended on {dayMonth(open.ends_on)}.</b> Your parent will pay out {worth} at the Payout.
        </Note>
      ) : time.state === "soon" ? (
        <Note>
          <b>Your Contract starts on {WEEKDAYS_LONG[weekday(open.starts_on)]} {dayMonth(open.starts_on)}.</b>
        </Note>
      ) : null}

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <b className="text-3xl font-extrabold tracking-tight text-(--mn-acc-ink) tabular-nums">{worth}</b>
          <span className="text-right text-sm text-(--mn-muted)">
            {stars} {starsWord(stars)}
            <br />
            so far
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Count label="From Tasks" stars={open.taskStars} />
          <Count label="Weekly bonus" stars={open.bonusStars} />
        </div>
      </Card>

      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <b className="text-[15px]">{schoolDays(time.left)} left</b>
          <span className="text-xs text-(--mn-muted) tabular-nums">
            {time.done} of {time.all} done
          </span>
        </div>
        <div className="relative my-3 h-2 rounded-full bg-(--mn-line)" role="progressbar" aria-valuenow={time.percent} aria-valuemin={0} aria-valuemax={100} aria-label="School days gone">
          <i className="absolute inset-y-0 left-0 rounded-full bg-(--acc)" style={{ width: `${time.percent}%` }} />
          <i
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-(--acc) bg-(--mn-ink)"
            style={{ left: `${time.percent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-(--mn-muted) tabular-nums">
          <span>{shortDate(open.starts_on)}</span>
          <span>Payout {shortDate(open.ends_on)}</span>
        </div>
      </Card>

      <Card>
        <ul className="flex flex-col divide-y divide-(--mn-line)">
          <Rule icon={Check} title="1 Task = 1 gwiazdka">
            Every Task on a School day (Monday to Friday) can earn <strong>1 gwiazdka</strong>.
            {open.tasksPerDay > 0 && ` That's up to ${open.tasksPerDay} a day.`}
          </Rule>
          <Rule icon={Clock} title="Check it off in time">
            You can check off or undo a Task until <strong>22:00 the next day</strong>.
          </Rule>
          <Rule icon={UserCheck} title="Your parent approves">
            It only counts once your parent approves it. A rejected Task earns nothing, and a decided Task can&apos;t be
            changed.
          </Rule>
          <Rule icon={Coins} title={`1 gwiazdka = ${rate}`}>
            If your parent changes the rate, the new rate counts for every gwiazdka in this Contract.
          </Rule>
          {bonus > 0 ? (
            <Rule icon={Gift} title={`Weekly bonus: up to ${bonus}`}>
              Once a week your parent can add up to{" "}
              <strong>
                {bonus} extra {starsWord(bonus)}
              </strong>
              , by hand, for a good week.
            </Rule>
          ) : (
            <Rule icon={Gift} title="No Weekly bonus">
              This Contract has no Weekly bonus.
            </Rule>
          )}
          <Rule icon={Wallet} title={`Payout on ${dayMonth(open.ends_on)}`}>
            When the Contract ends, it&apos;s all paid out in one go. The next Contract starts from zero.
          </Rule>
        </ul>
      </Card>
    </div>
  );
}

function NoContract({ lastPayout }: { lastPayout: ChildContract["lastPayout"] }) {
  return (
    <div className="px-4">
      <Card>
        <div className="flex flex-col items-center gap-1.5 px-2 py-5 text-center">
          <FileText className="mb-1 size-9 text-(--mn-muted)" strokeWidth={1.8} aria-hidden />
          <h2 className="text-[17px] font-bold">No Contract right now</h2>
          <p className="max-w-72 text-sm leading-snug text-(--mn-muted)">
            {lastPayout &&
              `Your last one ended on ${dayMonth(lastPayout.ends_on)} and paid out ${formatPln(lastPayout.amount_grosze)} for ${lastPayout.stars} ${starsWord(lastPayout.stars)}. `}
            When your parent starts a new one, its rules show up here.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-[20px] border border-(--mn-line) bg-(--mn-card) p-4">{children}</section>;
}

function Count({ label, stars }: { label: string; stars: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-(--mn-line)/45 px-3 py-2.5">
      <small className="text-[11px] font-semibold tracking-wider text-(--mn-muted) uppercase">{label}</small>
      <b className="flex items-center gap-1 text-base tabular-nums">
        <Star className="size-3.5" />
        {stars}
      </b>
    </div>
  );
}

function Rule({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0.5 last:pb-0.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-(--acc)/12 text-(--mn-acc-ink)">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <b className="text-sm font-semibold">{title}</b>
        <p className="text-[13px] leading-snug text-(--mn-muted) [&_strong]:font-semibold [&_strong]:text-(--mn-ink)">
          {children}
        </p>
      </div>
    </li>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-2xl border border-(--acc)/45 bg-(--acc)/12 px-3.5 py-3 text-sm leading-snug">
      <Hourglass className="mt-0.5 size-4.5 shrink-0 text-(--mn-acc-ink)" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

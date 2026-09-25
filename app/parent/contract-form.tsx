"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { mostItCanPay, parseRate } from "@/lib/contracts";
import type { ListedTask } from "@/lib/parent-contracts";
import { taskEmoji } from "@/lib/task-icons";
import { formatPln, starsWord } from "@/lib/today";
import type { FormState } from "./contract-actions";

type Draft = { id?: string; name: string; icon: string };

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  cancelHref: string;
  submitLabel: string;
  tasks: ListedTask[];
  starts_on: string;
  ends_on: string;
  // Editing an open Contract: the rate and bonus are fixed, the start too once it has begun.
  fixed?: { grosze_per_star: number; weekly_bonus_stars: number; startLocked: boolean };
  rate?: string;
  bonus?: string;
  today: string;
};

const fieldCls = "w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-base";

// Create, Start next contract and Edit share one form: dates, the child's Task
// list, and the rate and Weekly bonus (fixed once the Contract exists).
export function ContractForm(props: Props) {
  const { fixed, today } = props;
  const [state, formAction, pending] = useActionState(props.action, {});
  const [tasks, setTasks] = useState<Draft[]>(props.tasks);
  const [startsOn, setStartsOn] = useState(props.starts_on);
  const [endsOn, setEndsOn] = useState(props.ends_on);
  const [rate, setRate] = useState(props.rate ?? "0.50");
  const [bonus, setBonus] = useState(props.bonus ?? "3");
  const [newIcon, setNewIcon] = useState("");
  const [newName, setNewName] = useState("");

  const addTask = () => {
    if (!newName.trim()) return;
    setTasks([...tasks, { name: newName.trim(), icon: newIcon.trim() || "⭐" }]);
    setNewName("");
    setNewIcon("");
  };

  const groszePerStar = fixed ? fixed.grosze_per_star : parseRate(rate);
  const bonusStars = fixed ? fixed.weekly_bonus_stars : Number(bonus) || 0;
  const most = startsOn && endsOn && startsOn <= endsOn ? mostItCanPay({ starts_on: startsOn, ends_on: endsOn }, tasks.length, bonusStars) : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="tasks" value={JSON.stringify(tasks.map((t) => (t.id ? { id: t.id } : t)))} />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Start
          {fixed?.startLocked ? (
            <>
              <input type="hidden" name="starts_on" value={startsOn} />
              <span className="py-2 text-base font-normal">{startsOn} · fixed</span>
            </>
          ) : (
            <input type="date" name="starts_on" required value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={fieldCls} />
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          End
          <input
            type="date"
            name="ends_on"
            required
            min={startsOn > today ? startsOn : today}
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            className={fieldCls}
          />
        </label>
      </div>
      {!fixed?.startLocked && startsOn && startsOn < today && (
        <p className="-mt-2 text-xs text-[#6B7280]">
          Starts in the past: earlier School days start empty and count once you approve them.
        </p>
      )}

      {fixed ? (
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-[#F6F7F9] p-3 text-sm">
          <dt className="text-[#6B7280]">Rate</dt>
          <dd className="text-right font-semibold">{formatPln(fixed.grosze_per_star)} per gwiazdka · fixed</dd>
          <dt className="text-[#6B7280]">Weekly bonus</dt>
          <dd className="text-right font-semibold">
            {fixed.weekly_bonus_stars} {starsWord(fixed.weekly_bonus_stars)} · fixed
          </dd>
          <dd className="col-span-2 text-xs text-[#6B7280]">
            To change the rate or the Weekly bonus, close this Contract and start a new one.
          </dd>
        </dl>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Rate (zł per gwiazdka)
            <input name="rate" inputMode="decimal" required value={rate} onChange={(e) => setRate(e.target.value)} className={fieldCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Weekly bonus (gwiazdki)
            <input name="bonus" inputMode="numeric" required value={bonus} onChange={(e) => setBonus(e.target.value)} className={fieldCls} />
          </label>
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Tasks · each approved Task earns 1 gwiazdka</legend>
        <ul className="divide-y divide-[#F0F1F3] rounded-lg border border-[#E5E7EB] bg-white">
          {tasks.length === 0 && <li className="px-3 py-2 text-sm text-[#6B7280]">No Tasks yet.</li>}
          {tasks.map((t, i) => (
            <li key={t.id ?? `new-${i}`} className="flex items-center gap-3 px-3 py-2">
              <span className="text-xl" aria-hidden>
                {taskEmoji(t.icon)}
              </span>
              <span className="flex-1">{t.name}</span>
              <button
                type="button"
                aria-label={`Remove ${t.name}`}
                onClick={() => setTasks(tasks.filter((_, j) => j !== i))}
                className="size-8 rounded-lg text-[#6B7280] active:bg-[#F3F4F6]"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            aria-label="Icon"
            placeholder="⭐"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            className={`${fieldCls} w-14 text-center`}
          />
          <input
            aria-label="New Task"
            placeholder="New Task, e.g. Feed the cat"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTask();
              }
            }}
            className={`${fieldCls} flex-1`}
          />
          <button type="button" onClick={addTask} className="rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm font-semibold">
            Add
          </button>
        </div>
        <p className="text-xs text-[#6B7280]">
          {fixed
            ? "Changes count from the next School day. Days already done keep their Tasks."
            : "The same list every School day."}
        </p>
      </fieldset>

      <p className="rounded-lg bg-[#EFF6FF] p-3 text-sm">
        {most ? (
          <>
            <b>{most.schoolDays} School days</b> in {most.weeks} weeks. If every Task and Weekly bonus is earned:{" "}
            <b>
              {most.stars} {starsWord(most.stars)}
              {groszePerStar ? ` = ${formatPln(most.stars * groszePerStar)}` : ""}
            </b>
            .
          </>
        ) : (
          "Pick a start and an end."
        )}
      </p>

      {state.error && (
        <p role="alert" className="rounded-lg bg-[#FEE2E2] p-3 text-sm text-[#B91C1C]">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button disabled={pending} className="rounded-xl bg-[#2563EB] p-3 font-bold text-white disabled:opacity-50">
          {submitLabelText(props.submitLabel, pending)}
        </button>
        <Link href={props.cancelHref} className="p-2 text-center text-sm text-[#6B7280]">
          Cancel
        </Link>
      </div>
    </form>
  );
}

const submitLabelText = (label: string, pending: boolean) => (pending ? "Saving…" : label);

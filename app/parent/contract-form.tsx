"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { mostItCanPay, parseRate } from "@/lib/contracts";
import type { ListedTask } from "@/lib/parent-contracts";
import { TASK_ICONS, taskEmoji } from "@/lib/task-icons";
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
  rate?: string;
  bonus?: string;
  // Editing an open Contract: Task changes count from the next day, and the
  // start is fixed once the Contract has begun.
  editing?: { startLocked: boolean };
  today: string;
};

const fieldCls = "rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-base";

// Keeps only what a złoty amount can hold: digits and one separator with up to two decimals.
const moneyInput = (text: string) => {
  const [whole, ...rest] = text.replace(/[^\d.,]/g, "").replace(",", ".").split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
};
const wholeInput = (text: string) => text.replace(/\D/g, "").slice(0, 2);

// Create, Start next contract and Edit share one form: dates, the rate and
// Weekly bonus, and the child's Task list.
export function ContractForm(props: Props) {
  const { editing, today } = props;
  const [state, formAction, pending] = useActionState(props.action, {});
  const [tasks, setTasks] = useState<Draft[]>(props.tasks);
  const [startsOn, setStartsOn] = useState(props.starts_on);
  const [endsOn, setEndsOn] = useState(props.ends_on);
  const [rate, setRate] = useState(props.rate ?? "0.50");
  const [bonus, setBonus] = useState(props.bonus ?? "3");
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState(TASK_ICONS[0]);

  const addTask = () => {
    if (!newName.trim()) return;
    setTasks([...tasks, { name: newName.trim(), icon: newIcon }]);
    setNewName("");
  };

  const groszePerStar = parseRate(rate);
  const most =
    startsOn && endsOn && startsOn <= endsOn
      ? mostItCanPay({ starts_on: startsOn, ends_on: endsOn }, tasks.length, Number(bonus) || 0)
      : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="tasks" value={JSON.stringify(tasks.map((t) => (t.id ? { id: t.id } : t)))} />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Start
          {editing?.startLocked ? (
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
      {!editing?.startLocked && startsOn && startsOn < today && (
        <p className="-mt-2 text-xs text-[#6B7280]">
          Starts in the past: earlier School days start empty and count once you approve them.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Rate
          <span className="flex items-center gap-2">
            <input
              name="rate"
              inputMode="decimal"
              required
              value={rate}
              onChange={(e) => setRate(moneyInput(e.target.value))}
              className={`${fieldCls} w-full min-w-0`}
            />
            <span className="shrink-0 font-normal text-[#6B7280]">zł</span>
          </span>
          <span className="text-xs font-normal text-[#6B7280]">per gwiazdka</span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Weekly bonus
          <span className="flex items-center gap-2">
            <input
              name="bonus"
              inputMode="numeric"
              pattern="\d{1,2}"
              required
              value={bonus}
              onChange={(e) => setBonus(wholeInput(e.target.value))}
              className={`${fieldCls} w-full min-w-0`}
            />
            <span className="shrink-0 font-normal text-[#6B7280]">gw.</span>
          </span>
          <span className="text-xs font-normal text-[#6B7280]">at most once a week</span>
        </label>
      </div>
      {editing && (
        <p className="-mt-2 text-xs text-[#6B7280]">
          A new rate counts for the whole Contract, including gwiazdki already earned.
        </p>
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
        <div className="flex flex-col gap-2 rounded-lg bg-[#F6F7F9] p-2">
          <div className="flex gap-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-xl" aria-hidden>
              {taskEmoji(newIcon)}
            </span>
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
              className={`${fieldCls} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={addTask}
              disabled={!newName.trim()}
              className="shrink-0 rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm font-semibold disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <div role="radiogroup" aria-label="Icon" className="flex flex-wrap gap-1">
            {TASK_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                role="radio"
                aria-checked={icon === newIcon}
                aria-label={icon}
                onClick={() => setNewIcon(icon)}
                className={`size-9 rounded-lg text-xl ${icon === newIcon ? "bg-white ring-2 ring-[#2563EB]" : "active:bg-white"}`}
              >
                {taskEmoji(icon)}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-[#6B7280]">
          {editing
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
          {pending ? "Saving…" : props.submitLabel}
        </button>
        <Link href={props.cancelHref} className="p-2 text-center text-sm text-[#6B7280]">
          Cancel
        </Link>
      </div>
    </form>
  );
}

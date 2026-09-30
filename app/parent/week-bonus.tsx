"use client";

import { useOptimistic, useState, useTransition } from "react";
import { decideWeeklyBonus } from "./actions";

type Props = {
  contractId: string;
  monday: string;
  size: number;
  granted: boolean | null;
  // From the week's Friday on.
  judgeable: boolean;
};

// The Weekly bonus in a week's footer: No or +n from Friday, then a chip that
// changes it while the Contract is open.
export function BonusControl({ contractId, monday, size, granted, judgeable }: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [shown, show] = useOptimistic(granted);
  const decide = (grant: boolean) =>
    start(async () => {
      show(grant);
      setEditing(false);
      await decideWeeklyBonus(contractId, monday, grant);
    });

  if (!judgeable) return <span className={chip("off")}>Bonus from Fri</span>;
  if (shown === null || editing)
    return (
      <span className="flex items-center gap-1.5 rounded-lg bg-[#FFFBEB] py-0.5 pr-0.5 pl-2">
        <span className="text-xs font-bold text-[#92400E]">Bonus?</span>
        <button
          disabled={pending}
          onClick={() => decide(false)}
          className="rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1 text-[13px] font-bold text-[#374151] disabled:opacity-50"
        >
          No
        </button>
        <button
          disabled={pending}
          onClick={() => decide(true)}
          className="rounded-lg bg-[#2563EB] px-2.5 py-1 text-[13px] font-bold whitespace-nowrap text-white active:bg-[#1D4ED8] disabled:opacity-50"
        >
          +{size} ★
        </button>
      </span>
    );
  return (
    <button onClick={() => setEditing(true)} title="Change the Weekly bonus" className={chip(shown ? "on" : "off")}>
      {shown ? `+${size} bonus` : "No bonus"}
    </button>
  );
}

// The bonus on a folded week's line, shown only.
export function BonusChip({ size, granted, judgeable }: Omit<Props, "contractId" | "monday">) {
  if (!judgeable) return <span className={chip("off")}>from Fri</span>;
  if (granted === null) return <span className={chip("hot")}>decide</span>;
  return <span className={chip(granted ? "on" : "off")}>{granted ? `+${size}` : "No"}</span>;
}

const chip = (tone: "on" | "off" | "hot") =>
  `rounded-full px-2.5 py-0.5 text-[12.5px] font-bold whitespace-nowrap ${
    tone === "on" ? "bg-[#DBEAFE] text-[#1D4ED8]" : tone === "hot" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#F3F4F6] text-[#6B7280]"
  }`;

"use client";

import { useState, type ReactNode } from "react";

type Tab = { id: string; name: string; dot: boolean };

// On a narrow screen the Board shows one child at a time, picked with tabs; on a
// wide one every child gets a column and the tabs hide.
export function BoardTabs({ tabs, columns }: { tabs: Tab[]; columns: ReactNode[] }) {
  const [shown, setShown] = useState((tabs.find((t) => t.dot) ?? tabs[0])?.id);
  return (
    <>
      {tabs.length > 1 && (
        <div className="flex gap-1.5 lg:hidden" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === shown}
              onClick={() => setShown(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1.5 font-bold ${
                t.id === shown ? "border-[#1F2430] bg-[#1F2430] text-white" : "border-[#E5E7EB] bg-white"
              }`}
            >
              {t.name}
              {t.dot && <i className="size-1.75 rounded-full bg-[#FCD34D]" aria-label="needs you" />}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(22rem,1fr))] lg:items-start">
        {columns.map((column, i) => (
          <div key={tabs[i].id} role="tabpanel" className={tabs[i].id === shown ? "" : "hidden lg:block"}>
            {column}
          </div>
        ))}
      </div>
    </>
  );
}

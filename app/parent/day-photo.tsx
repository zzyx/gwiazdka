"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { DayPhoto } from "@/lib/day-photos";
import { approveAll } from "./actions";
import { figtree } from "./font";

const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (day: string) =>
  `${WEEKDAYS_LONG[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]} ${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

type Props = {
  childName: string;
  day: string;
  photo: DayPhoto;
  // The day's waiting Check-offs, for Approve all in the viewer.
  waitingIds: string[];
};

// The tiny thumbnail on a day of a week grid.
export function PhotoThumb({ className = "", ...props }: Props & { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        aria-label="Open photo"
        className={className}
      >
        <Thumb url={props.photo.url} className="size-7 rounded-md" />
      </button>
      {open && <Viewer {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function Thumb({ url, className }: { url: string; className: string }) {
  return (
    <span
      aria-hidden
      className={`block shrink-0 bg-[#DDD] bg-cover bg-center shadow-[0_0_0_1px_#E5E7EB] ${className}`}
      style={{ backgroundImage: `url("${url}")` }}
    />
  );
}

// Full screen, in a portal so taps inside it don't fold or unfold a day.
function Viewer({ childName, day, photo, waitingIds, onClose }: Props & { onClose: () => void }) {
  const waiting = waitingIds.length;
  return createPortal(
    <div role="dialog" aria-label={`${childName}'s photo`} className={`${figtree.className} fixed inset-0 z-30 flex flex-col bg-black text-white`}>
      <div className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 text-[13px]">
        <span className="min-w-0">
          <b className="block text-[15px]">
            {childName} · {WEEKDAYS_LONG[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]}
          </b>
          <small className="opacity-70">
            {longDate(day)}, {photo.addedAt}
          </small>
        </span>
        <button onClick={onClose} className="px-1 py-2 text-[15px] font-semibold">
          Close
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a signed, private URL */}
      <img src={photo.url} alt={`${childName}'s photo from ${longDate(day)}`} className="min-h-0 flex-1 object-contain" />
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[13px]">
        <p className="opacity-70">
          {waiting ? `${waiting} Task${waiting > 1 ? "s" : ""} waiting on this day` : "Nothing waiting on this day"}
        </p>
        {waiting > 0 && (
          <form action={approveAll.bind(null, waitingIds, day)}>
            <button className="rounded-lg bg-[#2563EB] px-3 py-2 text-sm font-bold text-white active:bg-[#1D4ED8]">
              Approve all ({waiting})
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

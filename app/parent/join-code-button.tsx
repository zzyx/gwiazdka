"use client";

import { useEffect, useState, useTransition } from "react";
import { Smartphone } from "lucide-react";
import { formatCode, timeLeft } from "@/lib/join";
import { issueJoinCode } from "./actions";

const VALID_MS = 15 * 60_000;

type Issued = { code: string; expiresAt: number };

// "Connect Kuba's phone": a sheet with a fresh Join code in large type, its
// countdown, a QR code for the join page and the steps to read out.
export function JoinCodeButton({
  childId,
  name,
  joinUrl,
  qr,
}: {
  childId: string;
  name: string;
  joinUrl: string;
  qr: React.ReactNode;
}) {
  const [issued, setIssued] = useState<Issued>();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const [pending, startTransition] = useTransition();
  const expired = !issued || now >= issued.expiresAt;

  const issue = () =>
    startTransition(async () => {
      const code = await issueJoinCode(childId);
      // Counted from when the code arrives, so it never shows more time than the server gives.
      const at = Date.now();
      setIssued({ code, expiresAt: at + VALID_MS });
      setNow(at);
      setOpen(true);
    });

  useEffect(() => {
    if (!open || expired) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => {
      clearInterval(tick);
      window.removeEventListener("keydown", close);
    };
  }, [open, expired]);

  // Reopening shows the code still running; once it's gone, a new one.
  const connect = () => {
    const at = Date.now();
    setNow(at);
    if (issued && at < issued.expiresAt) setOpen(true);
    else issue();
  };

  return (
    <>
      <button
        disabled={pending && !open}
        onClick={connect}
        className="flex items-center gap-1.5 self-start text-sm font-semibold text-[#2563EB] disabled:opacity-50"
      >
        <Smartphone className="size-4" aria-hidden /> Connect {name}&apos;s phone
      </button>
      {open && issued && (
        <div className="fixed inset-0 z-50 flex items-end bg-[#111827]/45" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-label={`Connect ${name}'s phone`}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-t-2xl bg-white px-5 pt-2.5 pb-[max(1.75rem,env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto h-1.25 w-10 rounded-full bg-[#D1D5DB]" aria-hidden />
            <h3 className="text-lg font-bold">Connect {name}&apos;s phone</h3>
            <div className="flex flex-col items-center gap-1 rounded-xl bg-[#F3F4F6] p-3.5">
              <b
                className={`font-mono text-4xl font-extrabold tracking-[.12em] ${expired ? "text-[#9CA3AF] line-through" : ""}`}
              >
                {formatCode(issued.code)}
              </b>
              <span className="text-sm text-[#6B7280] tabular-nums" aria-live="polite">
                {expired ? "Expired. Get a new code." : `Works once · ${timeLeft(issued.expiresAt - now)} left`}
              </span>
            </div>
            <div className="flex items-center gap-3.5">
              {qr}
              <ol className="flex list-decimal flex-col gap-1 pl-4.5 text-sm/normal text-[#374151]">
                <li>
                  On {name}&apos;s iPhone, scan this with the Camera, or open <b>{joinUrl.replace(/^https?:\/\//, "")}</b> in
                  Safari.
                </li>
                <li>Add Gwiazdki to the Home Screen (the page shows how).</li>
                <li>Open it from the Home Screen and type the code.</li>
              </ol>
            </div>
            <div className="flex gap-2.5">
              <button
                disabled={pending}
                onClick={issue}
                className="flex-1 rounded-xl border border-[#D1D5DB] p-3 font-bold disabled:opacity-50"
              >
                {pending ? "Getting a code…" : "New code"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-[#2563EB] bg-[#2563EB] p-3 font-bold text-white"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

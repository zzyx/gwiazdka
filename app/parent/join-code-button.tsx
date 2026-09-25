"use client";

import { useState, useTransition } from "react";
import { issueJoinCode } from "./actions";

// Shows a fresh Join code for the child to type into the installed app on their device.
export function JoinCodeButton({ childId }: { childId: string }) {
  const [code, setCode] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (code) {
    return (
      <p className="text-sm text-sky-900">
        Code: <span className="font-mono text-xl font-bold tracking-widest">
          {code.slice(0, 4)}-{code.slice(4)}
        </span>{" "}
        (works once, for 15 minutes)
      </p>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(async () => setCode(await issueJoinCode(childId)))}
      className="self-start rounded-lg bg-yellow-400 px-3 py-1 text-sm font-bold text-sky-950 disabled:opacity-50"
    >
      Get a Join code
    </button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { issueJoinCode } from "./actions";

// Shows a fresh Join code for the child to type into the installed app on their device.
export function JoinCodeButton({ childId }: { childId: string }) {
  const [code, setCode] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (code) {
    return (
      <p className="text-sm">
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
      className="self-start text-sm text-[#2563EB] underline disabled:opacity-50"
    >
      Connect a device (Join code)
    </button>
  );
}

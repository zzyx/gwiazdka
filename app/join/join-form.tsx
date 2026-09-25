"use client";

import { useActionState } from "react";
import { joinWithCode, type JoinState } from "./actions";

export function JoinForm() {
  const [state, formAction, pending] = useActionState<JoinState, FormData>(joinWithCode, {});

  return (
    <form action={formAction} className="flex w-full max-w-xs flex-col gap-3">
      <label htmlFor="code" className="text-sky-900">
        Code from your parent
      </label>
      <input
        id="code"
        name="code"
        required
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="rounded-xl border-2 border-sky-300 bg-white p-3 text-center font-mono text-2xl tracking-widest uppercase"
      />
      {state.error && <p className="text-red-700">{state.error}</p>}
      <button
        disabled={pending}
        className="rounded-xl bg-yellow-400 p-3 text-lg font-bold text-sky-950 disabled:opacity-50"
      >
        {pending ? "Joining…" : "Join"}
      </button>
    </form>
  );
}

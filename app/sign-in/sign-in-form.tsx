"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

const FIELD = "rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-base font-normal";

export function SignInForm() {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Email
        <input
          name="email"
          type="email"
          required
          defaultValue={state.email}
          autoComplete="username"
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={FIELD}
        />
      </label>
      {state.error && <p role="alert" className="rounded-lg bg-[#FEE2E2] p-3 text-sm text-[#B91C1C]">{state.error}</p>}
      <button
        disabled={pending}
        className="mt-1 rounded-xl bg-[#2563EB] p-3 font-bold text-white disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

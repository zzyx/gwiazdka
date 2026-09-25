"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

export function SignInForm() {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={formAction} className="flex w-full max-w-xs flex-col gap-3 text-left">
      <label className="flex flex-col gap-1 text-sky-900">
        Email
        <input
          name="email"
          type="email"
          required
          defaultValue={state.email}
          autoComplete="username"
          className="rounded-xl border-2 border-sky-300 bg-white p-3"
        />
      </label>
      <label className="flex flex-col gap-1 text-sky-900">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-xl border-2 border-sky-300 bg-white p-3"
        />
      </label>
      {state.error && <p className="text-red-700">{state.error}</p>}
      <button
        disabled={pending}
        className="rounded-xl bg-sky-700 p-3 text-lg font-bold text-white disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

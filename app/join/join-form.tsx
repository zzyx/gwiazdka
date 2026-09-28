"use client";

import { useActionState, useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { CODE_LENGTH, cleanCode, formatCode } from "@/lib/join";
import { joinWithCode, type JoinState } from "./actions";

// One box for the code: shows XXXX-XXXX, ignores case, spaces and dashes.
export function JoinForm() {
  const [state, formAction, pending] = useActionState<JoinState, FormData>(joinWithCode, {});
  const [code, setCode] = useState("");
  // The error belongs to the code that was tried; typing again hides it.
  const [edited, setEdited] = useState(false);
  const change = (text: string) => {
    setCode(cleanCode(text));
    setEdited(true);
  };
  const canPaste = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;

  return (
    <form action={formAction} onSubmit={() => setEdited(false)} className="flex w-full flex-col gap-3">
      <label htmlFor="code" className="text-left text-sm font-semibold text-(--mn-muted)">
        Code from your parent
      </label>
      <input
        id="code"
        name="code"
        value={formatCode(code)}
        onChange={(e) => change(e.target.value)}
        placeholder="XXXX-XXXX"
        required
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-[18px] border-[1.5px] border-(--mn-line) bg-(--mn-card) px-2 py-4 text-center font-mono text-3xl font-extrabold tracking-[.14em] text-(--mn-ink) uppercase outline-none placeholder:text-(--mn-muted)/45 focus:border-(--acc) focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--acc)_22%,transparent)]"
      />
      {state.error && !edited && <p className="text-sm text-[#F87171]">{state.error}</p>}
      <button
        disabled={pending || code.length < CODE_LENGTH}
        className="rounded-2xl bg-(--acc) p-4 font-bold text-[#1A1405] active:scale-[.98] disabled:opacity-45"
      >
        {pending ? "Joining…" : "Join"}
      </button>
      {canPaste && (
        <button
          type="button"
          onClick={async () => change(await navigator.clipboard.readText().catch(() => ""))}
          className="flex items-center gap-1.5 self-center text-sm font-semibold text-(--mn-acc-ink)"
        >
          <ClipboardPaste className="size-4" aria-hidden /> Paste the code
        </button>
      )}
    </form>
  );
}

import type { Child } from "@/lib/viewer";
import { KeepSignedIn } from "./keep-signed-in";

// Placeholder until the Today screen (part 3).
export function ChildHome({ child }: { child: Child }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-sky-100 p-8 text-center">
      <KeepSignedIn />
      <div className="text-7xl" aria-hidden>
        ⭐
      </div>
      <h1 className="text-3xl font-bold text-sky-900">Hi {child.name}!</h1>
      <p className="max-w-xs text-sky-800">You&apos;re in. Your tasks will show up here soon.</p>
    </main>
  );
}

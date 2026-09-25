import type { Child } from "@/lib/viewer";
import { signOut } from "../sign-in/actions";
import { JoinCodeButton } from "./join-code-button";

// Placeholder until the Inbox (part 4): lets the parent connect each child's device.
export function ParentHome({ childList }: { childList: Child[] }) {
  return (
    <main className="flex flex-1 flex-col gap-6 bg-sky-50 p-6">
      <h1 className="text-2xl font-bold text-sky-900">Your children</h1>
      <ul className="flex flex-col gap-3">
        {childList.map((child) => (
          <li key={child.id} className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
            <span className="text-lg font-semibold text-sky-900">{child.name}</span>
            <JoinCodeButton childId={child.id} />
          </li>
        ))}
      </ul>
      <form action={signOut}>
        <button className="text-sm text-sky-700 underline">Sign out</button>
      </form>
    </main>
  );
}

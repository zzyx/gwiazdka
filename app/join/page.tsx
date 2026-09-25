import { InstallHint } from "./install-hint";
import { JoinForm } from "./join-form";

export default function JoinPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-sky-100 p-8 text-center">
      <div className="text-6xl" aria-hidden>
        ⭐
      </div>
      <h1 className="text-2xl font-bold text-sky-900">Join Gwiazdki</h1>
      <InstallHint />
      <JoinForm />
    </main>
  );
}

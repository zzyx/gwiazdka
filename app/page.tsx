import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { ChildHome } from "./child/child-home";
import { ParentHome } from "./parent/parent-home";

export default async function Home() {
  const viewer = await getViewer();
  if (viewer.kind === "parent") return <ParentHome childList={viewer.children} />;
  if (viewer.kind === "child") return <ChildHome child={viewer.child} />;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-sky-100 p-8 text-center">
      <div className="text-7xl" aria-hidden>
        ⭐
      </div>
      <h1 className="text-3xl font-bold text-sky-900">Gwiazdki</h1>
      <Link
        href="/join"
        className="w-full max-w-xs rounded-xl bg-yellow-400 p-3 text-lg font-bold text-sky-950"
      >
        I have a code
      </Link>
      <Link href="/sign-in" className="text-sky-700 underline">
        Parent sign-in
      </Link>
    </main>
  );
}

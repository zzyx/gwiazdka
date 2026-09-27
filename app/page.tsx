import type { Viewport } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { parseTheme, THEME_COOKIE, themeColor } from "@/lib/look";
import { getViewer } from "@/lib/viewer";
import { ChildHome } from "./child/child-home";
import { ParentHome } from "./parent/parent-home";

// A child's status bar follows their Midnight theme; everyone else keeps the default.
export async function generateViewport(): Promise<Viewport> {
  const viewer = await getViewer();
  if (viewer.kind !== "child") return {};
  const jar = await cookies();
  return { themeColor: themeColor(parseTheme(jar.get(THEME_COOKIE)?.value)) };
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const viewer = await getViewer();
  const { day } = await searchParams;
  if (viewer.kind === "parent") return <ParentHome />;
  if (viewer.kind === "child") return <ChildHome child={viewer.child} day={typeof day === "string" ? day : undefined} />;

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

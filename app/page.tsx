import type { Viewport } from "next";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, themeColor } from "@/lib/look";
import { getViewer } from "@/lib/viewer";
import { ChildHome } from "./child/child-home";
import { SignedOut } from "./join/signed-out";
import { ParentHome } from "./parent/parent-home";

// A child's status bar follows their Midnight theme, and so does the welcome's;
// the parent keeps the default.
export async function generateViewport(): Promise<Viewport> {
  const viewer = await getViewer();
  if (viewer.kind === "parent") return {};
  const jar = await cookies();
  return { themeColor: themeColor(parseTheme(jar.get(THEME_COOKIE)?.value)) };
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const viewer = await getViewer();
  const { day } = await searchParams;
  if (viewer.kind === "parent") return <ParentHome />;
  if (viewer.kind === "child") return <ChildHome child={viewer.child} day={typeof day === "string" ? day : undefined} />;

  return <SignedOut page="home" />;
}

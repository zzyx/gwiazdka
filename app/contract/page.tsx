import type { Viewport } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseTheme, THEME_COOKIE, themeColor } from "@/lib/look";
import { getViewer } from "@/lib/viewer";
import { ContractHome } from "../child/contract-home";

export async function generateViewport(): Promise<Viewport> {
  const jar = await cookies();
  return { themeColor: themeColor(parseTheme(jar.get(THEME_COOKIE)?.value)) };
}

// The child's "Your Contract" page; everyone else goes back home.
export default async function ContractPage() {
  const viewer = await getViewer();
  if (viewer.kind !== "child") redirect("/");
  return <ContractHome child={viewer.child} />;
}

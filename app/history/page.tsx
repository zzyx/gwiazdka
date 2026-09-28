import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { HistoryHome } from "../parent/history-home";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// The parent's History of one child, a week at a time; everyone else goes back home.
export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const viewer = await getViewer();
  if (viewer.kind !== "parent") redirect("/");
  const params = await searchParams;
  return <HistoryHome childId={one(params.child)} week={one(params.week)} />;
}

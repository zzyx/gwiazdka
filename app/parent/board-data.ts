import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { loadBoard } from "@/lib/parent-board";
import { createClient } from "@/lib/supabase/server";

// The Board, loaded once per request: the home draws it and the navigation
// counts what waits from it.
export const getBoard = cache(async () => loadBoard(await createClient(), new Date()));

// The join page on the address the parent is using, e.g. https://gwiazdka.vercel.app/join.
export async function joinPageUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}/join`;
}

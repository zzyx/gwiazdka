import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Child = { id: string; name: string };

// Who is using the app: a parent, a child on their own device, or nobody yet.
export type Viewer =
  | { kind: "parent"; children: Child[] }
  | { kind: "child"; child: Child }
  | { kind: "none" };

export async function getViewer(): Promise<Viewer> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return { kind: "none" };

  const { data: parent } = await supabase
    .from("parents")
    .select("family_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (parent) {
    const { data: children } = await supabase
      .from("children")
      .select("id, name")
      .order("name");
    return { kind: "parent", children: children ?? [] };
  }

  const { data: child } = await supabase
    .from("children")
    .select("id, name")
    .eq("user_id", userId)
    .maybeSingle();
  if (child) return { kind: "child", child };

  return { kind: "none" };
}

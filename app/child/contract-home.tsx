import { cookies } from "next/headers";
import { loadChildContract } from "@/lib/child-contract";
import { ACCENT_COOKIE, parseAccent, parseTheme, THEME_COOKIE } from "@/lib/look";
import { createClient } from "@/lib/supabase/server";
import type { Child } from "@/lib/viewer";
import { ContractView } from "./contract-view";
import { sora } from "./font";
import { Look } from "./look";

// The child's "Your Contract" page, in the "Midnight" look.
export async function ContractHome({ child }: { child: Child }) {
  const supabase = await createClient();
  const [contract, jar] = await Promise.all([loadChildContract(supabase, child.id, new Date()), cookies()]);

  return (
    <Look
      theme={parseTheme(jar.get(THEME_COOKIE)?.value)}
      accent={parseAccent(jar.get(ACCENT_COOKIE)?.value)}
      className={`${sora.className} flex flex-1 flex-col`}
    >
      <ContractView contract={contract} />
    </Look>
  );
}

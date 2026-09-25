"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { error?: string };

// Children never see or use this address; no mail is ever sent to it.
function childEmail(childId: string) {
  return `child-${childId}@children.gwiazdka.vercel.app`;
}

// A child types the Join code their parent issued, inside the installed app.
// The server redeems it and creates the session right here, so it lands in the
// installed app's own storage (a link opened in Safari would sign in Safari).
export async function joinWithCode(_prev: JoinState, form: FormData): Promise<JoinState> {
  const code = String(form.get("code") ?? "");
  const admin = createAdminClient();

  const { data: redeemed, error: redeemError } = await admin
    .rpc("redeem_join_code", { p_code: code })
    .maybeSingle<{ child_id: string; user_id: string | null }>();
  if (redeemError) throw redeemError;
  if (!redeemed) {
    return { error: "That code doesn't work. Ask your parent for a new one." };
  }

  // Creates the child's account the first time; later codes reuse it.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: childEmail(redeemed.child_id),
  });
  if (linkError) throw linkError;

  if (redeemed.user_id !== link.user.id) {
    const { error } = await admin
      .from("children")
      .update({ user_id: link.user.id })
      .eq("id", redeemed.child_id);
    if (error) throw error;
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    // "signup" the first time, when generateLink has just created the account.
    type: link.properties.verification_type as EmailOtpType,
  });
  if (verifyError) throw verifyError;

  redirect("/");
}

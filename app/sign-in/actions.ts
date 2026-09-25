"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// email is sent back so the form keeps it after React resets the form.
export type SignInState = { error?: string; email?: string };

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const supabase = await createClient();
  const email = String(form.get("email") ?? "");
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: String(form.get("password") ?? ""),
  });
  if (error) return { error: "Wrong email or password.", email };
  redirect("/");
}

// Signs out this device only; the default would end every session of the user.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

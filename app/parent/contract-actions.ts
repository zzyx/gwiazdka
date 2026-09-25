"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseRate } from "@/lib/contracts";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string };

// The Task list comes from the form as JSON: [{id} | {name, icon}], in order.
function readTasks(form: FormData): unknown {
  try {
    return JSON.parse(String(form.get("tasks") ?? "[]"));
  } catch {
    return [];
  }
}

const contractsPage = (childId: string, sheet?: string) =>
  `/contracts?child=${encodeURIComponent(childId)}${sheet ? `&sheet=${sheet}` : ""}`;

// The database checks every rule and says what is wrong in words the parent can read.
function explain(error: { code?: string; message: string }): string {
  return error.code === "42501" ? "You can't change this Contract." : error.message;
}

// Creates a Contract for a child together with their Task list, from the
// Create or the Start next contract sheet.
export async function createContract(childId: string, _: FormState, form: FormData): Promise<FormState> {
  const rate = parseRate(String(form.get("rate") ?? ""));
  if (rate === null) return { error: "Enter the rate in złoty, e.g. 0.50." };
  const bonusText = String(form.get("bonus") ?? "").trim();
  if (!/^\d{1,2}$/.test(bonusText)) {
    return { error: "Enter the Weekly bonus as a whole number of gwiazdki (0 for none)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_contract", {
    p_child_id: childId,
    p_starts_on: String(form.get("starts_on") ?? ""),
    p_ends_on: String(form.get("ends_on") ?? ""),
    p_grosze_per_star: rate,
    p_weekly_bonus_stars: Number(bonusText),
    p_tasks: readTasks(form),
  });
  if (error) return { error: explain(error) };
  revalidatePath("/", "layout");
  redirect(contractsPage(childId));
}

// Saves an open Contract's dates and the child's Task list.
export async function updateContract(
  childId: string,
  contractId: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_contract", {
    p_contract_id: contractId,
    p_starts_on: String(form.get("starts_on") ?? ""),
    p_ends_on: String(form.get("ends_on") ?? ""),
    p_tasks: readTasks(form),
  });
  if (error) return { error: explain(error) };
  revalidatePath("/", "layout");
  redirect(contractsPage(childId));
}

// Close & pay out, then offer the next Contract.
export async function closeContract(childId: string, contractId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_contract", { p_contract_id: contractId });
  if (error) throw new Error(explain(error));
  revalidatePath("/", "layout");
  redirect(contractsPage(childId, `paid&contract=${encodeURIComponent(contractId)}`));
}

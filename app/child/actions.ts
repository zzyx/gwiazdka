"use server";

import { revalidatePath } from "next/cache";
import { DAY_PHOTOS_BUCKET, dayPhotoPath } from "@/lib/day-photos";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

// Makes or undoes the child's Check-off of one Task on one day. The database
// decides whether that is still allowed.
export async function setCheckOff(taskId: string, day: string, done: boolean): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error, count } = done
    ? await supabase.from("check_offs").insert({ task_id: taskId, day }, { count: "exact" })
    : await supabase.from("check_offs").delete({ count: "exact" }).match({ task_id: taskId, day });
  revalidatePath("/");
  return { ok: !error && count === 1 };
}

// Largest picture accepted; the phone shrinks photos to about 200 KB first.
const MAX_PHOTO_BYTES = 1024 * 1024;

// Adds or replaces the child's photo of one day. The database decides whether
// the day can still be changed.
export async function savePhoto(day: string, form: FormData): Promise<{ ok: boolean }> {
  const viewer = await getViewer();
  const photo = form.get("photo");
  if (viewer.kind !== "child" || !(photo instanceof File) || photo.type !== "image/jpeg" || photo.size > MAX_PHOTO_BYTES)
    return { ok: false };
  const supabase = await createClient();
  const childId = viewer.child.id;
  const upload = await supabase.storage
    .from(DAY_PHOTOS_BUCKET)
    .upload(dayPhotoPath(childId, day), photo, { contentType: "image/jpeg", upsert: true });
  if (upload.error) return { ok: false };
  const { error } = await supabase
    .from("day_photos")
    .upsert({ child_id: childId, day, added_at: new Date().toISOString() });
  revalidatePath("/", "layout");
  return { ok: !error };
}

// Removes the child's photo of one day while the day can still be changed.
export async function removePhoto(day: string): Promise<{ ok: boolean }> {
  const viewer = await getViewer();
  if (viewer.kind !== "child") return { ok: false };
  const supabase = await createClient();
  const childId = viewer.child.id;
  const { error, count } = await supabase
    .from("day_photos")
    .delete({ count: "exact" })
    .match({ child_id: childId, day });
  if (error || count !== 1) return { ok: false };
  await supabase.storage.from(DAY_PHOTOS_BUCKET).remove([dayPhotoPath(childId, day)]);
  revalidatePath("/", "layout");
  return { ok: true };
}

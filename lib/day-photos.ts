import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { warsawTime } from "./today";

// The photo of the day lives in a private Storage bucket, one picture per child per day.
export const DAY_PHOTOS_BUCKET = "day-photos";

export const dayPhotoPath = (childId: string, day: string) => `${childId}/${day}.jpg`;

// A photo as screens show it: a short-lived signed URL and when it was added (HH:MM, Warsaw).
export type DayPhoto = { url: string; addedAt: string };

export type DayPhotoRow = { child_id: string; day: string; added_at: string };

// Signs the pictures of these day_photos rows with the caller's session, keyed
// by their Storage path. A picture that can't be signed is left out.
export async function signDayPhotos(supabase: SupabaseClient, rows: DayPhotoRow[]): Promise<Map<string, DayPhoto>> {
  const photos = new Map<string, DayPhoto>();
  if (rows.length === 0) return photos;
  const paths = rows.map((r) => dayPhotoPath(r.child_id, r.day));
  const { data, error } = await supabase.storage.from(DAY_PHOTOS_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  data.forEach((signed, i) => {
    if (signed.signedUrl) photos.set(paths[i], { url: signed.signedUrl, addedAt: warsawTime(rows[i].added_at) });
  });
  return photos;
}

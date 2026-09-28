"use client";

import { Camera, Lock } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import type { DayPhoto } from "@/lib/day-photos";
import { dayMonth } from "@/lib/weeks";
import { removePhoto, savePhoto } from "./actions";

const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const longDate = (day: string) => `${WEEKDAYS_LONG[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]} ${dayMonth(day)}`;

// The photo is shrunk on the phone before it is sent: a JPEG (never WebP)
// about this wide and at most this big.
const MAX_SIDE = 1000;
const MAX_BYTES = 200 * 1024;

async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const quality of [0.82, 0.72, 0.62, 0.5, 0.4]) {
      blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", quality));
      if (!blob || blob.size <= MAX_BYTES) break;
    }
    if (!blob) throw new Error("This photo can't be read.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The photo of the day under the Tasks: "Add a photo" while the day can be
// changed, then the photo with Replace and Remove; read-only on older days.
export function DayPhotoCard({ day, photo, canChange }: { day: string; photo: DayPhoto | null; canChange: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const say = (text: string) => setToast({ id: Date.now(), text });

  function pick() {
    setOpen(false);
    input.current?.click();
  }

  function send(file: File) {
    const had = !!photo;
    const preview = URL.createObjectURL(file);
    setSending(preview);
    startTransition(async () => {
      try {
        const form = new FormData();
        form.set("photo", await shrink(file), "photo.jpg");
        const { ok } = await savePhoto(day, form);
        say(ok ? (had ? "Photo replaced" : "Photo sent to your parent") : "The photo didn't go through. Try again.");
      } catch {
        say("The photo didn't go through. Try again.");
      } finally {
        setSending(null);
        URL.revokeObjectURL(preview);
      }
    });
  }

  function remove() {
    setOpen(false);
    startTransition(async () => {
      const { ok } = await removePhoto(day);
      say(ok ? "Photo removed" : "The photo couldn't be removed.");
    });
  }

  const shown = sending ?? photo?.url;
  if (!shown && !canChange) return null;

  return (
    <>
      {canChange && (
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) send(file);
          }}
        />
      )}
      {!shown ? (
        <button
          onClick={pick}
          className="mx-4 mt-3.5 flex items-center gap-3.5 rounded-[20px] border-[1.5px] border-dashed border-(--mn-line) p-4 text-left active:scale-[.98]"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-(--mn-line)/60 text-(--mn-acc-ink)">
            <Camera className="size-5.5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <b className="text-[15px] font-semibold">Add a photo</b>
            <small className="text-xs leading-snug text-(--mn-muted)">
              Optional. Show your room, or anything your parent should see.
            </small>
          </span>
        </button>
      ) : (
        <section className="mx-4 mt-3.5 overflow-hidden rounded-[20px] border border-(--mn-line) bg-(--mn-card)">
          <button
            onClick={() => setOpen(true)}
            disabled={!!sending}
            aria-label="Open photo"
            className="relative block aspect-[4/3] w-full bg-black bg-cover bg-center"
            style={{ backgroundImage: `url("${shown}")` }}
          >
            {sending && (
              <span className="absolute inset-0 grid place-items-center bg-[rgba(10,14,28,.55)] text-[13px] font-semibold text-white">
                Sending photo…
              </span>
            )}
          </button>
          <div className="flex items-center gap-2.5 px-3.5 py-2.5">
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-(--mn-muted)">
              {canChange ? <Camera className="size-3.5 shrink-0" aria-hidden /> : <Lock className="size-3.5 shrink-0" aria-hidden />}
              <span className="truncate">
                {sending ? "Sending…" : canChange ? `Added ${photo?.addedAt}` : `Photo from ${longDate(day)}`}
              </span>
            </span>
            {canChange && !sending && (
              <>
                <button onClick={pick} className="px-0.5 py-1 text-[13px] font-semibold text-(--mn-acc-ink)">
                  Replace
                </button>
                <button onClick={remove} className="px-0.5 py-1 text-[13px] font-semibold text-(--mn-muted)">
                  Remove
                </button>
              </>
            )}
          </div>
        </section>
      )}
      {open && photo && (
        <div role="dialog" aria-label="Photo" className="fixed inset-0 z-30 flex flex-col bg-black text-white">
          <div className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 text-[13px]">
            <span className="min-w-0">
              <b className="block text-[15px]">{longDate(day)}</b>
              <small className="opacity-70">Added {photo.addedAt}</small>
            </span>
            <button onClick={() => setOpen(false)} className="px-1 py-2 text-[15px] font-semibold">
              Close
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- a signed, private URL */}
          <img src={photo.url} alt={`Photo from ${longDate(day)}`} className="min-h-0 flex-1 object-contain" />
          <div className="flex justify-center gap-3 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {canChange ? (
              <>
                <button onClick={remove} className="rounded-xl border border-white/30 px-5 py-2.5 font-semibold">
                  Remove
                </button>
                <button onClick={pick} className="rounded-xl bg-(--acc) px-5 py-2.5 font-bold text-[#1A1405]">
                  Replace
                </button>
              </>
            ) : (
              <p className="text-[13px] opacity-70">Only you and your parent can see this.</p>
            )}
          </div>
        </div>
      )}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 animate-[toast_2.5s_ease_forwards] items-center gap-2 rounded-full bg-(--mn-ink) px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap text-(--mn-bg) shadow-[0_8px_22px_rgba(0,0,0,.35)]"
        >
          <Camera className="size-4 text-(--acc)" aria-hidden />
          {toast.text}
        </div>
      )}
    </>
  );
}

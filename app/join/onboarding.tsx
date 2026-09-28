"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Ellipsis, Share, SquarePlus } from "lucide-react";
import { detectBrowser, joinScreen, type JoinScreen } from "@/lib/join";
import { Star } from "../child/star";
import { JoinForm } from "./join-form";

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true)
  );
}

function currentScreen(page: "home" | "join"): JoinScreen {
  return joinScreen(page, isInstalled(), detectBrowser(navigator.userAgent, navigator.maxTouchPoints));
}

// A signed-out visitor, in the Midnight look. Only the phone knows whether this
// is Safari or the installed app, so the server renders the empty background
// and the phone picks the screen.
export function Onboarding({ page }: { page: "home" | "join" }) {
  const screen = useSyncExternalStore(
    () => () => {},
    () => currentScreen(page),
    () => null,
  );

  if (screen === "welcome") return <Welcome />;
  if (screen === "install-ios") return <InstallIos />;
  if (screen === "install-other") return <InstallOther />;
  if (screen === "code") return <TypeCode />;
  return null;
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`grid place-items-center border border-(--mn-line) bg-(--mn-card) text-(--acc) shadow-[0_0_60px_color-mix(in_srgb,var(--acc)_25%,transparent)] ${
        small ? "size-16 rounded-[18px]" : "size-22 rounded-3xl"
      }`}
    >
      <Star className={small ? "size-9" : "size-12"} />
    </div>
  );
}

const CTA = "block w-full rounded-2xl bg-(--acc) p-4 text-center font-bold text-[#1A1405] active:scale-[.98]";

function Welcome() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-7 text-center">
      <Logo />
      <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight">Gwiazdki</h1>
      <p className="max-w-64 text-sm/relaxed text-(--mn-muted)">
        Check off your day, get it approved, and watch your gwiazdki add up.
      </p>
      <div className="mt-3 flex w-full max-w-72 flex-col items-center gap-4">
        <Link href="/join" className={CTA}>
          I have a code from my parent
        </Link>
        <Link href="/sign-in" className="text-sm text-(--mn-muted) underline">
          Parent sign-in
        </Link>
      </div>
    </main>
  );
}

function Heading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <header className="px-5.5 pt-[max(2rem,env(safe-area-inset-top))]">
      <small className="text-xs font-semibold tracking-widest text-(--mn-muted) uppercase">Join Gwiazdki</small>
      <h1 className="mt-1 mb-1.5 text-2xl font-extrabold tracking-tight text-balance">{title}</h1>
      <p className="text-sm/relaxed text-(--mn-muted)">{children}</p>
    </header>
  );
}

// One of Safari's buttons, drawn inline in a step.
function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-grid h-5.5 min-w-6.5 place-items-center rounded-md border border-(--mn-line) bg-(--mn-bg) px-1.5 align-[-5px]">
      {children}
    </span>
  );
}

const ICON = "size-3.5";

const IOS_STEPS = [
  <>
    Tap{" "}
    <Key>
      <Ellipsis className={ICON} aria-label="More" />
    </Key>{" "}
    at the bottom right of Safari
  </>,
  <>
    Tap{" "}
    <Key>
      <Share className={ICON} aria-hidden />
    </Key>{" "}
    Share
  </>,
  <>
    Tap{" "}
    <Key>
      <SquarePlus className={ICON} aria-hidden />
    </Key>{" "}
    Add to Home Screen, keep <i>Open as Web App</i> on, then Add
  </>,
  <>
    Open{" "}
    <Key>
      <Star className={`${ICON} text-(--acc)`} />
    </Key>{" "}
    Gwiazdki from your Home Screen and type your code there
  </>,
];

// Safari on iPhone: how to add the app, and no code field, since a code typed
// here would sign in Safari and be used up.
function InstallIos() {
  return (
    <main className="flex flex-1 flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <Heading title="First, put Gwiazdki on your Home Screen">
        It&apos;s an app you add from Safari, no App Store needed. Your code goes in once it&apos;s there.
      </Heading>
      <ol className="mx-4 mt-4 flex flex-col gap-2">
        {IOS_STEPS.map((step, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-(--mn-line) bg-(--mn-card) px-3.5 py-3"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-(--mn-bg) text-sm font-extrabold text-(--mn-acc-ink)">
              {i + 1}
            </span>
            <span className="text-sm/snug font-semibold">{step}</span>
          </li>
        ))}
      </ol>
      <Why />
      <Already>Already added it?</Already>
    </main>
  );
}

function InstallOther() {
  return (
    <main className="flex flex-1 flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <Heading title="First, install Gwiazdki">
        Install this app from your browser&apos;s menu, then open it and type your code.
      </Heading>
      <Why />
      <Already>Already installed it?</Already>
    </main>
  );
}

function Why() {
  return (
    <p className="mx-4 mt-3 rounded-2xl border border-dashed border-(--mn-line) px-3.5 py-3 text-xs/relaxed text-(--mn-muted)">
      Why not type the code here? Your code signs in the app on your Home Screen. Typed here, it would be used
      up.
    </p>
  );
}

function Already({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-5.5 mt-4 text-center text-sm text-(--mn-muted)">
      {children} <b className="text-(--mn-ink)">Open Gwiazdki from your Home Screen.</b>
    </p>
  );
}

// Inside the installed app: straight to the code, with no welcome.
function TypeCode() {
  return (
    <main className="flex flex-1 flex-col items-center gap-4 px-5.5 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
      <Logo small />
      <div>
        <h1 className="mb-1.5 text-2xl font-extrabold tracking-tight">Type your code</h1>
        <p className="text-sm/relaxed text-(--mn-muted)">
          Ask your parent for a code in their app. It works once, for 15 minutes.
        </p>
      </div>
      <JoinForm />
      <Link href="/sign-in" className="mt-auto pt-6 text-sm text-(--mn-muted) underline">
        Parent sign-in
      </Link>
    </main>
  );
}

"use client";

import { useSyncExternalStore } from "react";

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true)
  );
}

// The Join code must be typed inside the installed app: on iPhone, Safari and
// the Home Screen app keep separate sign-ins.
export function InstallHint() {
  const installed = useSyncExternalStore(
    () => () => {},
    isInstalled,
    () => true,
  );
  if (installed) return null;

  return (
    <p className="max-w-xs rounded-xl bg-yellow-100 p-3 text-sm text-yellow-900">
      First add Gwiazdki to your Home Screen: tap Share, then “Add to Home Screen”. Then
      open it from there and type your code.
    </p>
  );
}

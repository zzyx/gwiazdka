"use client";

import { useEffect } from "react";

// Asks iOS not to evict the installed app's storage, which holds the child's session.
export function KeepSignedIn() {
  useEffect(() => {
    navigator.storage?.persist?.();
  }, []);
  return null;
}
